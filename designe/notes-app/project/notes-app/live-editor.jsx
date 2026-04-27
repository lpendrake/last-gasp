/* global React */
// LiveEditor — Obsidian-style live-preview markdown.
//
// Approach:
// - The editor is a contenteditable <div> populated with one <div class="ml-line"> per line.
// - When a line contains the caret/selection, it renders in raw form (showing #, **, [text](path) etc.)
// - Otherwise it renders in "preview" form (heading styles, link chips, bullets, etc.) but the
//   underlying text content remains exactly the markdown (so caret arithmetic works fine).
// - We hide marker characters from rendered lines using <span class="ml-marker is-hideable">.
//   The text is still THERE in the DOM, the user just doesn't see it. This keeps copy-paste
//   and offset math correct.
//
// On every input/selection change we:
//  1. Read the full text (joining lines by \n).
//  2. Recompute the active line index from the selection.
//  3. Re-render lines whose form changed (cheap; just swap innerHTML on the line element).
// The IME-friendly approach: we never reset the entire contenteditable; we surgically update lines.

const { useEffect, useRef, useState, useCallback, useMemo } = React;

// ----------- inline span renderer -----------
function escHtml(s) {
  return s.replace(/[&<>"]/g, c =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;'
  );
}

// Determine kind from a relative link path, given current folder context.
function kindFromPath(href, currentFolder, linkIndex) {
  // href could be ../folder/file.md  or  file.md (same folder) or absolute-ish folder/file.md
  if (!href) return 'broken';
  let folder = currentFolder;
  let m = /^\.\.\/([^/]+)\/(.+)$/.exec(href);
  if (m) folder = m[1];
  else if ((m = /^([^/]+)\/(.+)$/.exec(href))) folder = m[1];
  // Same folder — keep currentFolder
  if (!folder) return 'broken';
  // Check if target exists in linkIndex (lazy: just infer kind from folder name)
  const kind = window.NotesData.FOLDER_KINDS[folder] || 'broken';
  // Optionally check existence:
  if (linkIndex) {
    const found = linkIndex.some(e => e.path.endsWith(href.replace(/^\.\.\//,'').replace(/^[^/]+\//, ''))
      || e.path.includes(href.replace(/^\.\.\//,'')));
    if (!found && href.startsWith('../')) {
      const tail = href.replace(/^\.\.\//, '');
      const exists = linkIndex.some(e => e.path === tail);
      if (!exists) return 'broken';
    }
  }
  return kind;
}

// Render inline markdown (bold, italic, code, links) into HTML.
// active=true means show all marker characters fully.
// active=false means hide marker characters (** [ ]( ) etc.) so user sees the rendered look.
function renderInline(text, opts) {
  const { active, currentFolder, linkIndex } = opts;
  // Process tokens left-to-right.
  let out = '';
  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);

    // Link: [text](url)
    let m = rest.match(/^\[([^\]\n]+)\]\(([^)\n]+)\)/);
    if (m) {
      const label = m[1];
      const href = m[2];
      const kind = kindFromPath(href, currentFolder, linkIndex);
      if (active) {
        out += `<span class="ml-marker is-hideable">[</span>`
            +  `<span class="ml-link kind-${kind}" data-href="${escHtml(href)}">${escHtml(label)}</span>`
            +  `<span class="ml-marker is-hideable">](</span>`
            +  `<span class="ml-marker is-hideable" style="color:var(--theme-text-muted)">${escHtml(href)}</span>`
            +  `<span class="ml-marker is-hideable">)</span>`;
      } else {
        // Hidden form: just label, marked up as link
        out += `<span class="ml-marker is-hideable">[</span>`
            +  `<span class="ml-link kind-${kind}" data-href="${escHtml(href)}">${escHtml(label)}</span>`
            +  `<span class="ml-marker is-hideable">](</span>`
            +  `<span class="ml-marker is-hideable">${escHtml(href)}</span>`
            +  `<span class="ml-marker is-hideable">)</span>`;
      }
      i += m[0].length;
      continue;
    }

    // Bold: **text**
    m = rest.match(/^\*\*([^*\n]+)\*\*/);
    if (m) {
      out += `<span class="ml-marker is-hideable">**</span>`
          +  `<span class="ml-bold">${escHtml(m[1])}</span>`
          +  `<span class="ml-marker is-hideable">**</span>`;
      i += m[0].length;
      continue;
    }

    // Italic: *text*  (don't match ** which is handled above)
    m = rest.match(/^\*([^*\n]+)\*/);
    if (m && rest[0] === '*' && rest[1] !== '*') {
      out += `<span class="ml-marker is-hideable">*</span>`
          +  `<span class="ml-italic">${escHtml(m[1])}</span>`
          +  `<span class="ml-marker is-hideable">*</span>`;
      i += m[0].length;
      continue;
    }

    // Inline code: `text`
    m = rest.match(/^`([^`\n]+)`/);
    if (m) {
      out += `<span class="ml-marker is-hideable">\`</span>`
          +  `<span class="ml-code">${escHtml(m[1])}</span>`
          +  `<span class="ml-marker is-hideable">\`</span>`;
      i += m[0].length;
      continue;
    }

    // Plain char (consume until next special)
    const next = rest.search(/[\[*`]/);
    const chunk = next === -1 ? rest : rest.slice(0, next || 1);
    out += escHtml(chunk);
    i += chunk.length;
  }
  return out;
}

function classifyLine(text) {
  let m = text.match(/^(#{1,6})\s+(.*)$/);
  if (m) return { kind: 'heading', level: m[1].length, marker: m[1] + ' ', body: m[2] };
  m = text.match(/^(\s*[-*+]\s+)(.*)$/);
  if (m) return { kind: 'bullet', marker: m[1], body: m[2] };
  m = text.match(/^(>\s?)(.*)$/);
  if (m) return { kind: 'quote', marker: m[1], body: m[2] };
  if (text.trim() === '') return { kind: 'blank', marker: '', body: '' };
  return { kind: 'para', marker: '', body: text };
}

function lineHtml(text, active, ctx) {
  const c = classifyLine(text);
  let cls = 'ml-line';
  let inner = '';

  if (c.kind === 'heading') {
    cls += ` is-h${Math.min(c.level, 3)}`;
    if (active) cls += ' is-active';
    inner = `<span class="ml-marker is-hideable">${escHtml(c.marker)}</span>`
          + renderInline(c.body, { active, ...ctx });
  } else if (c.kind === 'bullet') {
    cls += ' is-bullet';
    if (active) cls += ' is-active';
    inner = `<span class="ml-marker is-hideable">${escHtml(c.marker)}</span>`
          + renderInline(c.body, { active, ...ctx });
  } else if (c.kind === 'quote') {
    cls += ' is-quote';
    if (active) cls += ' is-active';
    inner = `<span class="ml-marker is-hideable">${escHtml(c.marker)}</span>`
          + renderInline(c.body, { active, ...ctx });
  } else if (c.kind === 'blank') {
    cls += ' is-blank';
    if (active) cls += ' is-active';
    inner = '<br>';
  } else {
    if (active) cls += ' is-active';
    inner = renderInline(text, { active, ...ctx });
  }

  return { cls, inner };
}

// ---- Caret helpers (text-offset based) ----
function getCaretLineIndex(root) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return -1;
  const range = sel.getRangeAt(0);
  let node = range.startContainer;
  // climb to the .ml-line ancestor
  while (node && node !== root && !(node.nodeType === 1 && node.classList && node.classList.contains('ml-line'))) {
    node = node.parentNode;
  }
  if (!node || node === root) return -1;
  const lines = Array.from(root.querySelectorAll(':scope > .ml-line'));
  return lines.indexOf(node);
}

function readAllText(root) {
  const lines = Array.from(root.querySelectorAll(':scope > .ml-line'));
  // Use textContent of each line; '\n' inside line shouldn't exist
  return lines.map(el => el.textContent.replace(/\n/g, '')).join('\n');
}

// Save & restore caret by storing (lineIndex, lineOffset)
function saveCaret(root) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  const lines = Array.from(root.querySelectorAll(':scope > .ml-line'));
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.contains(range.startContainer) || line === range.startContainer) {
      // Walk text nodes to compute offset
      let offset = 0;
      const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walker.nextNode())) {
        if (n === range.startContainer) {
          offset += range.startOffset;
          return { lineIndex: i, offset };
        }
        offset += n.textContent.length;
      }
      return { lineIndex: i, offset };
    }
  }
  return null;
}

function restoreCaret(root, saved) {
  if (!saved) return;
  const lines = Array.from(root.querySelectorAll(':scope > .ml-line'));
  const line = lines[saved.lineIndex];
  if (!line) return;
  let remaining = saved.offset;
  const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    if (remaining <= n.textContent.length) {
      const range = document.createRange();
      range.setStart(n, remaining);
      range.collapse(true);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
    remaining -= n.textContent.length;
  }
  // Fallback: end of line
  const range = document.createRange();
  range.selectNodeContents(line);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

// ============================================================
//   <LiveEditor /> component
// ============================================================
function LiveEditor({ value, onChange, currentFolder, linkIndex, onOpenLink, onTriggerQuickAdd }) {
  const rootRef = useRef(null);
  const valueRef = useRef(value);
  const activeLineRef = useRef(-1);
  const [linkPicker, setLinkPicker] = useState(null);
  const linkPickerRef = useRef(null);

  const ctx = useMemo(() => ({ currentFolder, linkIndex }), [currentFolder, linkIndex]);

  // Build the entire DOM from scratch (used on mount and when value prop changes externally).
  const rebuild = useCallback((text, activeIdx) => {
    const root = rootRef.current;
    if (!root) return;
    const lines = text.split('\n');
    const html = lines.map((ln, i) => {
      const { cls, inner } = lineHtml(ln, i === activeIdx, ctx);
      return `<div class="${cls}" data-li="${i}">${inner}</div>`;
    }).join('');
    root.innerHTML = html;
  }, [ctx]);

  // Re-render only line forms when active line changes (not the text itself).
  const refreshActive = useCallback((newActiveIdx) => {
    const root = rootRef.current;
    if (!root) return;
    const lines = Array.from(root.querySelectorAll(':scope > .ml-line'));
    if (newActiveIdx === activeLineRef.current) return;
    const text = readAllText(root);
    const txtLines = text.split('\n');

    // Save caret BEFORE we mutate any line's innerHTML — re-rendering destroys text nodes.
    const wasFocused = document.activeElement === root;
    const saved = wasFocused ? saveCaret(root) : null;

    if (activeLineRef.current >= 0 && lines[activeLineRef.current]) {
      const ln = lines[activeLineRef.current];
      const txt = txtLines[activeLineRef.current] || '';
      const { cls, inner } = lineHtml(txt, false, ctx);
      ln.className = cls;
      ln.innerHTML = inner;
    }
    if (newActiveIdx >= 0 && lines[newActiveIdx]) {
      const ln = lines[newActiveIdx];
      const txt = txtLines[newActiveIdx] || '';
      const { cls, inner } = lineHtml(txt, true, ctx);
      ln.className = cls;
      ln.innerHTML = inner;
    }
    activeLineRef.current = newActiveIdx;
    if (wasFocused) restoreCaret(root, saved);
  }, [ctx]);

  // Mount: build initial DOM
  useEffect(() => {
    rebuild(value, -1);
    valueRef.current = value;
    activeLineRef.current = -1;
  }, []); // eslint-disable-line

  // External value change
  useEffect(() => {
    if (value !== valueRef.current) {
      const root = rootRef.current;
      if (root && document.activeElement !== root) {
        rebuild(value, -1);
        valueRef.current = value;
        activeLineRef.current = -1;
      }
    }
  }, [value, rebuild]);

  // When ctx changes (e.g. link index updated), rebuild without losing focus
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const wasFocused = document.activeElement === root;
    const saved = wasFocused ? saveCaret(root) : null;
    rebuild(valueRef.current, activeLineRef.current);
    if (wasFocused) restoreCaret(root, saved);
  }, [ctx, rebuild]);

  // ===== Selection / input handling =====
  const handleSelectionChange = useCallback(() => {
    const root = rootRef.current;
    if (!root || document.activeElement !== root) return;
    const idx = getCaretLineIndex(root);
    refreshActive(idx);
    maybeShowLinkPicker();
  }, [refreshActive]);

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [handleSelectionChange]);

  const handleInput = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    // Browser may have inserted random tags; normalize structure: ensure each direct child
    // is a div.ml-line. If not (e.g. browser wrapped a paste in a span), wrap it.
    // Simpler: read textContent reliably by serializing children.

    // Build text from children, splitting on <br> within each line.
    const text = readAllText(root);
    const lines = text.split('\n');

    // Save caret BEFORE re-render
    const saved = saveCaret(root);
    const newActive = saved ? saved.lineIndex : -1;

    // Rebuild only lines whose form differs.
    const existing = Array.from(root.querySelectorAll(':scope > .ml-line'));
    if (existing.length !== lines.length) {
      rebuild(text, newActive);
    } else {
      for (let i = 0; i < lines.length; i++) {
        const want = lineHtml(lines[i], i === newActive, ctx);
        const el = existing[i];
        if (el.className !== want.cls) el.className = want.cls;
        if (el.innerHTML !== want.inner) el.innerHTML = want.inner;
      }
    }
    restoreCaret(root, saved);
    activeLineRef.current = newActive;
    valueRef.current = text;
    onChange(text);
    maybeShowLinkPicker();
  }, [ctx, onChange, rebuild]);

  // ===== @-mention link picker =====
  function maybeShowLinkPicker() {
    const root = rootRef.current;
    if (!root) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) { setLinkPicker(null); return; }
    const range = sel.getRangeAt(0);
    if (!root.contains(range.startContainer)) { setLinkPicker(null); return; }

    // Find context: text from start of current line to caret
    const idx = getCaretLineIndex(root);
    if (idx < 0) { setLinkPicker(null); return; }
    const text = readAllText(root);
    const lines = text.split('\n');
    const cur = lines[idx] || '';
    const saved = saveCaret(root);
    const beforeCaret = saved ? cur.slice(0, saved.offset) : cur;

    const m = /(^|[ \t])@(\S[^\n]*|)$/.exec(beforeCaret);
    if (!m) { setLinkPicker(null); return; }
    const query = m[2];

    const rect = range.getClientRects()[0] || range.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    setLinkPicker({
      query,
      x: rect.left - rootRect.left + root.scrollLeft,
      y: rect.bottom - rootRect.top + root.scrollTop + 4,
      lineIndex: idx,
      caretOffset: saved.offset,
      triggerStart: saved.offset - (m[2].length + 1), // back to '@'
    });
  }

  function pickLink(entry) {
    if (!linkPicker) return;
    const root = rootRef.current;
    const text = readAllText(root);
    const lines = text.split('\n');
    const cur = lines[linkPicker.lineIndex];
    // Compute relative href: from currentFolder, we need ../<entry.folder>/<entry.filename>
    // OR (if same folder) entry.filename.
    let href;
    if (entry.folder === currentFolder) href = entry.filename;
    else href = `../${entry.folder}/${entry.filename}`;
    const insertion = `[${entry.title}](${href})`;
    const before = cur.slice(0, linkPicker.triggerStart);
    const after = cur.slice(linkPicker.caretOffset);
    lines[linkPicker.lineIndex] = before + insertion + after;
    const newText = lines.join('\n');
    valueRef.current = newText;
    setLinkPicker(null);
    onChange(newText);
    // Caret goes to end of insertion
    requestAnimationFrame(() => {
      rebuild(newText, linkPicker.lineIndex);
      const r = rootRef.current;
      const lineEl = r.querySelectorAll(':scope > .ml-line')[linkPicker.lineIndex];
      if (lineEl) {
        const targetOffset = before.length + insertion.length;
        let remaining = targetOffset;
        const walker = document.createTreeWalker(lineEl, NodeFilter.SHOW_TEXT);
        let n;
        while ((n = walker.nextNode())) {
          if (remaining <= n.textContent.length) {
            const range = document.createRange();
            range.setStart(n, remaining);
            range.collapse(true);
            const s = window.getSelection();
            s.removeAllRanges();
            s.addRange(range);
            r.focus();
            return;
          }
          remaining -= n.textContent.length;
        }
      }
    });
  }

  // ===== Key handling =====
  function onKeyDown(e) {
    // Quick-Add Note: Cmd/Ctrl+Shift+N
    if (e.key === 'N' && e.shiftKey && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      const sel = window.getSelection();
      const text = sel ? sel.toString() : '';
      onTriggerQuickAdd?.(text);
      return;
    }
    // Link picker keys
    if (linkPicker) {
      if (e.key === 'Escape') { e.preventDefault(); setLinkPicker(null); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        const handled = linkPickerRef.current?.handleKey(e.key);
        if (handled) { e.preventDefault(); }
        return;
      }
    }
    // Click-link with Cmd/Ctrl
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      const sel = window.getSelection();
      const node = sel.anchorNode;
      let cur = node;
      while (cur && cur.nodeType !== 1) cur = cur.parentNode;
      const link = cur?.closest?.('.ml-link');
      if (link?.dataset.href) onOpenLink?.(link.dataset.href);
    }
    // Tab: insert two spaces
    if (e.key === 'Tab') {
      e.preventDefault();
      document.execCommand('insertText', false, '  ');
    }
    // Enter: insert plain newline (don't let browser insert div/p)
    if (e.key === 'Enter') {
      e.preventDefault();
      document.execCommand('insertText', false, '\n');
    }
  }

  // Click handler — Cmd/Ctrl-click on link opens it
  function onClick(e) {
    const link = e.target.closest?.('.ml-link');
    if (link && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onOpenLink?.(link.dataset.href);
    }
  }

  // Filter link index by query
  const filteredLinks = useMemo(() => {
    if (!linkPicker) return [];
    const q = linkPicker.query.toLowerCase().trim();
    if (!q) return linkIndex.slice(0, 8);
    return linkIndex
      .filter(e => e.title.toLowerCase().includes(q) || e.path.toLowerCase().includes(q))
      .slice(0, 8);
  }, [linkPicker, linkIndex]);

  return (
    <div style={{ position: 'relative', flex: '1 1 auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div
        ref={rootRef}
        className="live-editor"
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        onInput={handleInput}
        onKeyDown={onKeyDown}
        onClick={onClick}
      />
      {linkPicker && (
        <LinkPickerDropdown
          ref={linkPickerRef}
          x={linkPicker.x}
          y={linkPicker.y}
          items={filteredLinks}
          onPick={pickLink}
          onClose={() => setLinkPicker(null)}
        />
      )}
    </div>
  );
}

const LinkPickerDropdown = React.forwardRef(function LinkPickerDropdown({ x, y, items, onPick, onClose }, ref) {
  const [selected, setSelected] = useState(0);
  useEffect(() => { setSelected(0); }, [items]);
  React.useImperativeHandle(ref, () => ({
    handleKey(key) {
      if (key === 'ArrowDown') { setSelected(s => Math.min(s + 1, items.length - 1)); return true; }
      if (key === 'ArrowUp') { setSelected(s => Math.max(s - 1, 0)); return true; }
      if (key === 'Enter') { if (items[selected]) onPick(items[selected]); return true; }
      return false;
    },
  }), [items, selected, onPick]);

  if (items.length === 0) {
    return (
      <div className="link-picker" style={{ left: x, top: y }}>
        <div style={{ padding: '10px 12px', color: 'var(--theme-text-muted)', fontSize: 13 }}>No matches</div>
      </div>
    );
  }
  return (
    <div className="link-picker" style={{ left: x, top: y }}>
      {items.map((it, i) => (
        <div
          key={it.path}
          className={`link-picker-row${i === selected ? ' is-selected' : ''}`}
          style={{ '--kind-color': window.NotesData.KIND_COLORS[it.kind] }}
          onMouseDown={(e) => { e.preventDefault(); onPick(it); }}
        >
          <span className="pip" />
          <span className="ttl">{it.title}</span>
          <span className="pth">{it.path}</span>
        </div>
      ))}
    </div>
  );
});

window.LiveEditor = LiveEditor;
