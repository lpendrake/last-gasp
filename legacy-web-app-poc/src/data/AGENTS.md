# `src/data/` — Client Data Layer

The seam between the UI and whatever serves data. Mirrors
`server/data/` in spirit: ports define what the UI needs; adapters
implement them. Domain code never imports an adapter directly.

## Layout

```
data/
  ports.ts          # interfaces: EventStore, NoteStore, StateStore, LinkStore, …
  http/             # adapter that fetches /api/*
    client.ts       # fetch wrapper + ApiError
    events.http.ts
    notes.http.ts
    state.http.ts   # state, sessions, tags
    links.http.ts
  <other-adapter>/  # one folder per additional backend
  types.ts          # shared DTOs (EventListItem, NoteEntry, …)
```

## Layer rules

- `ports.ts` — types only. No runtime code, no fetch.
- `http/*` — implements ports using `fetch`. Imports `ports.ts`,
  `types.ts`, `client.ts` only.
- View slices receive a port object via deps. They never import an
  adapter directly — that's the composition root's job in
  `bootstrap/`.

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
- mtime is the RFC2822 string from the server's `Last-Modified`
  response header. Stash it on the loaded entity and send it back as
  `If-Unmodified-Since` on the next mutation.

## Don't

- Don't call `fetch` outside `http/`.
- Don't put parsing or filtering logic in adapters. That's `domain/`.
- Don't store auth tokens or environment config here. Pass them in.

## See also

- `../AGENTS.md` for the layer rules.
- `server/data/AGENTS.md` — the server-side mirror.
