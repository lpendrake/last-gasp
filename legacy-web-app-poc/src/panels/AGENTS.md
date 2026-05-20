# `src/panels/` — Filter, Search, Toolbar (Vanilla DOM)

The chrome around the timeline: filter sidebar, search overlay,
bottom toolbar. Vanilla TypeScript + DOM.

## Layout

```
panels/
  filters/
    types.ts            # FilterState, FilterField
    logic.ts            # applyFilters, matchesFilter, matchesDateFilter
    sidebar.ts          # renderFilterSidebar (UI)
    persistence.ts      # loadPinnedFilters, savePinnedFilters
    filters.test.ts     # logic tests, no DOM
  search.ts
  toolbar.ts            # split into a folder if it crosses 300 lines
```

## Layer rules

- `filters/logic.ts` is pure — no DOM, no `localStorage`. It's the
  closest thing this folder has to domain logic. Tests live next to it
  and cover edge cases without spinning up a DOM.
- `filters/sidebar.ts` is the only file that touches DOM in
  `filters/`. Same pattern as timeline: factory returns
  `{ update, destroy }`.
- `filters/persistence.ts` is the only file that touches
  `localStorage` for filter state.
- `search.ts` and `toolbar.ts` follow the same factory pattern.

## Allowed imports

- `data/ports.ts` types, `data/types.ts`.
- `domain/*` once it exists.
- `calendar/*` for date filtering.
- DOM. No React.

## Add a filter type

1. Extend `FilterState` in `filters/types.ts`.
2. Add the matcher in `filters/logic.ts` and a test in
   `filters.test.ts`.
3. Add the UI control in `filters/sidebar.ts`.
4. If it persists, extend the localStorage schema in
   `filters/persistence.ts` (and bump the key version, e.g.
   `filters.pinned.v2`, with a migration).

## Conventions

- localStorage keys are versioned: `filters.pinned.v1`, etc.
  Migrations on read; never silently drop data.
- Filter logic is pure functions over `FilterState` and an event
  array. It must remain testable without a DOM.

## Don't

- Don't put filter matching logic in the sidebar. Sidebar reads state,
  emits state changes; matching is `logic.ts`.
- Don't read `localStorage` from `sidebar.ts`. The controller in
  `bootstrap/` or `timeline/app.ts` loads via `persistence.ts` and
  passes state in.
