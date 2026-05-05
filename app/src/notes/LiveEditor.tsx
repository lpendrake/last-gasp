import React, {
  useEffect, useRef, useState, useCallback, useMemo, forwardRef, useImperativeHandle,
} from 'react';
import type { LinkIndexEntry } from '../data/types.ts';
import { folderColor } from './types.ts';
import { lineHtml, type LineCtx } from './editor/markdown/line.ts';
import { saveCaret, restoreCaret, readAllText } from './editor/markdown/caret.ts';
import { uploadPastedImage } from './editor/upload.ts';
import { useCaretTracking } from './hooks/useCaretTracking.ts';
import { useLinkPicker, type LinkPickerHandle } from './hooks/useLinkPicker.ts';

// ---- LiveEditor component ----

const DRAG_MIME = 'application/x-last-gasp-note';
interface NoteDragPayload { folder: string; path: string; kind: 'file' | 'dir' | 'topfolder'; displayName: string; }

interface LiveEditorProps {
  value: string;
  onChange: (v: string) => void;
  currentFolder: string;
  linkIndex: LinkIndexEntry[];
  currentFolderAssets?: { path: string; title: string }[];
  onOpenLink?: (href: string) => void;
  onTriggerQuickAdd?: (sel: string) => void;
}

export function LiveEditor({
  value, onChange, currentFolder, linkIndex, currentFolderAssets, onOpenLink, onTriggerQuickAdd,
}: LiveEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef(value);

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

  const {
    linkPicker, setLinkPicker, linkPickerRef, maybeShowLinkPicker, filteredLinks, pickLink,
  } = useLinkPicker({
    rootRef, valueRef, currentFolder, linkIndex, currentFolderAssets, onChange, rebuild,
  });

  const { activeLineRef } = useCaretTracking({
    rootRef, ctx, onCaretMove: maybeShowLinkPicker,
  });

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
  }, [value, rebuild, activeLineRef]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const wasFocused = document.activeElement === root;
    const saved = wasFocused ? saveCaret(root) : null;
    rebuild(valueRef.current, activeLineRef.current);
    if (wasFocused) restoreCaret(root, saved);
  }, [ctx, rebuild, activeLineRef]);

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

  const handlePaste = useCallback(async (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (!Array.from(e.clipboardData.items).some(it => it.type.startsWith('image/'))) return;
    e.preventDefault();
    const root = rootRef.current;
    const caret = root ? saveCaret(root) : null;
    try {
      const result = await uploadPastedImage(e.clipboardData, currentFolder);
      if (!result || !root) return;
      const lines = readAllText(root).split('\n');
      const lineIdx = caret?.lineIndex ?? Math.max(0, lines.length - 1);
      const offset = caret?.offset ?? (lines[lineIdx]?.length ?? 0);
      lines[lineIdx] = (lines[lineIdx] ?? '').slice(0, offset) + result.markdown + (lines[lineIdx] ?? '').slice(offset);
      const newText = lines.join('\n');
      valueRef.current = newText;
      onChange(newText);
      rebuild(newText, lineIdx);
      requestAnimationFrame(() => {
        restoreCaret(root, { lineIndex: lineIdx, offset: offset + result.advance });
      });
    } catch (err) {
      console.error('Image paste failed', err);
    }
  }, [currentFolder, onChange, rebuild]);

  function caretAtPoint(x: number, y: number): { node: Node; offset: number } | null {
    if ('caretRangeFromPoint' in document) {
      const range = (document as any).caretRangeFromPoint(x, y) as Range | null;
      if (!range) return null;
      return { node: range.startContainer, offset: range.startOffset };
    }
    if ('caretPositionFromPoint' in document) {
      const pos = (document as any).caretPositionFromPoint(x, y);
      if (!pos) return null;
      return { node: pos.offsetNode, offset: pos.offset };
    }
    return null;
  }

  function nodeOffsetToCaretPos(root: HTMLElement, node: Node, offset: number): { lineIndex: number; offset: number } | null {
    const lines = Array.from(root.querySelectorAll<HTMLElement>(':scope > .ml-line'));
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].contains(node) && lines[i] !== node) continue;
      let charOffset = 0;
      const walker = document.createTreeWalker(lines[i], NodeFilter.SHOW_TEXT);
      let n: Node | null;
      while ((n = walker.nextNode())) {
        if (n === node) { charOffset += offset; return { lineIndex: i, offset: charOffset }; }
        charOffset += n.textContent?.length ?? 0;
      }
      return { lineIndex: i, offset: charOffset };
    }
    return null;
  }

  function handleDropNote(clientX: number, clientY: number, payload: NoteDragPayload) {
    const root = rootRef.current;
    if (!root) return;
    const at = caretAtPoint(clientX, clientY);
    const caret = at ? nodeOffsetToCaretPos(root, at.node, at.offset) : null;
    let insertion: string;
    if (payload.kind === 'file') {
      const srcFolder = payload.folder;
      const href = srcFolder === currentFolder
        ? payload.path
        : `../${srcFolder}/${payload.path}`;
      insertion = `[${payload.displayName}](${href})`;
    } else {
      insertion = payload.kind === 'topfolder' ? payload.folder : `${payload.folder}/${payload.path}`;
    }
    const text = readAllText(root);
    const lines = text.split('\n');
    const lineIdx = caret?.lineIndex ?? Math.max(0, lines.length - 1);
    const charOff = caret?.offset ?? (lines[lineIdx]?.length ?? 0);
    const line = lines[lineIdx] ?? '';
    lines[lineIdx] = line.slice(0, charOff) + insertion + line.slice(charOff);
    const newText = lines.join('\n');
    valueRef.current = newText;
    onChange(newText);
    rebuild(newText, lineIdx);
    requestAnimationFrame(() => {
      restoreCaret(root, { lineIndex: lineIdx, offset: charOff + insertion.length });
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
        onPaste={handlePaste}
        onDragOver={(e) => { if (e.dataTransfer.types.includes(DRAG_MIME)) { e.preventDefault(); e.dataTransfer.dropEffect = 'link'; } }}
        onDrop={(e) => { const raw = e.dataTransfer.getData(DRAG_MIME); if (!raw) return; e.preventDefault(); const payload: NoteDragPayload = JSON.parse(raw); handleDropNote(e.clientX, e.clientY, payload); }}
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
