# `src/domain/` — Shared Client Logic

Pure logic shared between the timeline and notes views. No DOM, no
React, no `fetch`.

## What lives here

- `events.ts` — filtering, sorting, conflict detection used by both
  timeline cards and notes' "mentioned in" lists.
- `sessions.ts` — session ordering, current-session detection.
- `links.ts` — link parsing, kind detection.

Hoist a function here only when a second view slice needs it; until
then, leave it where it lives.

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
