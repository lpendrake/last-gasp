import type { Filter, FilterState } from './types';

const STORAGE_KEY = 'last-gasp-pinned-filters';
const SESSION_KEY = 'last-gasp-session-filters';

export function loadPinnedFilters(): Filter[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isFilterShape).map((f) => ({ ...f, pinned: true }));
  } catch {
    return [];
  }
}

export function savePinnedFilters(state: FilterState): void {
  try {
    const pinned = state.filters.filter((f) => f.pinned);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pinned));
  } catch {
    // quota / private-mode — silently ignore
  }
}

export function loadSessionFilters(campaignPath: string): FilterState | null {
  try {
    const raw = sessionStorage.getItem(`${SESSION_KEY}:${campaignPath}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      Array.isArray((parsed as Record<string, unknown>).filters)
    ) {
      return parsed as FilterState;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveSessionFilters(campaignPath: string, state: FilterState): void {
  try {
    sessionStorage.setItem(`${SESSION_KEY}:${campaignPath}`, JSON.stringify(state));
  } catch {
    // quota / private-mode — silently ignore
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
