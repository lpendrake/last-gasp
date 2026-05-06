# `server/http/` — HTTP Layer

Thin protocol layer. One job: turn HTTP requests into domain calls and
domain results into HTTP responses.

## What lives here

- `router.ts` — `Route[]` dispatch (`dispatch(routes, req, res)`); a
  route is `{ method, pattern, handler }`.
- `responses.ts` — `sendJson`, `sendError`, status code helpers.
- `body.ts` — `readBody` (JSON), `readTextBody`, `readBinaryBody`.
- `<entity>.routes.ts` — one file per entity:
  `events.routes.ts`, `notes.routes.ts`, `state.routes.ts`,
  `trash.routes.ts`, `git.routes.ts`. Each exports
  `<entity>Routes(deps) → Route[]`.

## Allowed imports

- `node:http`, `node:url`, `node:querystring` — protocol-level.
- `../domain/*` — call business logic.
- `../data/ports.ts` — type-only imports of port interfaces (so handlers
  can receive ports via `deps`, not construct them).
- `./responses.ts`, `./body.ts`, `./router.ts`.

## Forbidden imports

- `node:fs`, `node:path` for IO. If you need disk, the call goes
  through a port passed in `deps`.
- `../data/fs/*.fs.ts` — concrete adapters are constructed in
  `index.ts`, not imported by handlers. (`data/fs/paths.ts` is a
  leaf utility and may be imported.)
- React, DOM, `vite` runtime APIs.

## Handler shape

```ts
import type { Route } from './router.ts';
import { sendJson } from './responses.ts';
import { listEvents } from '../domain/events.ts';

export function eventRoutes(deps: { events: EventStore }): Route[] {
  return [
    {
      method: 'GET',
      pattern: /^\/api\/events$/,
      async handler(req, res) {
        const result = await listEvents(deps.events, parseQuery(req.url));
        sendJson(res, 200, result);
      },
    },
  ];
}
```

Handlers do four things, in order: parse request → validate → call
domain → shape response. Anything more belongs in `domain/`.

## Conventions

- 400 for input validation failures (return early before calling domain).
- 404 for "domain returned nothing".
- 409 for mtime conflicts (use the helper in `responses.ts`).
- 500 only for genuinely unexpected errors. Domain errors are mapped
  to specific status codes by name, not rethrown.
- Routes are spread into a single `Route[]` table in `server/index.ts`
  (`[...eventRoutes(deps), ...stateRoutes(deps), …]`); this file does
  not run on import.

## Don't

- Don't read or write files here. Even one `fs.readFile` and the layer
  rule is broken.
- Don't put validation logic that the domain also needs. If both layers
  need it, it lives in `domain/` and the handler calls it.

## See also

- `../AGENTS.md` for the layer rules.
- `.claude/skills/add-api-route/SKILL.md` for the recipe.
