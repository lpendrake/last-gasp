---
name: add-data-store-method
description: Use this skill when you need to extend a port interface in app/server/data/ports.ts or app/src/data/ports.ts (e.g. add a new method, change a signature). Enforces the port-vs-adapter rule and the "if it has no IO, it doesn't belong on the port" decision.
---

# Add a Data Store Method

A port change is a contract change. Every adapter — current and future
— must implement the new method. Treat it as a small API design
exercise.

## The decision question

Before adding a method, ask:

> Can this be done with no IO?

If **yes**, it does not belong on the port. Put it in `domain/`.
Examples: filtering an already-loaded list, sorting, computing a
derived field.

If **no**, it goes on the port. Examples: read/write/delete
operations, anything that hits disk or network.

A common mistake: "give me events from this date range" sounds like a
data method. It's a domain function over a `list()` call. Don't add
`listInRange` to the port — keep the port small.

## When in doubt

The smallest port wins. CRUD plus mtime-aware writes is usually
enough. If the domain becomes awkward, add to the port; don't
preemptively bloat it.

## Steps

1. **Edit the port** — `app/server/data/ports.ts` or
   `app/src/data/ports.ts`. Define the method in domain terms (no
   paths, no SQL, no HTTP).
2. **Update every existing adapter** — for the server today that's
   `app/server/data/fs/<entity>.fs.ts`. Don't leave a TODO.
3. **Update tests** — adapters have integration tests in
   `*.fs.test.ts`. Add cases for the new method.
4. **Update the AGENTS.md note** — if the new method changes the
   port's responsibilities, update `app/server/data/AGENTS.md`.

## Server vs client ports

The two `ports.ts` files mirror each other but are not identical:

- Server ports speak to persistence (read/write files).
- Client ports speak to "wherever data comes from" (HTTP today).

Adding a method to one doesn't automatically add it to the other.
Decide which side needs the operation. Often it's both, but in
different shapes.

## Adapter conventions

- Adapters never throw domain errors (`NotFoundError`, etc.). Return
  `null`/`undefined` for "not found"; throw for genuine failures
  (disk full, permission denied).
- Adapters never compose multiple operations. If "archive an event"
  means "update event AND rewrite backlinks", that's a domain
  function calling two ports.
- Adapter methods are atomic from the caller's perspective. Use
  `writeFileAtomic` to make this true on the fs adapter.

## Future-proofing for other backends

Anything you put on the port must be implementable in any backend
without contortion. A red flag: a method that takes a path or a stream
or a glob. A green flag: a method that takes an id and returns a
plain object.

## Verification

- `npm --prefix app run build` clean.
- `npm --prefix app test` green, including new adapter tests.
- The port change is described in the commit message — port changes
  are notable events.

## See also

- `app/server/data/AGENTS.md` for the layer rules.
- `add-api-route` skill — usually you add a port method *as part of*
  adding an endpoint; this skill is for the rare standalone change.
