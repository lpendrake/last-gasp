---
name: add-peek-target
description: Use this skill when extending the hover-preview ("peek") system to a new entity type — e.g. peek for sessions, factions, plot threads, or anything beyond events and notes. Touches resolve, window, and the triggering slice.
---

# Add a Peek Target

The peek system shows a floating preview when the user hovers a link.
Three pieces are involved: resolution, rendering, and the trigger.

## Files

```
src/peek/
  resolve.ts        # link/href → { kind, path, fetcher }
  window.ts         # render one preview window
  stack.ts          # manages the LIFO of open windows
```

## Steps

1. **Teach `resolve.ts` the new kind.** Given an href or path, return
   `{ kind: 'faction', path, fetcher }` where `fetcher` is a function
   that takes the data port and returns the preview content.
2. **Teach `window.ts` to render that kind.** Add a branch in the
   render switch. Keep rendering pure-ish: take the preview data,
   produce DOM. Don't fetch from `window.ts` — that's `resolve.ts`'s
   contract.
3. **Add a CSS rule** in `src/styles/peek.css` if the new kind needs
   visual differentiation (badge colour, icon).
4. **Trigger from the relevant slice.** Whichever slice produces the
   link (notes editor, event modal, timeline card) calls
   `peek.show(linkEl, deps)` on hover. If the slice already calls
   `peek.show`, you're done. If it doesn't, this is the first peek
   trigger from that slice — wire `mouseenter`/`mouseleave` and call
   into the existing `stack.ts` API.

## Layer rules

- `peek/*` may not import any view slice. The trigger slice imports
  peek, not the other way around.
- `resolve.ts` returns a fetcher that closes over a data port.
  Adapters and ports are not the peek system's concern.
- Stay vanilla DOM. Peek is not a React tree.

## Conventions

- Hover delay and dismiss timeout constants live at the top of
  `stack.ts`. Don't sprinkle magic numbers in trigger sites.
- Windows position themselves from the trigger element's
  `getBoundingClientRect`. Don't pass coordinates in.
- A peek for a kind that fails to load shows an error window with
  the entity kind and id. Don't silently render empty.

## Verification

- `npm --prefix app run build` clean.
- `npm --prefix app test` green.
- Manual: hover a link of the new kind in the slice that triggers
  it; expect the window. Hover a stack of links; expect LIFO. Press
  Esc; expect dismissal.

## Don't

- Don't open a peek window outside `stack.ts` — bypassing the stack
  breaks Esc handling and click-outside.
- Don't fetch from `window.ts`. Resolution and fetching belong in
  `resolve.ts`.
- Don't add per-kind logic in trigger sites. The site calls
  `peek.show(linkEl, { port })` and forgets about it.

## See also

- `app/src/peek/AGENTS.md` for the local rules.
