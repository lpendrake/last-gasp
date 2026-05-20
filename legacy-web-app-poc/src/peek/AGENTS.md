# `src/peek/` — Hover-Preview Windows (Vanilla DOM)

Floating preview windows that appear when hovering links in events or
notes. A small system.

## Files

- `window.ts` — renders one preview window (positioning, content).
- `stack.ts` — manages the set of open windows (LIFO, dismiss-on-leave,
  keyboard handling).
- `resolve.ts` — turns a link/href into the entity it points to.

## Layer rules

- May import `data/ports.ts` types and receive a port via deps.
- May import `domain/*`.
- May not import view slices (timeline/notes/editor/panels). The
  initiating slice attaches peek; peek doesn't know who initiated.

## Add a peek target

See `.claude/skills/add-peek-target/SKILL.md`. The shape:

1. `resolve.ts` learns the new entity type — given a link, return
   `{ kind, path, fetcher }` where `fetcher` is a port-using function
   to load the preview.
2. `window.ts` learns to render that preview kind.
3. The triggering slice (notes editor or event modal) calls
   `peek.show(linkEl, deps)` on hover; nothing else changes.

## Conventions

- `stack.ts` is the single source of truth for "what's currently
  visible". Don't add a parallel registry.
- Windows position themselves via `getBoundingClientRect` of the
  trigger element. Don't pass coordinates in.
- Hover delay and dismiss timeout constants live at the top of
  `stack.ts`. Don't sprinkle magic numbers.

## Don't

- Don't open a peek window outside `stack.ts`. The stack handles
  Esc-to-close and click-outside.
- Don't fetch directly from `window.ts`. The fetcher comes from
  `resolve.ts` so a single resolution path is testable.
