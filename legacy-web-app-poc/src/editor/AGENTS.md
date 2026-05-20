# `src/editor/` — Event Editor Modal (Vanilla DOM)

The modal for creating and editing event frontmatter + markdown bodies.
Vanilla TypeScript + DOM.

## Layout

```
editor/
  modal/
    index.ts            # orchestration: openCreateEditor, openEditEditor
    view.ts             # editorHtml template (DOM construction)
    fields.ts           # field wiring: title, date, tags, color, body
    save.ts             # save / cancel / conflict / discard flow
  drafts.ts             # debounced localStorage autosave
  drafts.test.ts
  conflict.ts           # conflict modal (separate from the editor modal)
  link-picker.ts        # @-mention dropdown for body field
  format-toolbar.ts     # bold/italic/etc. toolbar
```

## Layer rules

- May import `data/ports.ts` types and receive a port via deps —
  never construct one.
- May import `domain/*` for pure logic (e.g. event validation).
- May not import `timeline/*`, `notes/*`, or React.

## Add a field

1. Extend the event DTO in `data/types.ts` (and the server side in
   parallel).
2. Add the input element in `modal/view.ts`.
3. Wire `oninput` and validation in `modal/fields.ts`.
4. If the field affects the save flow (e.g. requires server-side
   conflict detection), update `modal/save.ts`.

## Add a save behaviour

Goes in `modal/save.ts`. Follows the existing mtime-conflict pattern:
write attempts include `If-Unmodified-Since` (the `Last-Modified`
captured when the editor opened); 409 routes to `conflict.ts`;
discard path returns to caller.

## Conventions

- Drafts in localStorage are keyed by `editor.draft.<id>` for edits or
  `editor.draft.new.<timestamp>` for creates. `drafts.ts` owns these
  keys; nothing else reads them.
- The modal is opened once at a time. `openCreateEditor` /
  `openEditEditor` return a Promise that resolves on save/cancel/
  discard so callers can refresh state.
- `format-toolbar.ts` and `link-picker.ts` are attached/detached as
  side modules — they get `attach(host, deps) → detach()` factories.

## Don't

- Don't call `fetch` directly. The save port is passed in via deps.
- Don't reimplement markdown rendering for the preview — use the same
  `markdown-it` instance the rest of the app uses (passed in).
