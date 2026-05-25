import type { EntityIndexEntry } from '../../types/global';
import { showPeek, type PeekHandle } from './show';
import { resolvePeekTarget } from './resolve';
import { buildEntityLabelMap } from '../../shared/entity-labels';

const OPEN_DELAY_MS = 150;
const CLOSE_DELAY_MS = 250;
const MAX_DEPTH = 5;

interface StackEntry {
  handle: PeekHandle;
  sourceLink: HTMLElement;
}

let stack: StackEntry[] = [];
let pinned: PeekHandle[] = [];
let openTimer: ReturnType<typeof setTimeout> | null = null;
let closeTimer: ReturnType<typeof setTimeout> | null = null;
let stackConfig: PeekStackConfig | null = null;

export interface PeekStackConfig {
  fetcher: (path: string, signal: AbortSignal) => Promise<string>;
  getEntityIndex: () => readonly EntityIndexEntry[];
  onOpenById?: (id: string) => void;
}

function cancelOpen() {
  if (openTimer !== null) {
    clearTimeout(openTimer);
    openTimer = null;
  }
}

function cancelClose() {
  if (closeTimer !== null) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
}

function isLive(el: Element | null): boolean {
  if (!el) return false;
  if (el.closest('.peek-window')) return true;

  // CM6 wiki-link decoration spans
  const cmLink = el.closest<HTMLElement>('.cm-note-link');
  if (cmLink) {
    const noteId = cmLink.dataset.noteId;
    return !!noteId && resolvePeekTarget(noteId, '', stackConfig?.getEntityIndex() ?? []) !== null;
  }

  // Plain <a href> links in rendered HTML (e.g. markdown preview surfaces with data-base-dir)
  const a = el.closest('a[href]') as HTMLAnchorElement | null;
  if (!a) return false;
  const baseDir = a.closest('[data-base-dir]')?.getAttribute('data-base-dir') ?? '';
  if (!baseDir) return false;
  return (
    resolvePeekTarget(
      a.getAttribute('href') ?? '',
      baseDir,
      stackConfig?.getEntityIndex() ?? [],
    ) !== null
  );
}

function closeStack() {
  for (const e of stack) e.handle.close();
  stack = [];
}

function openWindow(path: string, anchor: HTMLElement, depth: number) {
  if (depth < stack.length && stack[depth].handle.path === path) {
    while (stack.length > depth + 1) stack.pop()!.handle.close();
    return;
  }

  while (stack.length > depth) stack.pop()!.handle.close();

  const entityLabels = buildEntityLabelMap(stackConfig!.getEntityIndex());

  const handle = showPeek({
    targetEl: anchor,
    linkInfo: { path },
    fetcher: stackConfig!.fetcher,
    onOpenById: stackConfig!.onOpenById,
    entityLabels,
    stackDepth: Math.min(depth, MAX_DEPTH - 1),
    onPin: () => {
      stack = stack.filter((e) => e.handle !== handle);
      pinned.push(handle);
    },
    onClose: () => {
      stack = stack.filter((e) => e.handle !== handle);
      pinned = pinned.filter((p) => p !== handle);
    },
  });

  stack.push({ handle, sourceLink: anchor });
}

function computeDepth(anchor: HTMLElement): number {
  const windowEl = anchor.closest('.peek-window') as HTMLElement | null;
  if (!windowEl) return 0;
  const idx = stack.findIndex((e) => e.handle.el === windowEl);
  return idx >= 0 ? idx + 1 : 0;
}

function scheduleOpen(path: string, anchor: HTMLElement) {
  const depth = computeDepth(anchor);
  openTimer = setTimeout(() => {
    openTimer = null;
    openWindow(path, anchor, depth);
  }, OPEN_DELAY_MS);
}

function scheduleClose() {
  if (stack.length > 0 && closeTimer === null) {
    closeTimer = setTimeout(() => {
      closeTimer = null;
      closeStack();
    }, CLOSE_DELAY_MS);
  }
}

function handleOver(e: MouseEvent) {
  const target = e.target as Element;
  if (target.closest('.peek-window')) cancelClose();

  // CM6 wiki-link span
  const cmLink = target.closest<HTMLElement>('.cm-note-link');
  if (cmLink) {
    const noteId = cmLink.dataset.noteId;
    if (!noteId) return;
    const peekTarget = resolvePeekTarget(noteId, '', stackConfig?.getEntityIndex() ?? []);
    if (!peekTarget) return;
    cancelClose();
    cancelOpen();
    scheduleOpen(peekTarget.path, cmLink);
    return;
  }

  // Plain <a href> links in rendered HTML surfaces that carry data-base-dir
  const a = target.closest('a[href]') as HTMLAnchorElement | null;
  if (!a) return;
  const baseDir = a.closest('[data-base-dir]')?.getAttribute('data-base-dir') ?? '';
  if (!baseDir) return;
  const peekTarget = resolvePeekTarget(
    a.getAttribute('href') ?? '',
    baseDir,
    stackConfig?.getEntityIndex() ?? [],
  );
  if (!peekTarget) return;
  cancelClose();
  cancelOpen();
  scheduleOpen(peekTarget.path, a);
}

function handleOut(e: MouseEvent) {
  if (isLive(e.relatedTarget as Element | null)) return;
  cancelOpen();
  scheduleClose();
}

function handleKey(e: KeyboardEvent) {
  if (e.key !== 'Escape' || stack.length === 0) return;
  e.stopImmediatePropagation();
  stack.pop()!.handle.close();
}

export function initPeek(config: PeekStackConfig): void {
  if (stackConfig !== null) teardownPeek();
  stackConfig = config;
  document.addEventListener('mouseover', handleOver);
  document.addEventListener('mouseout', handleOut);
  window.addEventListener('keydown', handleKey);
}

export function teardownPeek(): void {
  document.removeEventListener('mouseover', handleOver);
  document.removeEventListener('mouseout', handleOut);
  window.removeEventListener('keydown', handleKey);
  cancelOpen();
  cancelClose();
  closeStack();
  pinned.forEach((p) => p.close());
  pinned = [];
  stackConfig = null;
}

export function openFromWikiLink(id: string, el: HTMLElement): void {
  if (!stackConfig) return;
  const peekTarget = resolvePeekTarget(id, '', stackConfig.getEntityIndex());
  if (!peekTarget) return;
  cancelClose();
  cancelOpen();
  scheduleOpen(peekTarget.path, el);
}

export function closeFromWikiLink(relatedTarget: Element | null): void {
  if (!stackConfig) return;
  if (isLive(relatedTarget)) return;
  cancelOpen();
  scheduleClose();
}
