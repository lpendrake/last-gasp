# `src/timeline/` — Timeline View (Vanilla DOM)

The horizontally-scrollable timeline of events, sessions, and the
current-time marker. Vanilla TypeScript + DOM. No React.

## Layout

```
timeline/
  app.ts                  # controller, owns view state, wires render + interactions
                          # (orchestrator; ~480 lines, over the soft cap on purpose)
  render/
    axis.ts               # render time axis
    cards.ts              # render event cards (layout + DOM)
    session-bands.ts      # render session bands behind cards
    session-bands.test.ts
  interactions/
    zoom.ts               # math + types: ViewState, xToSeconds, secondsToX, zoomAbout, panByPixels
    pan.ts                # drag-pan
    reschedule.ts         # shift+drag a card to a new time
    quick-add-zones.ts    # below-axis hover indicator + click for quick-add / set-now
  event-modal.ts          # detail/edit modal
```

The composition root (`bootstrap/`) calls `createTimelineApp()` which
loads data, attaches all listeners, and returns the `TimelineApp`
control surface (`zoomBy`, `panBy`, `jumpToNow`, `collapseExpansion`,
`openSearch`, `isSearchOpen`).

## Layer rules

- May import `data/ports.ts` types and receive a port via deps —
  never construct one.
- May import `domain/*` for pure logic.
- May not import `notes/*`, `editor/*` internals (open the editor
  through a callback in deps), or React.

## Add a feature

See `.claude/skills/add-timeline-feature/SKILL.md`. Decide first
whether it's render or interaction:

- **Render** — turning state into pixels. Goes in `render/`. Pure-ish:
  takes view state, mutates a host element. No event listeners.
- **Interaction** — turning user input into state changes. Goes in
  `interactions/`. Owns its listeners and any transient DOM (e.g. a
  drag indicator) it creates inside the host. Exposes a small status
  API (`isActive()`, `wasMoved()`, …) so peers can suppress themselves.

If you're attaching listeners *and* mutating DOM, that's still a single
interaction module — render is for state-derived pixels, not transient
overlays driven by the gesture itself.

### Interaction coordination

Interactions running on the same host need to coordinate without one
file owning another's state. The timeline does this with two small
patterns:

- **Mousedown precedence**: register the higher-priority interaction
  first. Pan checks `reschedule.isActive()` before claiming the
  gesture. Quick-add bails when either is active.
- **Click suppression**: `pan.wasMoved()` and `reschedule.wasActivated()`
  are peek-only flags, cleared on the next mousedown. Both the
  `cardsLayer` click handler in `app.ts` and the container click
  handler inside `quick-add-zones.ts` may peek — neither consumes.

## Conventions

- **Render modules** export plain `renderX(host, ...args)` functions
  (see `render/axis.ts`, `render/cards.ts`, `render/session-bands.ts`).
  They're idempotent — call repeatedly with new state.
- **Interaction modules** export a `createX(host, deps) → controller`
  factory. The controller has `destroy()` plus a small status API
  (`isActive()`, `wasMoved()`, `wasActivated()`, …) used by peers and
  by the click handler in `app.ts`.
- View state (`ViewState`) lives in `app.ts`. Render modules read it
  via arguments; interaction modules read it via `deps.getView()` and
  request changes via `deps.setView()` or higher-level callbacks
  (`onQuickAdd`, `saveReschedule`, …).
- Coordinate math (seconds ↔ pixels) goes through `interactions/zoom.ts`
  helpers (`xToSeconds`, `secondsToX`). Don't reinvent.
- Tests for layout/zoom math are colocated (e.g.
  `render/session-bands.test.ts`). Keep that pattern.

## Don't

- Don't write to disk or call `fetch` here. All IO via the port in
  deps.
- Don't read `localStorage` outside `app.ts`. Persistence keys belong
  to the controller.
- Don't query DOM nodes from outside the host element you were given.

## See also

- `../AGENTS.md` for the cross-layer rules.
- `.claude/skills/add-timeline-feature/SKILL.md` for the recipe.
