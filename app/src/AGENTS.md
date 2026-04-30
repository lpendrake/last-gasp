# `app/src/` — Client Brief

The browser-side code. Two paradigms coexist; the layer rule from
`app/AGENTS.md` applies to both.

## Layout

```
src/
  main.ts            # thin entry: mount shell, dispatch to view
  bootstrap/         # mount, view-switcher, global hotkeys
  data/              # client data layer
    ports.ts         # interfaces the UI depends on
    http/            # current adapter: fetch /api/*
    types.ts         # shared DTOs
  domain/            # pure logic shared between timeline and notes
  calendar/          # leaf utility: Golarian ↔ UTC, formatting
  timeline/          # vanilla DOM — timeline view
    app.ts           # controller
    render/          # axis, cards, session-bands
    interactions/    # zoom, pan, reschedule, quick-add
    event-modal.ts
  panels/            # vanilla DOM — filter, search, toolbar
    filters/         # types, logic, sidebar, persistence
  editor/            # vanilla DOM — event editor modal
    modal/           # index, view, fields, save
  peek/              # vanilla DOM — hover-preview windows
  notes/             # React — notes view
    Notes.tsx
    components/
    hooks/
    editor/
      LiveEditor.tsx
      markdown/
    services/
  styles/            # css per slice, plus tokens
    notes/           # split of the notes css by section
  theme.ts
```

## The two paradigms

**React** lives in `notes/` only. Hooks for state and effects, components
for JSX, services for non-React logic. Styles are global CSS imported
once.

**Vanilla DOM** lives everywhere else (`timeline/`, `panels/`, `editor/`,
`peek/`, `bootstrap/`). Modules export factory functions that take an
HTMLElement plus a deps object, attach listeners, and return a teardown
or update API. No framework.

Don't mix them: no React in vanilla slices, no manual `innerHTML` in
React components.

## Layer rules (mirrors the server)

- `domain/*` may not import from `data/http/*`, `timeline/*`,
  `panels/*`, `editor/*`, `peek/*`, `notes/*`, or anything DOM/React.
  It depends only on `data/ports.ts` (types) and `data/types.ts`.
- `data/http/*` may import `data/ports.ts`, `data/types.ts`, and
  `node:` builtins for type-only purposes. May not import
  `domain/*` or any view slice.
- View slices import `domain/*` and either receive a port via deps or
  call a higher orchestrator that does.
- `main.ts` and `bootstrap/` are the composition root: they construct
  the http adapter, hand it to the views.

## Sanctioned utilities

- `data/http/client.ts` — `fetch` wrapper + `ApiError`. The only
  sanctioned client HTTP path.
- `calendar/golarian.ts` — date conversions. Don't reimplement.
- `theme.ts` — palette + `weekdayColor`. Single source of colour.

## Where to add things

| Want to add… | Skill |
|---|---|
| Timeline rendering or interaction | `add-timeline-feature` |
| Notes UI, hook, or component | `add-notes-feature` |
| Hover-preview for a new entity | `add-peek-target` |
| New endpoint to call | First do `add-api-route`, then add to `data/http/` |

## Conventions

- Files cap at ~300 lines. Run `split-large-file` when you cross it.
- Tests next to the file: `foo.ts` ↔ `foo.test.ts`. Vitest only.
- Vanilla modules export `createX(host, deps)` returning
  `{ update, destroy }`. Consistency lets `bootstrap/` wire them.
- React modules: one component per file, named the same as the file.
  Hooks live under `notes/hooks/` and are named `useX`.

## Don't

- Don't add `fetch` calls outside `data/http/`.
- Don't read `localStorage` outside the slice that owns the key. Names
  are namespaced (`filters.pinned.v1`, `notes.openTabs.v1`, …).
- Don't inline DOM in React components or React in DOM modules.

## See also

- `app/AGENTS.md` for the cross-layer rules.
- Each subfolder has its own `AGENTS.md`.
