# `src/data/` — Client Data Layer

The seam where the cloud migration happens on the client. Mirrors
`server/data/` in spirit: ports define what the UI needs; adapters
implement them.

## Current state vs target state

**Today:** `api.ts` is a single 199-line module exporting `listEvents`,
`getEvent`, `putEvent`, etc. as functions that call `fetch`.

**Target (Phase 3):**

```
data/
  ports.ts          # interfaces: EventStore, NoteStore, StateStore, …
  http/             # current adapter
    client.ts       # fetch wrapper + ApiError
    events.http.ts
    notes.http.ts
    state.http.ts
    sessions.http.ts
    links.http.ts
  types.ts          # shared DTOs (EventListItem, NoteEntry, …)
```

A future cloud build of the app might keep the same ports but use a
different adapter (e.g. direct calls to a cloud SDK). Domain code never
imports an adapter directly.

## Layer rules

- `ports.ts` — types only. No runtime code, no fetch.
- `http/*` — implements ports using `fetch`. Imports `ports.ts`,
  `types.ts`, `client.ts` only.
- View slices receive a port object (the http adapter today) via deps.
  They never import an adapter directly — that's the composition
  root's job in `main.ts` / `bootstrap/`.

## Sanctioned utilities

- `http/client.ts` — `fetch` wrapper + `ApiError`. **The only
  sanctioned client HTTP path.** All adapter functions go through it.

## Add an adapter method

1. Add the method to the relevant port in `ports.ts`.
2. Implement it in `http/<entity>.http.ts` using `client.ts`.
3. If the UI needs to compose this with other ports, add a function in
   `src/domain/`.

## Conventions

- Adapter methods return parsed JSON or throw `ApiError`. Don't return
  the `Response` object.
- DTOs live in `types.ts`. They're the wire format; if the UI needs a
  different shape, transform in `domain/`.
- mtime is a `number`. Pass it through unchanged for `If-Match`.

## Don't

- Don't call `fetch` outside `http/`.
- Don't put parsing or filtering logic in adapters. That's `domain/`.
- Don't store auth tokens or environment config here. Pass them in.

## See also

- `../AGENTS.md` for the layer rules.
- `server/data/AGENTS.md` — the server-side mirror.
