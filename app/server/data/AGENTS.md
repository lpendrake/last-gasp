# `server/data/` — Persistence Ports + Adapters

The seam between domain logic and the storage backend. Domain code
depends on the interfaces in `ports.ts`; adapters implement them.

## Layout

```
data/
  ports.ts          # interfaces: EventStore, NoteStore, StateStore,
                    #             TrashStore, GitPort
  fs/               # filesystem adapter
    index.ts        # makeFsStores({ root }) — constructs all adapters
    events.fs.ts
    notes.fs.ts
    state.fs.ts
    trash.fs.ts
    atomic.ts       # writeFileAtomic — the only sanctioned write path
    paths.ts        # safeResolveInRepo, validNoteFolder, safeNoteResolve
  <other-adapter>/  # one folder per additional backend
```

## The port-vs-adapter rule

A **port** is what the domain needs. It speaks in domain terms: "get
event by id", "list events between A and B", "put note with mtime check".
Ports never expose paths, file extensions, HTTP details, or query
strings.

An **adapter** is how a particular backend satisfies the port. The fs
adapter knows about `events/` directories, `.md` extensions, frontmatter
serialisation, and atomic writes. A different backend (e.g. a remote
API) would know about HTTP requests, auth tokens, and retry policy.

If a method on a port mentions a file path, the abstraction has leaked.

## Allowed imports

- **`ports.ts`** — types only. No runtime code.
- **`fs/*`** — `node:fs`, `node:path`, `node:crypto`, `gray-matter`,
  `js-yaml`. May import `ports.ts` for the interface it implements and
  `domain/yaml.ts` for parse/serialise (because the on-disk format is
  YAML+markdown — that's the adapter's concern).
- **`fs/paths.ts`** is a special case: it is a leaf utility of pure
  path math (no IO) and is importable from any layer including
  `http/*` and `domain/*`. The "no `data/fs/` from http" rule
  targets concrete adapter modules (those ending in `.fs.ts`), not
  this shared validator.

## Forbidden imports

- `fs/*` may not import `domain/*` (other than `yaml.ts` for the
  on-disk format) or `http/*`.
- `ports.ts` must remain dependency-free.

## Adding a port method

See `.claude/skills/add-data-store-method/SKILL.md`. The decision rule:

> Can this be done without IO?
> If yes → it belongs in `domain/`, not on the port.
> If no → it goes on the port and every adapter must implement it.

Every change to `ports.ts` is a change to the contract every adapter
must satisfy. Treat it as a small API design exercise, not a one-line
addition.

## Sanctioned utilities

- `fs/atomic.ts` — `writeFileAtomic(path, contents)`. Writes to a
  tempfile and renames. The only sanctioned write path on the server.
- `fs/paths.ts` — `safeResolveInRepo`, `validNoteFolder`,
  `safeNoteResolve`. The only sanctioned path-validation path. These
  prevent directory-traversal attacks; do not roll your own.

## Conventions

- Adapters return plain data objects, not file handles or streams.
- mtime is a `number` (epoch ms). Comparisons are exact.
- Errors thrown by adapters are caught by the domain layer and
  re-thrown as typed domain errors. Adapters do not throw
  `NotFoundError` — they return `null` or `undefined`.

## Don't

- Don't put business logic in an adapter. If two adapters would need
  to do the same thing, that thing belongs in `domain/`.
- Don't bypass `atomic.ts` for "small writes". Concurrency bugs from
  partial writes are the worst kind to debug.
- Don't add a method to `ports.ts` for a one-off endpoint. Compose
  smaller methods in the domain layer.

## See also

- `../AGENTS.md` for the layer direction.
- `.claude/skills/add-data-store-method/SKILL.md` for the recipe.
