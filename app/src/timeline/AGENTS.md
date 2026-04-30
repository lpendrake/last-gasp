# `src/timeline/` — Timeline View (Vanilla DOM)

The horizontally-scrollable timeline of events, sessions, and the
current-time marker. Vanilla TypeScript + DOM. No React.

## Current state vs target state

**Today:** rendering and interactions are a mix of files at the top of
the folder (`card.ts`, `axis.ts`, `zoom.ts`, `session-band.ts`,
`event-modal.ts`) plus 600+ lines of wiring in `src/main.ts`.

**Target (Phase 4):**

```
timeline/
  app.ts                  # controller, owns view state, wires render + interactions
  render/
    axis.ts               # render time axis
    cards.ts              # render event cards (layout + DOM)
    session-bands.ts      # render session bands behind cards
  interactions/
    zoom.ts               # mouse-wheel zoom (existing zoom.ts moves here)
    pan.ts                # drag-pan
    reschedule.ts         # ctrl+shift drag to reschedule
    quick-add-zones.ts    # double-click empty area for new event
  event-modal.ts          # detail/edit modal — small, can stay flat
```

`main.ts` calls `createTimelineApp(host, deps)` which returns
`{ update, destroy }`.

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
  `interactions/`. Attaches listeners to the host, calls back into
  `app.ts` with state updates.

If you're attaching listeners *and* mutating DOM, split it into a
render module and an interaction module that talk through `app.ts`.

## Conventions

- Modules export a factory: `createCardLayer(host, deps) → { update, destroy }`.
- View state (`ViewState`) lives in `app.ts`. Render modules read it;
  interaction modules request changes via callbacks.
- Coordinate math (seconds ↔ pixels) goes through `interactions/zoom.ts`
  helpers (`xToSeconds`, `secondsToX`). Don't reinvent.
- Tests for layout/zoom math are colocated (`zoom.test.ts`,
  `session-band.test.ts`). Keep that pattern.

## Don't

- Don't write to disk or call `fetch` here. All IO via the port in
  deps.
- Don't read `localStorage` outside `app.ts`. Persistence keys belong
  to the controller.
- Don't query DOM nodes from outside the host element you were given.

## See also

- `../AGENTS.md` for the cross-layer rules.
- `.claude/skills/add-timeline-feature/SKILL.md` for the recipe.
