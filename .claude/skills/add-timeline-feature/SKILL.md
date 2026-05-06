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
| State → pixels | User input → state |
| Idempotent re-render from state | Owns event listeners + transient DOM |
| No event listeners | Exposes a status API for peers |
| `render/axis.ts`, `render/cards.ts` | `interactions/pan.ts`, `interactions/reschedule.ts` |

If the feature has a transient overlay tied to the gesture itself
(e.g. the drag label that follows the cursor while rescheduling), that
DOM lives inside the interaction module — not in render. Render is
state-derived; gesture-overlays are gesture-owned.

## Files

```
src/timeline/
  app.ts                    # controller, owns ViewState; wires interactions
  render/
    axis.ts                 # renderAxis(host, view, size)
    cards.ts                # layoutCards + renderCards
    session-bands.ts        # computeSessionBands + renderSessionBands + findSessionConflicts
    session-bands.test.ts
  interactions/
    zoom.ts                 # math + types: ViewState, xToSeconds, secondsToX, zoomAbout, panByPixels
    pan.ts                  # createPan(container, deps)
    reschedule.ts           # createReschedule(container, deps)
    quick-add-zones.ts      # createQuickAddZones(container, deps)
  event-modal.ts
```

## Module shapes

**Render modules** export a plain `renderX(host, ...)` function. They
take whatever state they need and re-render idempotently. No
listeners, no internal DOM ownership beyond the children of `host`.

```ts
export function renderAxis(host: HTMLElement, view: ViewState, size: ViewportSize): void {
  host.innerHTML = '';
  // build axis DOM from view + size
}
```

**Interaction modules** export a `createX(host, deps) → controller`
factory. The controller has `destroy()` plus a small status API used
by peers and by the click handler in `app.ts`.

```ts
export interface PanController {
  destroy(): void;
  isDragging(): boolean;       // for peers — should I yield?
  wasMoved(): boolean;         // for the click handler — suppress?
}
export function createPan(container: HTMLElement, deps: PanDeps): PanController;
```

`app.ts` constructs interactions in priority order, threads `getView`
/ `setView` callbacks through deps, and never reads the modules'
internal state directly.

## Coordinate math

- `xToSeconds(viewState, x)` and `secondsToX(viewState, seconds)`
  live in `interactions/zoom.ts`. Use them. Don't reimplement.
- `viewState.pixelsPerSecond` is the only zoom representation. Don't
  cache derivations — they go stale.

## Add a render module

1. Create `src/timeline/render/<feature>.ts` exporting
   `render<Feature>(host, ...args)`.
2. The function builds DOM from its arguments. It's called by `app.ts`
   from `renderTimeline()` on every state change — keep it cheap.
3. Pure layout math (e.g. card placement) goes in a sibling
   `.test.ts`; see `render/session-bands.test.ts` for the pattern.
4. `app.ts` wires it into `renderTimeline()`.

## Add an interaction module

1. Create `src/timeline/interactions/<feature>.ts` exporting
   `create<Feature>(container, deps) → controller`.
2. Attach listeners in the factory. Remove them in `destroy()`. Any
   gesture-owned DOM (drag label, hover indicator) is created inside
   the factory and removed in `destroy()`.
3. State changes go via callbacks in `deps`:
   `deps.setView(nextViewState)`, `deps.onQuickAdd(seconds)`, …
4. Expose a status API for peers: `isActive()` / `wasMoved()` /
   `wasActivated()`. Read-only peeks; clear flags on the next
   mousedown so both `app.ts` and other interactions can poll without
   stepping on each other.
5. If your interaction needs to coordinate with an existing one
   (mousedown precedence, click suppression), wire it through deps —
   don't reach into another module's state.

### Coordination patterns the timeline already uses

- **Mousedown precedence**: `reschedule` registers before `pan`; pan
  checks `deps.isOtherDragActive()` before claiming the gesture.
- **Click suppression**: both the `cardsLayer` click in `app.ts` and
  the container click in `quick-add-zones` peek `pan.wasMoved()` and
  `reschedule.wasActivated()`. The flags clear on the next mousedown.

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
