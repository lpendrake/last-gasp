import { useCallback, useEffect, useState } from 'react';
import type { Filter, FilterState } from './types';
import { makeInitialFilterState } from './logic';
import {
  loadPinnedFilters,
  loadSessionFilters,
  savePinnedFilters,
  saveSessionFilters,
} from './persistence';

function buildInitialState(campaignPath: string): FilterState {
  // Session storage takes priority so state survives view switches.
  const session = loadSessionFilters(campaignPath);
  if (session) return session;

  // Fall back to pinned filters from localStorage (loaded but with their saved enabled state).
  const state = makeInitialFilterState();
  for (const f of loadPinnedFilters()) {
    state.filters.push(f);
  }
  return state;
}

export function useFilterState(campaignPath: string) {
  const [filterState, setFilterState] = useState<FilterState>(() =>
    buildInitialState(campaignPath),
  );

  // Reload state when campaign changes (drops non-pinned, restores session or pinned).
  useEffect(() => {
    setFilterState(buildInitialState(campaignPath));
  }, [campaignPath]);

  const mutate = useCallback(
    (updater: (prev: FilterState) => FilterState) => {
      setFilterState((prev) => {
        const next = updater(prev);
        savePinnedFilters(next);
        saveSessionFilters(campaignPath, next);
        return next;
      });
    },
    [campaignPath],
  );

  const addFilter = useCallback(
    (f: Filter) => mutate((prev) => ({ filters: [...prev.filters, f] })),
    [mutate],
  );

  const removeFilter = useCallback(
    (id: string) => mutate((prev) => ({ filters: prev.filters.filter((f) => f.id !== id) })),
    [mutate],
  );

  const toggleFilter = useCallback(
    (id: string) =>
      mutate((prev) => ({
        filters: prev.filters.map((f) => (f.id === id ? { ...f, enabled: !f.enabled } : f)),
      })),
    [mutate],
  );

  const pinFilter = useCallback(
    (id: string) =>
      mutate((prev) => ({
        filters: prev.filters.map((f) => (f.id === id ? { ...f, pinned: !f.pinned } : f)),
      })),
    [mutate],
  );

  const updateFilter = useCallback(
    (updated: Filter) =>
      mutate((prev) => ({
        filters: prev.filters.map((f) => (f.id === updated.id ? updated : f)),
      })),
    [mutate],
  );

  const activeCount = filterState.filters.filter((f) => f.enabled).length;

  return {
    filterState,
    activeCount,
    addFilter,
    removeFilter,
    toggleFilter,
    pinFilter,
    updateFilter,
  };
}
