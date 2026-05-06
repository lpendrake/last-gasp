import type { Filter, FilterState } from './types.ts';

const STORAGE_KEY = 'last-gasp-pinned-filters';

export function loadPinnedFilters(): Filter[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isFilterShape).map(f => ({ ...f, pinned: true }));
  } catch {
    return [];
  }
}

export function savePinnedFilters(state: FilterState): void {
  try {
    const pinned = state.filters.filter(f => f.pinned);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pinned));
  } catch {
    // quota/private-mode — silently ignore
  }
}

function isFilterShape(x: unknown): x is Filter {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  if (typeof o.id !== 'string') return false;
  if (o.type === 'tag') return Array.isArray(o.tags);
  if (o.type === 'date') return typeof o.field === 'string';
  return false;
}
