# `src/notes/` — Notes View (React)

The folder/file browser, tabbed editor, and live markdown editor for
notes (NPCs, locations, factions, plots, etc.). React, not vanilla DOM.

## Layout

```
notes/
  Notes.tsx                   # slice orchestrator
  types.ts
  hooks/
    useSaveSync.ts            # autosave + mtime conflict
    useFolderTree.ts          # tree memoisation
    useLinkPicker.ts          # @ autocomplete
    useCaretTracking.ts       # selection/caret state
  components/
    FolderSidebar.tsx
    EditorTabs.tsx
    BreadcrumbNav.tsx
    EditorContent.tsx         # mode dispatcher (live/source/split)
    QuickAdd.tsx
    NoteContextMenu.tsx
  editor/
    LiveEditor.tsx
    LinkPickerDropdown.tsx
    markdown/
      inline.ts               # escHtml, renderInline
      line.ts                 # classifyLine, lineHtml
      caret.ts                # save/restoreCaret
    upload.ts                 # handlePaste image conversion
  services/
    file-ops.ts               # rename / delete / move / migrate
```

## Layer rules

- May import `data/ports.ts` types and receive a port via deps (or via
  a top-level provider — Notes.tsx is the composition root for this
  slice).
- May import `domain/*` for shared logic.
- May not import `timeline/*`, `panels/*`, `editor/*`, `peek/*`.

## React conventions

- One component per file. Filename matches the export.
- **Hooks** for state and effects. Extract a hook when a block of
  `useState` / `useEffect` is over ~30 lines or reused.
- **Components** for JSX only. They take props, return JSX, do nothing
  else.
- **Services** (`services/`) for non-React logic that needs to be
  testable without a renderer. File ops, link resolution, etc.
- **Markdown helpers** (`editor/markdown/`) are pure functions. No
  React, no DOM beyond what the contentEditable layer needs.
- Styles are global CSS in `src/styles/notes/`. Don't introduce
  CSS-in-JS or CSS modules.

## Add a feature

See `.claude/skills/add-notes-feature/SKILL.md`. Decide first whether
it's:

- A **hook** — state or side effect.
- A **component** — JSX.
- A **service** — pure logic.
- A **markdown helper** — pure rendering of markdown bits.

Each lives in its respective folder. Don't dump everything into
`Notes.tsx`.

## Conventions

- Tabs persist via localStorage key `notes.openTabs.v1`.
- File state ('clean' / 'dirty' / 'saving' / 'conflict') comes from
  `useSaveSync`. Don't track it in component state separately.
- Drag-drop uses HTML5 drag API. Payloads are JSON-encoded.

## Don't

- Don't call `fetch` directly. Go through the data port.
- Don't write to disk paths from React. The data port hides paths.
- Don't reimplement folder tree state. `useFolderTree` is the source
  of truth.
