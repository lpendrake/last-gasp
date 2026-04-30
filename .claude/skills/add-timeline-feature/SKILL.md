---
name: add-timeline-feature
description: Use this skill when adding rendering or interaction behaviour to the timeline view (zoom, pan, card layout, session bands, axis, drag-to-reschedule, hover effects, etc.). Vanilla TypeScript + DOM, no React. Enforces the render/interaction split in app/src/timeline/AGENTS.md.
---

# Add a Timeline Feature

The timeline is vanilla TypeScript + DOM. Two kinds of code live here:
**render** (state → pixels) and **interaction** (input → state). Keep
them separate.

## Decide first: render or interaction?

| Render | Interaction |
|---|---|
| Mutates a host element | Attaches `addEventListener` |
| Reads view state | Reads user input |
| Pure-ish | Calls back with state changes |
| `render/axis.ts`, `render/cards.ts` | `interactions/zoom.ts`, `interactions/pan.ts` |

If the feature is both — say, drag-to-reschedule renders a ghost card
while dragging — split it. The interaction module emits "draft state"
into `app.ts`; the render module reads it.

## Files

```
src/timeline/
  app.ts                    # controller, owns ViewState
  render/
    axis.ts
    cards.ts
    session-bands.ts
  interactions/
    zoom.ts                 # xToSeconds, secondsToX, zoomAbout, panByPixels
    pan.ts
    reschedule.ts
    quick-add-zones.ts
  event-modal.ts
```

## Module shape

Every timeline module exports a factory:

```ts
export function createCardLayer(host: HTMLElement, deps: CardDeps) {
  // attach DOM, listeners, etc.
  return {
    update(state: ViewState) { /* re-render */ },
    destroy() { /* remove listeners, clear DOM */ },
  };
}
```

`app.ts` calls `update(state)` whenever ViewState changes. `destroy()`
runs on view-switch (timeline → notes).

## Coordinate math

- `xToSeconds(viewState, x)` and `secondsToX(viewState, seconds)`
  live in `interactions/zoom.ts`. Use them. Don't reimplement.
- `viewState.pixelsPerSecond` is the only zoom representation. Don't
  cache derivations — they go stale.

## Add a render module

1. Create `src/timeline/render/<feature>.ts` exporting
   `create<Feature>Layer(host, deps)`.
2. In the factory, create the DOM scaffolding once and store
   references.
3. `update(state)` re-renders idempotently from `state`. Reuse DOM
   nodes; don't `innerHTML = ''` on every frame.
4. `app.ts` wires it in.
5. Tests: layout math goes in a sibling `.test.ts` (no DOM); see
   `session-band.test.ts`.

## Add an interaction module

1. Create `src/timeline/interactions/<feature>.ts` exporting
   `create<Feature>(host, deps)`.
2. Attach listeners in the factory; remove them in `destroy()`.
3. Don't mutate DOM directly except for transient feedback (e.g.
   cursor style). Persistent visuals are render's job.
4. State changes go via callbacks in `deps`:
   `deps.onZoomChange(nextViewState)`.

## Touching the data layer

- Receive a port via `deps`. Don't import `data/http/*` directly.
- Don't call `fetch`. Don't read `localStorage` outside `app.ts`.

## Style

CSS goes in `src/styles/timeline.css` (or a new file imported by
the composition root in `bootstrap/`). Class names are slice-prefixed:
`.timeline-…`.

## Verification

- `npm --prefix app run build` clean.
- `npm --prefix app test` green.
- Manual handoff to the user for browser verification: scroll, zoom,
  pan, click, drag — the feature plus the existing flows.

## Don't

- Don't introduce React in this slice.
- Don't query DOM nodes outside the host you were given.
- Don't import `notes/*` or `editor/modal/*` internals; if you need
  to open an editor or peek window, take a callback in `deps`.

## See also

- `app/src/timeline/AGENTS.md` for the local rules.
- `app/src/AGENTS.md` for the cross-slice rules.
