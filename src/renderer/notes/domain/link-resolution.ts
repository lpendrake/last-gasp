import type { EntityIndexEntry } from '../../../types/global';

export type ResolvedLink =
  | { kind: 'not-found' }
  | { kind: 'event'; filename: string }
  | { kind: 'note'; folder: string; path: string };

export function resolveLinkById(entityIndex: readonly EntityIndexEntry[], id: string): ResolvedLink {
  const entry = entityIndex.find((e) => e.id === id);
  if (!entry) return { kind: 'not-found' };
  if (entry.type === 'event') {
    const filename = entry.path.split('/').slice(1).join('/');
    return { kind: 'event', filename };
  }
  const parts = entry.path.split('/');
  return { kind: 'note', folder: parts[1], path: parts.slice(2).join('/') };
}

export function resolveMarkdownHref(
  entityIndex: readonly EntityIndexEntry[],
  rawUrl: string,
): EntityIndexEntry | null {
  const target = rawUrl.replace(/^\.?\//, '');
  return entityIndex.find((e) => e.path === target || e.path.endsWith('/' + target)) ?? null;
}
