# `src/renderer/peek/` — Hover-Preview Windows (React)

Floating preview windows that appear when hovering links in notes or
timeline cards. A small, self-contained system. Stack and hover wiring
land in sub-issue 2; this module only covers data resolution and rendering.

## Files

- `resolve.ts` — turns a link href or wiki-link id into a `PeekTarget` (kind + path).
- `parse-md.ts` — extracts title, body, and baseDir from raw markdown (pure).
- `peek-window.tsx` — React component rendered into a `document.body` portal.
- `show.ts` — imperative `showPeek()` API used by callers outside React trees.
- `peek.css` — styles for `.peek-window`, `.peek-header`, `.peek-body`, etc.

## Layer rules

- May import `../shared/markdown-editor/markdown-preview` — the only allowed
  cross-module import from outside `peek/`.
- Receives file content via an injected `fetcher(path, signal)` callback.
  Does NOT import `window.fsApi` directly.
- Fetcher contract: resolve to raw markdown, or reject with
  `err.code === 'ENOENT'` / `err.name === 'NotFoundError'` for not-found
  (triggers silent close; any other rejection shows an error state).
- May NOT import from `../notes/`, `../timeline/`, `../views/`.
  The initiating slice wires in peek; peek doesn't know who initiated.

## Add a peek target

To handle a new link format, add a resolution path in `resolve.ts` before the
plain-href fallback. `PeekWindow` renders all targets identically — both notes
and events are plain markdown files; the fetcher abstraction means the component
doesn't need to know what kind of entity it's showing.

## Conventions

- Windows position via `anchorRect: DOMRect` passed in at call time — no direct
  DOM measurement of the trigger element inside peek.
- The z-index counter (`zCounter`) in `peek-window.tsx` is the single source of
  truth for layering. Don't add a parallel registry.
- `show.ts` is the imperative entry point for non-React callers.
  React surfaces can render `<PeekWindow>` directly.

## Don't

- Don't fetch directly in `peek-window.tsx` outside the established `fetcher`
  prop pattern. Resolution + fetcher injection happens at the call site.
- Don't add hover delay, Esc handling, or stacking here. Those land in the
  stack manager in sub-issue 2.
