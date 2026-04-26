import { resolveHref } from './resolve.ts';
import { PeekWindow } from './window.ts';

const OPEN_DELAY_MS = 150;
const CLOSE_DELAY_MS = 250;
const MAX_DEPTH = 5;

interface StackEntry {
  win: PeekWindow;
  sourceLink: HTMLElement;
}

let stack: StackEntry[] = [];
let pinned: PeekWindow[] = [];
let openTimer: ReturnType<typeof setTimeout> | null = null;
let closeTimer: ReturnType<typeof setTimeout> | null = null;

function cancelOpen() {
  if (openTimer !== null) { clearTimeout(openTimer); openTimer = null; }
}
function cancelClose() {
  if (closeTimer !== null) { clearTimeout(closeTimer); closeTimer = null; }
}

function isLive(el: Element | null): boolean {
  if (!el) return false;
  if (el.closest('.peek-window')) return true;
  const a = el.closest('a[href]') as HTMLAnchorElement | null;
  if (!a) return false;
  const baseDir = a.closest('[data-base-dir]')?.getAttribute('data-base-dir') ?? '';
  return baseDir !== '' && resolveHref(a.getAttribute('href') ?? '', baseDir) !== null;
}

function resolveLink(a: HTMLAnchorElement): string | null {
  const baseDir = a.closest('[data-base-dir]')?.getAttribute('data-base-dir') ?? '';
  if (!baseDir) return null;
  return resolveHref(a.getAttribute('href') ?? '', baseDir);
}

function closeStack() {
  for (const e of stack) e.win.close();
  stack = [];
}

function openWindow(repoPath: string, anchor: HTMLElement, depth: number) {
  // If already showing this path at this depth, just prune any deeper windows.
  if (depth < stack.length && stack[depth].win.repoPath === repoPath) {
    while (stack.length > depth + 1) stack.pop()!.win.close();
    return;
  }

  // Truncate stack at this depth then create the new window.
  while (stack.length > depth) stack.pop()!.win.close();

  const w = new PeekWindow({
    repoPath,
    anchorEl: anchor,
    stackDepth: Math.min(depth, MAX_DEPTH - 1),
    onPin: (win) => {
      stack = stack.filter(e => e.win !== win);
      pinned.push(win);
    },
    onClose: (win) => {
      stack = stack.filter(e => e.win !== win);
      pinned = pinned.filter(p => p !== win);
    },
  });

  stack.push({ win: w, sourceLink: anchor });
}

export function initPeek(): void {
  document.addEventListener('mouseover', handleOver);
  document.addEventListener('mouseout', handleOut);
  window.addEventListener('keydown', handleKey);

  // Ctrl+click on a qualifying link pins a window immediately.
  document.addEventListener('click', (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    const a = (e.target as Element).closest('a[href]') as HTMLAnchorElement | null;
    if (!a) return;
    const repoPath = resolveLink(a);
    if (!repoPath) return;
    e.preventDefault();
    const w = new PeekWindow({
      repoPath,
      anchorEl: a,
      stackDepth: 0,
      onPin: () => {},
      onClose: (win) => { pinned = pinned.filter(p => p !== win); },
    });
    w.pin();
    pinned.push(w);
  }, true); // capture so we intercept before the browser follows the link
}

function handleOver(e: MouseEvent) {
  const target = e.target as Element;
  const inWindow = !!target.closest('.peek-window');

  if (inWindow) cancelClose();

  const a = target.closest('a[href]') as HTMLAnchorElement | null;
  if (!a) return;
  const repoPath = resolveLink(a);
  if (!repoPath) return;

  cancelClose();
  cancelOpen();

  const windowEl = a.closest('.peek-window') as HTMLElement | null;
  let depth = 0;
  if (windowEl) {
    const idx = stack.findIndex(e => e.win.el === windowEl);
    depth = idx >= 0 ? idx + 1 : 0;
  }

  openTimer = setTimeout(() => {
    openTimer = null;
    openWindow(repoPath, a, depth);
  }, OPEN_DELAY_MS);
}

function handleOut(e: MouseEvent) {
  if (isLive(e.relatedTarget as Element | null)) return;
  cancelOpen();
  if (stack.length > 0 && closeTimer === null) {
    closeTimer = setTimeout(() => {
      closeTimer = null;
      closeStack();
    }, CLOSE_DELAY_MS);
  }
}

function handleKey(e: KeyboardEvent) {
  if (e.key !== 'Escape' || stack.length === 0) return;
  // Grab Esc before modals when a peek is visible (initPeek registers first).
  e.stopImmediatePropagation();
  stack.pop()!.win.close();
}
