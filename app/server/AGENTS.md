# `app/server/` — Backend Brief

Vite middleware that serves `/api/*` and reads/writes the markdown files in
the repo root (`events/`, `npcs/`, `locations/`, etc.).

## Three layers, one direction of dependency

```
http/        — request parsing, response shaping, route dispatch
  │
  ▼
domain/      — pure business logic, no IO
  │
  ▼
data/ports.ts ◀── data/fs/                 (current adapter)
              ◀── data/<other-adapter>/    (additional adapters)
```

The composition root in `index.ts` is the only place adapters meet
handlers.

## Layer rules

- `http/` may import from `domain/` and `data/ports.ts`. May not import
  `node:fs`, `node:path` for IO, or anything in `data/fs/`.
- `domain/` may import from `data/ports.ts` and `node:` builtins for pure
  things (e.g. `crypto.randomUUID`). May not import `node:fs`, `data/fs/`,
  or `http/`.
- `data/fs/` may import `node:fs`, `node:path`, and `data/ports.ts`. May
  not import `domain/` or `http/`. It only implements ports.
- `index.ts` is the composition root: it constructs concrete `data/fs/`
  adapters, hands them to domain functions, and registers HTTP routes.
  This is the only place where the layers meet.

## Sanctioned utilities (use these; don't reinvent)

- `data/fs/atomic.ts` — `writeFileAtomic`. The only sanctioned write path.
- `data/fs/paths.ts` — `safeResolveInRepo`, `validNoteFolder`,
  `safeNoteResolve`. The only sanctioned path-validation path.
- `domain/yaml.ts` — gray-matter config + the custom YAML engine. The
  only sanctioned event/note parse + serialise path.
- `http/responses.ts` — `sendJson`, `sendError`. Use these instead of
  hand-writing `res.writeHead`.
- `http/body.ts` — `readBody`, `readTextBody`, `readBinaryBody`.

## Add a new endpoint

See `.claude/skills/add-api-route/SKILL.md`. The short version:

1. Define the operation on a port in `data/ports.ts`.
2. Implement it in `data/fs/*.fs.ts` (use `atomic.ts` + `paths.ts`).
3. Write a domain function in `domain/*.ts` taking the port as an arg.
4. Add the route handler in `http/*.routes.ts` — parse, call domain,
   format response.
5. Register the route in `index.ts`.
6. Write a Vitest against the domain function with an in-memory port stub.

## Conventions

- Routes go in `http/<entity>.routes.ts`, exporting a function
  `registerXxxRoutes(router, deps)`.
- Domain modules export plain functions. They take port objects as
  arguments — no hidden module-level state.
- mtime-based optimistic concurrency: every write returns the new mtime;
  every update accepts an `If-Match` mtime and 409s on mismatch.
- Tests cover domain logic against in-memory ports. Integration tests
  against the real fs adapter live in `*.fs.test.ts`.

## Don't

- Don't import `fs` or `path` from `http/` or `domain/`.
- Don't add a new write path that isn't `atomic.writeFileAtomic`.
- Don't validate paths inline; route everything through `paths.ts`.

## See also

- `app/AGENTS.md` — top-level rules.
- `http/AGENTS.md`, `domain/AGENTS.md`, `data/AGENTS.md` — per-layer.
- `.claude/skills/add-api-route/SKILL.md`,
  `.claude/skills/add-data-store-method/SKILL.md`.
