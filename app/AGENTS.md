# `app/` — Architecture Brief for Agents

This is the entry point. Read this before touching anything under `app/`.
Each subfolder has its own `AGENTS.md` with the local rules.

## What this is

A timeline + notes app for tracking a tabletop campaign. Vite dev server,
TypeScript, vanilla DOM for the timeline, React for notes. Persistence is
markdown files on disk today; the layout is designed so it can become cloud
storage tomorrow without rewriting business logic.

## The one rule that matters

Dependencies flow one way:

```
view / http  ──▶  domain  ──▶  data ports  ◀──  data adapters
```

- **view / http** is protocol-shaped: HTTP routes, DOM events, JSX. Thin.
- **domain** is pure logic: parsing, validation, link rewriting, filtering.
  No `fs`, no `fetch`, no DOM, no React.
- **data ports** are interfaces (`server/data/ports.ts`,
  `src/data/ports.ts`). The view and domain layers depend on these, not on
  any concrete implementation.
- **data adapters** implement the ports. Today: filesystem on the server,
  HTTP fetch on the client. Tomorrow: cloud on the server, IndexedDB on
  the client. Adding a new adapter must not require changing domain or
  view code.

If you find yourself importing `fs` from an HTTP handler or `fetch` from a
domain module, stop. That import is the bug.

## The two paradigms

- **Vanilla TS + DOM** — `src/main.ts`, `src/timeline/`, `src/panels/`,
  `src/editor/`, `src/peek/`. Direct DOM manipulation, manual event
  listeners, custom layout/zoom/drag.
- **React** — `src/notes/` only. Hooks for state, components for JSX,
  services for non-React logic.

These coexist deliberately. A future refactor will unify on React; until
then, do not introduce React into vanilla slices and do not introduce
direct DOM manipulation into the React slice.

## Where to add things

| Want to add… | Skill | Folder |
|---|---|---|
| A new HTTP endpoint | `add-api-route` | `server/http/`, `server/domain/`, `server/data/` |
| A new persistence operation | `add-data-store-method` | `server/data/ports.ts` + `server/data/fs/` |
| Timeline rendering or interaction | `add-timeline-feature` | `src/timeline/` |
| Notes UI or editor | `add-notes-feature` | `src/notes/` |
| Hover-preview for a new entity | `add-peek-target` | `src/peek/` |
| A file is over ~250 lines | `split-large-file` | (the offending file) |

Skills live at `.claude/skills/` and contain step-by-step recipes — use
them rather than guessing at conventions.

## Conventions

- Files cap at ~300 lines (orchestrators may run to 400). When you cross
  that, run the `split-large-file` skill rather than letting it grow.
- Tests live next to the code: `foo.ts` ↔ `foo.test.ts`. Vitest only.
- `npm --prefix app run build` and `npm --prefix app test` must stay
  green at every commit.
- Atomic writes on the server go through `server/data/fs/atomic.ts` and
  nothing else. Path validation goes through `server/data/fs/paths.ts`
  and nothing else.

## Don't

- Don't add a new top-level folder under `app/` without updating this
  file and the relevant skill.
- Don't reintroduce 800-line files. The whole point of this layout is
  that agents can navigate by folder and filename, not by scrolling.
- Don't bypass the data ports because "it's just one call". If the call
  needs IO, it goes through a port; the port can be swapped, the
  shortcut cannot.

## See also

- `feature-ideas` (repo root) — upcoming work the structure must
  accommodate (campaigns, UUID linking, mentioned-in backlinks, mind-map).
- `app/server/AGENTS.md`, `app/src/AGENTS.md` — layer-specific guides.
- `.claude/skills/*/SKILL.md` — concrete recipes.
