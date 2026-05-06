import { useCallback, useMemo, useRef, useState, type RefObject } from 'react';
import type { LinkIndexEntry } from '../../data/types.ts';
import { saveCaret, restoreCaret, getCaretLineIndex, readAllText } from '../editor/markdown/caret.ts';

const IMAGE_EXTS = /\.(png|jpe?g|gif|webp|svg)$/i;

export interface LinkPickerState {
  query: string;
  x: number;
  y: number;
  lineIndex: number;
  caretOffset: number;
  triggerStart: number;
}

export interface LinkPickerHandle {
  handleKey: (key: string) => boolean;
}

export interface UseLinkPickerDeps {
  rootRef: RefObject<HTMLDivElement>;
  valueRef: RefObject<string>;
  currentFolder: string;
  linkIndex: LinkIndexEntry[];
  currentFolderAssets?: { path: string; title: string }[];
  onChange: (v: string) => void;
  /** Called after picking, to redraw the affected line. */
  rebuild: (text: string, activeIdx: number) => void;
}

export interface UseLinkPickerResult {
  linkPicker: LinkPickerState | null;
  setLinkPicker: (s: LinkPickerState | null) => void;
  linkPickerRef: RefObject<LinkPickerHandle>;
  /** Inspect current caret; show or hide the picker accordingly. */
  maybeShowLinkPicker: () => void;
  /** Top 8 entries matching the current query (assets first). */
  filteredLinks: LinkIndexEntry[];
  /** Insert the picked entry into the editor at the trigger location. */
  pickLink: (entry: LinkIndexEntry) => void;
}

/** State machine for the @-mention link picker. Owns the picker
 * dropdown visibility, queried entries, and the insertion logic. */
export function useLinkPicker(deps: UseLinkPickerDeps): UseLinkPickerResult {
  const { rootRef, valueRef, currentFolder, linkIndex, currentFolderAssets, onChange, rebuild } = deps;
  const [linkPicker, setLinkPicker] = useState<LinkPickerState | null>(null);
  const linkPickerRef = useRef<LinkPickerHandle>(null);

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
  }, [rootRef]);

  const filteredLinks = useMemo(() => {
    if (!linkPicker) return [];
    const assetEntries: LinkIndexEntry[] = (currentFolderAssets ?? []).map(a => ({
      path: a.path, title: a.title, type: 'other' as const,
    }));
    const allEntries = [...assetEntries, ...linkIndex];
    const q = linkPicker.query.toLowerCase().trim();
    if (!q) return allEntries.slice(0, 8);
    return allEntries
      .filter(e => e.title.toLowerCase().includes(q) || e.path.toLowerCase().includes(q))
      .slice(0, 8);
  }, [linkPicker, linkIndex, currentFolderAssets]);

  const pickLink = useCallback((entry: LinkIndexEntry) => {
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
    const isImage = IMAGE_EXTS.test(entry.path);
    const insertion = isImage ? `![${entry.title}](${href})` : `[${entry.title}](${href})`;
    const before = cur.slice(0, linkPicker.triggerStart);
    const after = cur.slice(linkPicker.caretOffset);
    lines[linkPicker.lineIndex] = before + insertion + after;
    const newText = lines.join('\n');
    valueRef.current = newText;
    const lineIdx = linkPicker.lineIndex;
    const targetOffset = before.length + insertion.length;
    setLinkPicker(null);
    onChange(newText);
    requestAnimationFrame(() => {
      rebuild(newText, lineIdx);
      const r = rootRef.current;
      if (!r) return;
      restoreCaret(r, { lineIndex: lineIdx, offset: targetOffset });
      r.focus();
    });
  }, [linkPicker, rootRef, valueRef, currentFolder, onChange, rebuild]);

  return { linkPicker, setLinkPicker, linkPickerRef, maybeShowLinkPicker, filteredLinks, pickLink };
}
