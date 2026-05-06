import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { saveCaret, restoreCaret, getCaretLineIndex, readAllText } from '../editor/markdown/caret.ts';
import { lineHtml, type LineCtx } from '../editor/markdown/line.ts';

export interface UseCaretTrackingDeps {
  rootRef: RefObject<HTMLDivElement>;
  ctx: LineCtx;
  /** Called whenever the caret moves to a new position (selectionchange,
   * after input). Use this to drive the link picker. */
  onCaretMove: () => void;
}

export interface UseCaretTrackingResult {
  /** Index of the currently-active (focused) line, or -1. */
  activeLineRef: RefObject<number>;
  /** Re-render the previously-active and newly-active lines so the
   * `is-active` class moves with the caret. */
  refreshActive: (newActiveIdx: number) => void;
}

/** Wires the document `selectionchange` listener that:
 *   - re-renders the active-line marker when the caret moves
 *   - asks the link picker (via `onCaretMove`) whether to show */
export function useCaretTracking(deps: UseCaretTrackingDeps): UseCaretTrackingResult {
  const { rootRef, ctx, onCaretMove } = deps;
  const activeLineRef = useRef(-1);

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
  }, [ctx, rootRef]);

  useEffect(() => {
    function handleSelectionChange() {
      const root = rootRef.current;
      if (!root || document.activeElement !== root) return;
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return; // don't re-render during drag-select
      refreshActive(getCaretLineIndex(root));
      onCaretMove();
    }
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [refreshActive, onCaretMove, rootRef]);

  return { activeLineRef, refreshActive };
}
