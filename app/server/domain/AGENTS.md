# `server/domain/` — Business Logic

Pure functions that know how events, notes, sessions, links, and trash
behave. No IO, no protocol awareness. This is the layer that survives
the cloud migration unchanged.

## What lives here

- `events.ts` — parse, serialise, validate, list, search events.
- `notes.ts` — note operations not involving disk layout.
- `links.ts` — `updateNotesLinks` (reciprocal link rewriting).
- `sessions.ts` — session ordering, conflict detection.
- `trash.ts` — soft-delete naming rules, restore semantics.
- `yaml.ts` — gray-matter config + the custom YAML engine. **The only
  sanctioned event/note parse + serialise path.**

## Allowed imports

- `node:` builtins that don't touch IO: `crypto`, `node:url` for parsing
  strings, etc.
- `../data/ports.ts` — type-only imports of port interfaces. Functions
  take ports as arguments, never import a concrete adapter.
- Pure npm packages: `gray-matter`, `js-yaml`, `markdown-it`.

## Forbidden imports

- `node:fs`, `node:path` for IO, `node:child_process`. If a function
  needs to read or write something, it calls a port method passed in.
- `../http/*`, `../data/fs/*`. The domain doesn't know about protocols
  or adapters.
- React, DOM.

## Function shape

```ts
// good — port is an explicit arg
export async function archiveEvent(
  events: EventStore,
  id: string,
  ifMatch: number,
): Promise<{ mtime: number }> {
  const current = await events.get(id);
  if (!current) throw new NotFoundError(id);
  if (current.mtime !== ifMatch) throw new ConflictError(current.mtime);
  return events.put(id, { ...current.frontmatter, archived: true });
}

// bad — module-level state, reaches for fs
import { writeFile } from 'node:fs/promises';
let cache = new Map();
```

## Conventions

- Throw typed errors (`NotFoundError`, `ConflictError`, `ValidationError`)
  defined in `domain/errors.ts`. Handlers map these to status codes.
- Functions are stateless. Module-level mutable state is a smell —
  caches belong in adapters, not in domain.
- mtime-based optimistic concurrency is the responsibility of this
  layer, not the HTTP layer.
- If a piece of logic can be done without IO, it belongs here, even if
  it currently lives in an adapter.

## Don't

- Don't import a concrete adapter to "save a parameter". Inject the
  port. Future cloud adapters depend on this discipline.
- Don't reach into `gray-matter` directly elsewhere — go through
  `yaml.ts` so the YAML engine config stays in one place.

## See also

- `../AGENTS.md` for layer rules.
- `.claude/skills/add-api-route/SKILL.md` step 3.
