# `src/domain/` — Shared Client Logic

Pure logic shared between the timeline and notes views. No DOM, no
React, no `fetch`.

## What lives here

Eventually:

- `events.ts` — filtering, sorting, conflict detection that both
  timeline cards and notes' "mentioned in" lists need.
- `sessions.ts` — session ordering, current-session detection.
- `links.ts` — link parsing, kind detection (currently inline in
  `LiveEditor.tsx` / `Notes.tsx`).

This folder is empty in Phase 1 and starts being populated in Phase 3,
when shared logic is hoisted out of the view slices.

## Allowed imports

- `data/ports.ts` (types only) and `data/types.ts`.
- `calendar/*` for time math.
- Pure npm packages: `markdown-it`, `js-yaml`.

## Forbidden imports

- `data/http/*`, any view slice, React, DOM, `fetch`.

## Conventions

- All functions pure. No module-level state.
- Take ports as args when they need data; otherwise no dependency on
  data layer at all.
- Tested with Vitest. Prefer table-driven tests for filter/sort logic.

## Don't

- Don't put a function here that's only used by one view slice.
  Premature shared logic is harder to refactor than duplicated logic.
  Hoist when the second caller appears.
