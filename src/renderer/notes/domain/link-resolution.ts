import type { LinkIndexEntry } from '../../../types/global';

export type ResolvedLink =
  | { kind: 'not-found' }
  | { kind: 'event'; filename: string }
  | { kind: 'note'; folder: string; path: string };

export function resolveLinkById(linkIndex: readonly LinkIndexEntry[], id: string): ResolvedLink {
  const entry = linkIndex.find((e) => e.id === id);
  if (!entry) return { kind: 'not-found' };
  if (entry.type === 'event') {
    const filename = entry.path.split('/').slice(1).join('/');
    return { kind: 'event', filename };
  }
  const parts = entry.path.split('/');
  return { kind: 'note', folder: parts[1], path: parts.slice(2).join('/') };
}

export function resolveMarkdownHref(
  linkIndex: readonly LinkIndexEntry[],
  rawUrl: string,
): LinkIndexEntry | null {
  const target = rawUrl.replace(/^\.?\//, '');
  return linkIndex.find((e) => e.path === target || e.path.endsWith('/' + target)) ?? null;
}
