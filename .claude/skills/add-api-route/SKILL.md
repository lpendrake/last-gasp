---
name: add-api-route
description: Use this skill whenever you need to add a new HTTP endpoint to the server, or extend an existing one with a new method. Walks through port, adapter, domain, handler, registration, and test in the correct order. Enforces the layer rules in app/server/AGENTS.md.
---

# Add an API Route

Adding an endpoint touches four layers in a fixed order. Follow them.
Skipping a layer ("I'll just call `fs` from the handler this once") is
how the cloud-migration seam disappears.

## Order of operations

1. **Port** — declare what the domain needs.
2. **Adapter** — implement it for the filesystem.
3. **Domain** — write the business logic that uses the port.
4. **Handler** — wire the HTTP route to the domain.
5. **Registration** — register the handler in the composition root.
6. **Test** — Vitest the domain function with an in-memory port.

## Before you start: file existence

The Phase 2 refactor is in flight. At any point, the target files
(`server/http/<entity>.routes.ts`, `server/domain/<entity>.ts`,
`server/data/fs/<entity>.fs.ts`, `server/data/ports.ts`,
`server/data/fs/index.ts`, `server/index.ts`) may or may not exist
yet. **Create them if missing; extend them if present.**

You may grep for existing symbols (e.g. `EventStore`,
`makeFsEventStore`) to match the style of code that's already
migrated. You may **not** read `app/server/api.ts` to crib from the
legacy implementation — it conflates layers and will mislead you. The
target shape lives in this skill and the AGENTS.md files; the
behaviour you need to reproduce comes from the user's request, not
from `api.ts`.

## 1. Port: declare the operation

File: `app/server/data/ports.ts`.

Decide which port the operation belongs to (`EventStore`, `NoteStore`,
`StateStore`, `TrashStore`, `GitPort`). If none fit, that's a design
question — ask, don't invent.

The method speaks in domain terms — never paths or file extensions:

```ts
// good
export interface EventStore {
  archive(id: string, ifMatch: number): Promise<{ mtime: number }>;
}

// bad — leaks filesystem concerns
archive(filename: string, mtime: number): Promise<void>;
```

If the operation can be done without IO (filtering, deriving), it
**does not belong on a port** — put it in `domain/` instead.

## 2. Adapter: filesystem implementation

File: `app/server/data/fs/<entity>.fs.ts`.

Use only the sanctioned utilities:

- `app/server/data/fs/atomic.ts` → `writeFileAtomic(path, contents)`.
  The only sanctioned write path. Never use `fs.writeFile` directly.
- `app/server/data/fs/paths.ts` → `safeResolveInRepo`,
  `validNoteFolder`, `safeNoteResolve`. The only sanctioned path
  validators. Never roll your own — they prevent directory traversal.
- `app/server/domain/yaml.ts` → for parse/serialise. Don't import
  `gray-matter` directly.

Adapter shape:

```ts
import { writeFileAtomic } from './atomic.ts';
import { safeResolveInRepo } from './paths.ts';
import { parseEventFile, serialiseEvent } from '../../domain/yaml.ts';

export function makeFsEventStore(root: string): EventStore {
  return {
    async archive(id, ifMatch) {
      const path = safeResolveInRepo(root, 'events', `${id}.md`);
      let stat;
      try {
        stat = await fs.stat(path);
      } catch (e) {
        if (e.code === 'ENOENT') return null;       // not found → null
        throw e;
      }
      if (stat.mtimeMs !== ifMatch) {
        throw new ConflictError(stat.mtimeMs);      // stale → typed error
      }
      const current = parseEventFile(await fs.readFile(path, 'utf8'));
      const next = serialiseEvent({ ...current, archived: true });
      await writeFileAtomic(path, next);
      const newStat = await fs.stat(path);
      return { mtime: newStat.mtimeMs };
    },
  };
}
```

**Adapter error contract (important):**

- "Not found" → return `null` or `undefined`. Catch `ENOENT` from
  `fs.stat`/`fs.readFile` and translate. Adapters never throw
  `NotFoundError` — that's a domain concern.
- "Stale mtime" → throw `ConflictError(currentMtime)`. The domain
  layer re-throws; the handler maps to 409.
- Anything else (permissions, disk full, parse failure) → throw the
  raw error. The domain layer lets it propagate; the handler returns
  500.

The port method's return type tells you which: `Promise<X | null>`
means the caller should handle null; `Promise<X>` means errors only.

## 3. Domain: business logic

File: `app/server/domain/<entity>.ts`.

Functions take ports as arguments. They throw typed errors from
`app/server/domain/errors.ts` (`NotFoundError`, `ConflictError`,
`ValidationError`).

```ts
export async function archiveEvent(
  events: EventStore,
  id: string,
  ifMatch: number,
): Promise<{ mtime: number }> {
  if (!isValidId(id)) throw new ValidationError('id');
  return events.archive(id, ifMatch);
}
```

If the operation needs to coordinate multiple ports (e.g. update an
event AND rewrite link backlinks), the orchestration goes here, not in
the handler.

## 4. Handler: HTTP wiring

File: `app/server/http/<entity>.routes.ts`.

Handlers are thin: parse → validate input shape → call domain → shape
response. Use the helpers in `app/server/http/responses.ts` and
`app/server/http/body.ts`.

```ts
import { sendJson, sendError } from './responses.ts';
import { readBody } from './body.ts';
import { archiveEvent } from '../domain/events.ts';
import { ConflictError, NotFoundError, ValidationError } from '../domain/errors.ts';

export function registerEventRoutes(router, deps) {
  router.add('POST', /^\/api\/events\/([^/]+)\/archive$/, async (req, res, [id]) => {
    const ifMatch = Number(req.headers['if-match']);
    if (!Number.isFinite(ifMatch)) return sendError(res, 400, 'if-match required');
    try {
      const result = await archiveEvent(deps.events, id, ifMatch);
      sendJson(res, 200, result);
    } catch (e) {
      if (e instanceof NotFoundError) return sendError(res, 404, e.message);
      if (e instanceof ConflictError) return sendError(res, 409, { mtime: e.mtime });
      if (e instanceof ValidationError) return sendError(res, 400, e.message);
      throw e;
    }
  });
}
```

**Forbidden in handlers:** `import 'node:fs'`, `import 'node:path'`,
`fs.*` calls, direct path concatenation, YAML parsing.

## 5. Register the route

File: `app/server/index.ts` (the composition root).

The composition root is the only place adapters meet handlers:

```ts
import { makeFsStores } from './data/fs/index.ts';
import { registerEventRoutes } from './http/events.routes.ts';

const stores = makeFsStores({ root: REPO_ROOT });
registerEventRoutes(router, { events: stores.events });
```

`makeFsStores` (in `app/server/data/fs/index.ts`) is a single factory
that constructs every adapter from a config object and returns
`{ events, notes, state, trash, ... }`. If you're adding the first
method to a brand-new entity, you may also need to wire that entity
into `makeFsStores`. That's a port-shape change — see the
`add-data-store-method` skill.

## 6. Test the domain function

File: `app/server/domain/<entity>.test.ts`.

Vitest. Use an in-memory port stub — never the real fs adapter.

```ts
import { describe, it, expect } from 'vitest';
import { archiveEvent } from './events.ts';

function memoryEventStore(seed = {}) {
  let store = { ...seed };
  return {
    async archive(id, ifMatch) {
      const cur = store[id];
      if (!cur) throw new NotFoundError(id);
      if (cur.mtime !== ifMatch) throw new ConflictError(cur.mtime);
      store[id] = { ...cur, archived: true, mtime: cur.mtime + 1 };
      return { mtime: store[id].mtime };
    },
  };
}

describe('archiveEvent', () => {
  it('archives and bumps mtime', async () => {
    const events = memoryEventStore({ e1: { mtime: 100 } });
    expect(await archiveEvent(events, 'e1', 100)).toEqual({ mtime: 101 });
  });
  it('409s on stale mtime', async () => {
    const events = memoryEventStore({ e1: { mtime: 100 } });
    await expect(archiveEvent(events, 'e1', 99)).rejects.toThrow(ConflictError);
  });
});
```

## mtime-conflict pattern

Every write goes through:

1. Client sends `If-Match: <mtime>`.
2. Adapter reads current mtime, throws `ConflictError(currentMtime)` on mismatch.
3. Domain re-throws.
4. Handler maps `ConflictError` to HTTP 409 with `{ mtime: currentMtime }`.
5. Client surfaces a conflict UI with the new mtime.

Don't invent a different concurrency story.

## Verification

- `npm --prefix app run build` clean.
- `npm --prefix app test` green.
- The new test exists and runs.
- No `fs`/`path` imports added under `http/` or `domain/`.

## See also

- `app/server/AGENTS.md`, `app/server/http/AGENTS.md`,
  `app/server/domain/AGENTS.md`, `app/server/data/AGENTS.md`.
- `add-data-store-method` skill — for changing port shape.
