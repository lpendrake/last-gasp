---
name: add-api-route
description: Use this skill whenever you need to add a new HTTP endpoint to the server, or extend an existing one with a new method. Walks through port, adapter, domain, handler, registration, and test in the correct order. Enforces the layer rules in app/server/AGENTS.md.
---

# Add an API Route

Adding an endpoint touches four layers in a fixed order. Follow them.
Skipping a layer ("I'll just call `fs` from the handler this once")
breaks the abstraction that lets adapters be swapped.

## Order of operations

1. **Port** — declare what the domain needs.
2. **Adapter** — implement it for the filesystem.
3. **Domain** — write the business logic that uses the port.
4. **Handler** — wire the HTTP route to the domain.
5. **Registration** — register the handler in the composition root.
6. **Test** — Vitest the domain function with an in-memory port.

## Before you start: file existence

Any of the target files (`server/http/<entity>.routes.ts`,
`server/domain/<entity>.ts`, `server/data/fs/<entity>.fs.ts`,
`server/data/ports.ts`, `server/index.ts`) may or may not exist yet.
**Create them if missing; extend them if present.** There is no
aggregate `data/fs/index.ts`; each entity has its own `make<Entity>Store`
factory.

You may grep for existing symbols (e.g. `EventStore`,
`makeFsEventStore`) to match the style of code that's already in
place. The target shape lives in this skill and the AGENTS.md files;
the behaviour you need to reproduce comes from the user's request.
If you find a file that conflates layers, do not crib from it —
follow the layer rules in `app/server/AGENTS.md` regardless of what
the surrounding code currently does.

## 1. Port: declare the operation

File: `app/server/data/ports.ts`.

Decide which port the operation belongs to (`EventStore`, `NoteStore`,
`StateStore`, `EventTrashStore`, `GitPort`). If none fit, that's a
design question — ask, don't invent.

The ports are intentionally CRUD-shaped: `list`, `get`, `stat`, `put`,
`exists`, `del`. Mtime checks happen in the **domain** layer, not on
the port: a domain function calls `stat` first, compares with
`mtimeMatch`, then calls `put`. Don't add a method like
`archive(id, ifUnmodifiedSince)` — express that as a domain function
over the existing primitives.

The method speaks in domain terms — never paths or file extensions:

```ts
// good — CRUD primitive
export interface EventStore {
  put(filename: string, content: string): Promise<EventStat>;
}

// bad — leaks filesystem concerns
put(absolutePath: string, content: string): Promise<void>;

// bad — concurrency policy belongs in domain, not on the port
put(filename: string, content: string, ifUnmodifiedSince: string): Promise<EventStat>;
```

If the operation can be done without IO (filtering, deriving), it
**does not belong on a port** — put it in `domain/` instead.

Many endpoints don't need a new port method at all. An "archive"
endpoint, for example, is a domain function that does
`stat → mtimeMatch → put` against the existing CRUD primitives.

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

Adapter shape (`put`/`stat` are CRUD primitives — no concurrency
checks here, just IO):

```ts
import { writeFileAtomic } from './atomic.ts';
import { safeResolveInRepo } from './paths.ts';

export function makeFsEventStore(root: string): EventStore {
  return {
    async stat(filename) {
      const path = safeResolveInRepo(root, 'events', filename);
      try {
        const s = await fs.stat(path);
        return { mtime: s.mtime };
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw e;
      }
    },
    async put(filename, content) {
      const path = safeResolveInRepo(root, 'events', filename);
      await writeFileAtomic(path, content);
      const s = await fs.stat(path);
      return { mtime: s.mtime };
    },
    // …get, list, exists, del…
  };
}
```

**Adapter error contract:**

- "Not found" → return `null` or `undefined`. Catch `ENOENT` from
  `fs.stat`/`fs.readFile` and translate. Adapters never throw
  `NotFoundError` — that's a domain concern.
- Anything else (permissions, disk full, parse failure) → throw the
  raw error. The domain layer lets it propagate; the handler returns
  500.

The port method's return type tells you which: `Promise<X | null>`
means the caller should handle null; `Promise<X>` means errors only.

## 3. Domain: business logic

File: `app/server/domain/<entity>.ts`.

Functions take ports as arguments. They throw typed errors from
`app/server/domain/errors.ts` (`NotFoundError`, `ConflictError`,
`ValidationError`). The mtime-conflict check lives here, using
`mtimeMatch` from `domain/events.ts`:

```ts
import type { EventStore } from '../data/ports.ts';
import { ConflictError, NotFoundError, ValidationError } from './errors.ts';
import { mtimeMatch, isValidEventFilename } from './events.ts';
import { eventFromParsed, serialiseEvent } from './yaml.ts';

export async function archiveEvent(
  events: EventStore,
  filename: string,
  ifUnmodifiedSince: string | undefined,
): Promise<{ mtime: Date }> {
  if (!isValidEventFilename(filename)) throw new ValidationError('filename');
  const stat = await events.stat(filename);
  if (!stat) throw new NotFoundError(filename);
  if (ifUnmodifiedSince && !mtimeMatch(ifUnmodifiedSince, stat.mtime)) {
    throw new ConflictError('File modified since last read');
  }
  const current = await events.get(filename);
  if (!current) throw new NotFoundError(filename);
  const event = eventFromParsed(filename, current.content, current.mtime);
  const next = serialiseEvent({ ...event, archived: true }, event.body);
  return events.put(filename, next);
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

Each entity file exports a `<entity>Routes(deps)` function that
returns an array of `Route` objects. The composition root spreads
these into a single dispatch table — there is no `router.add(...)`
imperative API.

Patterns are written as path strings with `:param` (single segment)
or `:param*` (greedy, slashes allowed); `defineRoute` compiles them
into the regex. Handlers receive `(req, res, params)` where `params`
is `Record<string, string>`.

```ts
import type { EventStore } from '../data/ports.ts';
import { defineRoute, type Route } from './router.ts';
import { sendJson, sendError } from './responses.ts';
import { archiveEvent } from '../domain/events.ts';
import { ConflictError, NotFoundError, ValidationError } from '../domain/errors.ts';

interface Deps { events: EventStore }

function mapDomainError(res: any, err: unknown): boolean {
  if (err instanceof ValidationError) { sendError(res, 400, err.message); return true; }
  if (err instanceof NotFoundError)   { sendError(res, 404, err.message); return true; }
  if (err instanceof ConflictError)   { sendError(res, 409, err.message); return true; }
  return false;
}

export function eventRoutes(deps: Deps): Route[] {
  return [
    defineRoute('POST', '/api/events/:filename/archive', async (req, res, params) => {
      const filename = decodeURIComponent(params.filename);
      const ius = req.headers['if-unmodified-since'];
      try {
        const { mtime } = await archiveEvent(
          deps.events,
          filename,
          typeof ius === 'string' ? ius : undefined,
        );
        sendJson(res, 200, { ok: true }, { 'Last-Modified': mtime.toUTCString() });
      } catch (err) {
        if (mapDomainError(res, err)) return;
        throw err;
      }
    }),
  ];
}
```

**Forbidden in handlers:** `import 'node:fs'`, `import 'node:path'`,
`fs.*` calls, direct path concatenation, YAML parsing.

## 5. Register the route

File: `app/server/index.ts` (the composition root).

The composition root is the only place adapters meet handlers. Each
entity has its own `make<Entity>Store(repoRoot)` factory; the
composition root calls each one and threads the resulting ports into
each `<entity>Routes(deps)` call:

```ts
import { makeFsEventStore } from './data/fs/events.fs.ts';
import { eventRoutes } from './http/events.routes.ts';

export function createApi({ repoRoot }: CreateApiOpts): ApiHandler {
  const events = makeFsEventStore(repoRoot);
  // … other adapters …
  const ROUTES: Route[] = [
    ...eventRoutes({ events }),
    // … other route arrays …
  ];
  return (req, res, next) => dispatch(ROUTES, req, res, next);
}
```

If you're adding the first method to a brand-new entity, you also
add a new `make<Entity>Store` factory call here and a new
`...<entity>Routes(deps)` line.

## 6. Test the domain function

File: `app/server/domain/<entity>.test.ts`.

Vitest. Use an in-memory port stub — never the real fs adapter.

```ts
import { describe, it, expect } from 'vitest';
import { archiveEvent } from './events.ts';
import { ConflictError, NotFoundError } from './errors.ts';

function memoryEventStore(seed: Record<string, { content: string; mtime: Date }> = {}) {
  const store = { ...seed };
  return {
    async stat(filename: string) {
      return store[filename] ? { mtime: store[filename].mtime } : null;
    },
    async get(filename: string) {
      return store[filename] ?? null;
    },
    async put(filename: string, content: string) {
      const mtime = new Date(Date.now() + 1000);
      store[filename] = { content, mtime };
      return { mtime };
    },
    // …other CRUD methods stubbed as the test needs…
  } as any;
}

describe('archiveEvent', () => {
  it('archives and returns the new mtime', async () => {
    const original = new Date('2026-05-01T00:00:00Z');
    const events = memoryEventStore({
      'a.md': { content: '---\ntitle: a\n---\n', mtime: original },
    });
    const { mtime } = await archiveEvent(events, 'a.md', original.toUTCString());
    expect(mtime.getTime()).toBeGreaterThan(original.getTime());
  });
  it('409s on stale If-Unmodified-Since', async () => {
    const events = memoryEventStore({
      'a.md': { content: '---\ntitle: a\n---\n', mtime: new Date('2026-05-02T00:00:00Z') },
    });
    await expect(archiveEvent(events, 'a.md', 'Fri, 01 May 2026 00:00:00 GMT'))
      .rejects.toThrow(ConflictError);
  });
  it('404s when the file is missing', async () => {
    const events = memoryEventStore();
    await expect(archiveEvent(events, 'a.md', undefined))
      .rejects.toThrow(NotFoundError);
  });
});
```

## mtime-conflict pattern

Every write that needs concurrency safety goes through:

1. Client reads the resource and remembers the `Last-Modified`
   response header.
2. Client sends the next mutation with that value as the
   `If-Unmodified-Since` request header.
3. The handler forwards the header value to the domain function as
   `ifUnmodifiedSince: string | undefined`.
4. The domain function calls `store.stat()`, compares with
   `mtimeMatch(ifUnmodifiedSince, stat.mtime)` (second-precision per
   HTTP-date rules), and throws `ConflictError` on mismatch.
5. `mapDomainError` turns the `ConflictError` into a 409 response.
6. The client surfaces a conflict UI; on the next read it picks up
   the fresh `Last-Modified` and retries.

Don't invent a different concurrency story.

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
