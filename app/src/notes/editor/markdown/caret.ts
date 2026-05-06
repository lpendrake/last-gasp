/** Caret tracking helpers for the contentEditable live editor.
 *
 * The editor renders one `<div class="ml-line">` per line of source.
 * `getCaretLineIndex` finds which line the caret is in;
 * `saveCaret` / `restoreCaret` snapshot caret position across
 * a re-render that rebuilds those line elements. */

export interface CaretPos { lineIndex: number; offset: number }

/** Index of the `.ml-line` containing the current caret, or -1 if
 * the selection is outside the editor root. */
export function getCaretLineIndex(root: HTMLElement): number {
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

/** Reconstruct the editor's source text from the live DOM. Strips
 * any embedded newlines inside a line (browsers sometimes inject
 * literal `\n` text nodes around block elements). */
export function readAllText(root: HTMLElement): string {
  const lines = Array.from(root.querySelectorAll<HTMLElement>(':scope > .ml-line'));
  return lines.map(el => el.textContent?.replace(/\n/g, '') ?? '').join('\n');
}

/** Snapshot the caret as a (line index, offset within line) pair. */
export function saveCaret(root: HTMLElement): CaretPos | null {
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

/** Restore a snapshot taken by `saveCaret` after a re-render. */
export function restoreCaret(root: HTMLElement, saved: CaretPos | null) {
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
