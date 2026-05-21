import type { LinkIndexEntry } from '../../types/global';
import type { WikiLinkSuggestion } from './markdown-editor';

export function suggestLinks(
  linkIndex: readonly LinkIndexEntry[],
  query: string,
): WikiLinkSuggestion[] {
  const q = query.toLowerCase();
  return linkIndex
    .filter((e) => e.title.toLowerCase().includes(q) || e.id.toLowerCase().includes(q))
    .map((e) =>
      e.type === 'asset'
        ? { id: '', label: e.title, detail: e.path, assetPath: e.path }
        : { id: e.id, label: e.title, detail: e.path },
    );
}
