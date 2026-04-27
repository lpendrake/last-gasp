import React, {
  useEffect, useRef, useState, useCallback, useMemo, forwardRef, useImperativeHandle,
} from 'react';
import type { LinkIndexEntry } from '../data/types.ts';
import { folderColor } from './types.ts';

// ---- HTML helpers ----

function escHtml(s: string): string {
  return s.replace(/[&<>"]/g, c =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;',
  );
}

function kindFromPath(
  href: string, currentFolder: string, linkIndex: LinkIndexEntry[],
): string {
  if (!href) return 'broken';
  let folder = currentFolder;
  let m = /^\.\.\/([^/]+)\/(.+)$/.exec(href);
  if (m) { folder = m[1]; }
  else if ((m = /^([^/]+)\/(.+)$/.exec(href))) { folder = m[1]; }
  // Check existence via link index
  const target = href.replace(/^\.\.\//, '');
  const found = linkIndex.some(e => e.path === target || e.path === `${folder}/${href.split('/').pop()}`);
  if (!found && href.includes('/')) return 'broken';
  return folder;
}

function renderInline(
  text: string,
  opts: { active: boolean; currentFolder: string; linkIndex: LinkIndexEntry[] },
): string {
  const { active, currentFolder, linkIndex } = opts;
  let out = '';
  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);

    // Link: [text](url)
    let m: RegExpMatchArray | null = rest.match(/^\[([^\]\n]+)\]\(([^)\n]+)\)/);
    if (m) {
      const label = m[1];
      const href = m[2];
      const kind = kindFromPath(href, currentFolder, linkIndex);
      const hrefEsc = escHtml(href);
      if (active) {
        out += `<span class="ml-marker is-hideable">[</span>`
          + `<span class="ml-link kind-${escHtml(kind)}" data-href="${hrefEsc}">${escHtml(label)}</span>`
          + `<span class="ml-marker is-hideable">](${hrefEsc})</span>`;
      } else {
        out += `<span class="ml-marker is-hideable">[</span>`
          + `<span class="ml-link kind-${escHtml(kind)}" data-href="${hrefEsc}">${escHtml(label)}</span>`
          + `<span class="ml-marker is-hideable">](${hrefEsc})</span>`;
      }
      i += m[0].length;
      continue;
    }

    // Bold: **text**
    m = rest.match(/^\*\*([^*\n]+)\*\*/);
    if (m) {
      out += `<span class="ml-marker is-hideable">**</span>`
        + `<span class="ml-bold">${escHtml(m[1])}</span>`
        + `<span class="ml-marker is-hideable">**</span>`;
      i += m[0].length;
      continue;
    }

    // Italic: *text*
    m = rest.match(/^\*([^*\n]+)\*/);
    if (m && rest[0] === '*' && rest[1] !== '*') {
      out += `<span class="ml-marker is-hideable">*</span>`
        + `<span class="ml-italic">${escHtml(m[1])}</span>`
        + `<span class="ml-marker is-hideable">*</span>`;
      i += m[0].length;
      continue;
    }

    // Inline code: `text`
    m = rest.match(/^`([^`\n]+)`/);
    if (m) {
      out += `<span class="ml-marker is-hideable">\`</span>`
        + `<span class="ml-code">${escHtml(m[1])}</span>`
        + `<span class="ml-marker is-hideable">\`</span>`;
      i += m[0].length;
      continue;
    }

    const next = rest.search(/[\[*`]/);
    const chunk = next === -1 ? rest : rest.slice(0, next || 1);
    out += escHtml(chunk);
    i += chunk.length;
  }
  return out;
}

type ClassifiedLine =
  | { kind: 'heading'; level: number; marker: string; body: string }
  | { kind: 'bullet'; marker: string; body: string }
  | { kind: 'quote'; marker: string; body: string }
  | { kind: 'table-sep'; marker: string; body: string }
  | { kind: 'table-row'; marker: string; body: string }
  | { kind: 'blank'; marker: string; body: string }
  | { kind: 'para'; marker: string; body: string };

function classifyLine(text: string): ClassifiedLine {
  let m: RegExpMatchArray | null;
  m = text.match(/^(#{1,6})\s+(.*)$/);
  if (m) return { kind: 'heading', level: m[1].length, marker: m[1] + ' ', body: m[2] };
  m = text.match(/^(\s*[-*+]\s+)(.*)$/);
  if (m) return { kind: 'bullet', marker: m[1], body: m[2] };
  m = text.match(/^(>\s?)(.*)$/);
  if (m) return { kind: 'quote', marker: m[1], body: m[2] };
  // Table separator (| --- | :--- | ---: |) — check before table-row
  if (/^\|([ \t]*:?-+:?[ \t]*\|)+\s*$/.test(text)) return { kind: 'table-sep', marker: '', body: text };
  // Table row: starts with | and has at least one more |
  if (/^\|.+\|/.test(text)) return { kind: 'table-row', marker: '', body: text };
  if (text.trim() === '') return { kind: 'blank', marker: '', body: '' };
  return { kind: 'para', marker: '', body: text };
}

// Renders a table row or sep as pipe+cell spans. Pipes use display:none in CSS
// but remain in the DOM so textContent === original markdown text.
function renderTableCells(text: string, ctx: LineCtx): string {
  const parts = text.split('|');
  let html = '';
  for (let i = 0; i < parts.length; i++) {
    if (i === 0) {
      if (parts[i]) html += escHtml(parts[i]);
    } else {
      html += '<span class="ml-pipe">|</span>';
      const isTrailingEmpty = i === parts.length - 1 && !parts[i].trim();
      if (!isTrailingEmpty) {
        html += `<span class="ml-tcell">${renderInline(parts[i], { active: false, ...ctx })}</span>`;
      }
    }
  }
  return html;
}

interface LineCtx { currentFolder: string; linkIndex: LinkIndexEntry[] }

function lineHtml(text: string, active: boolean, ctx: LineCtx): { cls: string; inner: string } {
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
  } else if (c.kind === 'table-sep') {
    cls += ' is-table-sep';
    if (active) { cls += ' is-active'; inner = escHtml(text); }
    else inner = renderTableCells(text, ctx);
  } else if (c.kind === 'table-row') {
    cls += ' is-table-row';
    if (active) { cls += ' is-active'; inner = escHtml(text); }
    else inner = renderTableCells(text, ctx);
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

// ---- Caret helpers ----

function getCaretLineIndex(root: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return -1;
  const range = sel.getRangeAt(0);
  let node: Node | null = range.startContainer;
  while (node && node !== root) {
    if (node.nodeType === 1 && (node as Element).classList?.contains('ml-line')) break;
    node = node.parentNode;
  }
  if (!node || node === root) return -1;
  const lines = Array.from(root.querySelectorAll<HTMLElement>(':scope > .ml-line'));
  return lines.indexOf(node as HTMLElement);
}

function readAllText(root: HTMLElement): string {
  const lines = Array.from(root.querySelectorAll<HTMLElement>(':scope > .ml-line'));
  return lines.map(el => el.textContent?.replace(/\n/g, '') ?? '').join('\n');
}

interface CaretPos { lineIndex: number; offset: number }

function saveCaret(root: HTMLElement): CaretPos | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  const lines = Array.from(root.querySelectorAll<HTMLElement>(':scope > .ml-line'));
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.contains(range.startContainer) || line === range.startContainer) {
      let offset = 0;
      const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
      let n: Node | null;
      while ((n = walker.nextNode())) {
        if (n === range.startContainer) { offset += range.startOffset; return { lineIndex: i, offset }; }
        offset += (n.textContent?.length ?? 0);
      }
      return { lineIndex: i, offset };
    }
  }
  return null;
}

function restoreCaret(root: HTMLElement, saved: CaretPos | null) {
  if (!saved) return;
  const lines = Array.from(root.querySelectorAll<HTMLElement>(':scope > .ml-line'));
  const line = lines[saved.lineIndex];
  if (!line) return;
  let remaining = saved.offset;
  const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const len = n.textContent?.length ?? 0;
    if (remaining <= len) {
      const range = document.createRange();
      range.setStart(n, remaining);
      range.collapse(true);
      const sel = window.getSelection();
      if (sel) { sel.removeAllRanges(); sel.addRange(range); }
      return;
    }
    remaining -= len;
  }
  const range = document.createRange();
  range.selectNodeContents(line);
  range.collapse(false);
  const sel = window.getSelection();
  if (sel) { sel.removeAllRanges(); sel.addRange(range); }
}

// ---- LiveEditor component ----

interface LiveEditorProps {
  value: string;
  onChange: (v: string) => void;
  currentFolder: string;
  linkIndex: LinkIndexEntry[];
  onOpenLink?: (href: string) => void;
  onTriggerQuickAdd?: (sel: string) => void;
}

export function LiveEditor({
  value, onChange, currentFolder, linkIndex, onOpenLink, onTriggerQuickAdd,
}: LiveEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef(value);
  const activeLineRef = useRef(-1);
  const [linkPicker, setLinkPicker] = useState<LinkPickerState | null>(null);
  const linkPickerRef = useRef<LinkPickerHandle>(null);

  const ctx = useMemo<LineCtx>(() => ({ currentFolder, linkIndex }), [currentFolder, linkIndex]);

  const rebuild = useCallback((text: string, activeIdx: number) => {
    const root = rootRef.current;
    if (!root) return;
    const lines = text.split('\n');
    root.innerHTML = lines.map((ln, i) => {
      const { cls, inner } = lineHtml(ln, i === activeIdx, ctx);
      return `<div class="${cls}" data-li="${i}">${inner}</div>`;
    }).join('');
  }, [ctx]);

  const refreshActive = useCallback((newActiveIdx: number) => {
    const root = rootRef.current;
    if (!root) return;
    if (newActiveIdx === activeLineRef.current) return;
    const lines = Array.from(root.querySelectorAll<HTMLElement>(':scope > .ml-line'));
    const text = readAllText(root);
    const txtLines = text.split('\n');
    const wasFocused = document.activeElement === root;
    const saved = wasFocused ? saveCaret(root) : null;
    if (activeLineRef.current >= 0 && lines[activeLineRef.current]) {
      const ln = lines[activeLineRef.current];
      const txt = txtLines[activeLineRef.current] ?? '';
      const { cls, inner } = lineHtml(txt, false, ctx);
      ln.className = cls; ln.innerHTML = inner;
    }
    if (newActiveIdx >= 0 && lines[newActiveIdx]) {
      const ln = lines[newActiveIdx];
      const txt = txtLines[newActiveIdx] ?? '';
      const { cls, inner } = lineHtml(txt, true, ctx);
      ln.className = cls; ln.innerHTML = inner;
    }
    activeLineRef.current = newActiveIdx;
    if (wasFocused) restoreCaret(root, saved);
  }, [ctx]);

  useEffect(() => {
    rebuild(value, -1);
    valueRef.current = value;
    activeLineRef.current = -1;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const wasFocused = document.activeElement === root;
    const saved = wasFocused ? saveCaret(root) : null;
    rebuild(valueRef.current, activeLineRef.current);
    if (wasFocused) restoreCaret(root, saved);
  }, [ctx, rebuild]);

  const maybeShowLinkPicker = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) { setLinkPicker(null); return; }
    const range = sel.getRangeAt(0);
    if (!root.contains(range.startContainer)) { setLinkPicker(null); return; }
    const idx = getCaretLineIndex(root);
    if (idx < 0) { setLinkPicker(null); return; }
    const text = readAllText(root);
    const lines = text.split('\n');
    const cur = lines[idx] ?? '';
    const saved = saveCaret(root);
    const beforeCaret = saved ? cur.slice(0, saved.offset) : cur;
    const m = /(^|[ \t])@(\S[^\n]*|)$/.exec(beforeCaret);
    if (!m) { setLinkPicker(null); return; }
    const rect = range.getClientRects()[0] ?? range.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    setLinkPicker({
      query: m[2],
      x: rect.left - rootRect.left + root.scrollLeft,
      y: rect.bottom - rootRect.top + root.scrollTop + 4,
      lineIndex: idx,
      caretOffset: saved?.offset ?? 0,
      triggerStart: (saved?.offset ?? 0) - (m[2].length + 1),
    });
  }, []);

  const handleSelectionChange = useCallback(() => {
    const root = rootRef.current;
    if (!root || document.activeElement !== root) return;
    refreshActive(getCaretLineIndex(root));
    maybeShowLinkPicker();
  }, [refreshActive, maybeShowLinkPicker]);

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [handleSelectionChange]);

  const handleInput = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const text = readAllText(root);
    const lines = text.split('\n');
    const saved = saveCaret(root);
    const newActive = saved ? saved.lineIndex : -1;
    const existing = Array.from(root.querySelectorAll<HTMLElement>(':scope > .ml-line'));
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
  }, [ctx, onChange, rebuild, maybeShowLinkPicker]);

  function pickLink(entry: LinkIndexEntry) {
    if (!linkPicker) return;
    const root = rootRef.current;
    if (!root) return;
    const text = readAllText(root);
    const lines = text.split('\n');
    const cur = lines[linkPicker.lineIndex] ?? '';
    // Compute relative href
    const entryFolder = entry.path.split('/')[0];
    const href = entryFolder === currentFolder
      ? entry.path.split('/').slice(1).join('/')
      : `../${entry.path}`;
    const insertion = `[${entry.title}](${href})`;
    const before = cur.slice(0, linkPicker.triggerStart);
    const after = cur.slice(linkPicker.caretOffset);
    lines[linkPicker.lineIndex] = before + insertion + after;
    const newText = lines.join('\n');
    valueRef.current = newText;
    setLinkPicker(null);
    onChange(newText);
    requestAnimationFrame(() => {
      rebuild(newText, linkPicker.lineIndex);
      const r = rootRef.current;
      if (!r) return;
      const lineEl = r.querySelectorAll<HTMLElement>(':scope > .ml-line')[linkPicker.lineIndex];
      if (!lineEl) return;
      const targetOffset = before.length + insertion.length;
      let remaining = targetOffset;
      const walker = document.createTreeWalker(lineEl, NodeFilter.SHOW_TEXT);
      let n: Node | null;
      while ((n = walker.nextNode())) {
        const len = n.textContent?.length ?? 0;
        if (remaining <= len) {
          const range = document.createRange();
          range.setStart(n, remaining);
          range.collapse(true);
          const s = window.getSelection();
          if (s) { s.removeAllRanges(); s.addRange(range); }
          r.focus();
          return;
        }
        remaining -= len;
      }
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'N' && e.shiftKey && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      const sel = window.getSelection();
      onTriggerQuickAdd?.(sel?.toString() ?? '');
      return;
    }
    if (linkPicker) {
      if (e.key === 'Escape') { e.preventDefault(); setLinkPicker(null); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        const handled = linkPickerRef.current?.handleKey(e.key);
        if (handled) e.preventDefault();
        return;
      }
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      const sel = window.getSelection();
      let cur: Node | null = sel?.anchorNode ?? null;
      while (cur && cur.nodeType !== 1) cur = cur.parentNode;
      const link = (cur as Element | null)?.closest?.('.ml-link') as HTMLElement | null;
      if (link?.dataset.href) onOpenLink?.(link.dataset.href);
    }
    if (e.key === 'Tab') { e.preventDefault(); document.execCommand('insertText', false, '  '); }
    if (e.key === 'Enter') { e.preventDefault(); document.execCommand('insertText', false, '\n'); }
  }

  function onClick(e: React.MouseEvent<HTMLDivElement>) {
    const link = (e.target as Element).closest?.('.ml-link') as HTMLElement | null;
    if (link && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onOpenLink?.(link.dataset.href ?? ''); }
  }

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

// ---- LinkPickerDropdown ----

interface LinkPickerState {
  query: string;
  x: number;
  y: number;
  lineIndex: number;
  caretOffset: number;
  triggerStart: number;
}

interface LinkPickerHandle {
  handleKey: (key: string) => boolean;
}

interface LinkPickerDropdownProps {
  x: number;
  y: number;
  items: LinkIndexEntry[];
  onPick: (entry: LinkIndexEntry) => void;
  onClose: () => void;
}

const LinkPickerDropdown = forwardRef<LinkPickerHandle, LinkPickerDropdownProps>(
  function LinkPickerDropdown({ x, y, items, onPick, onClose: _onClose }, ref) {
    const [selected, setSelected] = useState(0);
    useEffect(() => { setSelected(0); }, [items]);
    useImperativeHandle(ref, () => ({
      handleKey(key: string): boolean {
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
        {items.map((it, i) => {
          const folder = it.path.split('/')[0];
          return (
            <div
              key={it.path}
              className={`link-picker-row${i === selected ? ' is-selected' : ''}`}
              style={{ '--kind-color': folderColor(folder) } as React.CSSProperties}
              onMouseDown={(e) => { e.preventDefault(); onPick(it); }}
            >
              <span className="pip" />
              <span className="ttl">{it.title}</span>
              <span className="pth">{it.path}</span>
            </div>
          );
        })}
      </div>
    );
  },
);
