# `src/renderer/notes/` — Notes View

The folder/file browser and tabbed notes editor.

## Layout

```
notes/
  notes.tsx                   # view-level component
  data.ts                     # thin wrapper over window.fsApi (IO boundary)
  scan-folder.ts              # scanFolderContents — IO-only, no React
  editor-bindings.ts          # pure config-builder functions
  types.ts
  domain/                     # pure functions, no IO
    slugify.ts
    open-note-by-path.ts      # parseNotePath — also used by global search-to-notes flow
    link-resolution.ts        # resolveLinkById, resolveMarkdownHref
    __tests__/
  hooks/
    useNotesController.ts     # orchestrator (see ceiling note)
    useSaveSync.ts
    useFolderTree.ts
  components/
    folder-sidebar.tsx
    editor-tabs.tsx
    breadcrumb-nav.tsx
    meta-panel.tsx
    note-context-menu.tsx
    quick-add.tsx
  __tests__/                  # cross-cutting tests
  styles/
```

## Layer rules

- **`domain/`** — pure functions. No IO, no React. Each function is a deterministic transform on
  its inputs. Tested directly in `domain/__tests__/`.
- **Top-level `.ts` files** (`scan-folder.ts`, `editor-bindings.ts`, `data.ts`) — logic that has
  IO side effects (filesystem calls via `notesData` / `window.fsApi`). Unlike `domain/`, these are
  not pure — tests mock the IO boundary with `vi.mock`.
- **`hooks/`** — React state and effects. May import `domain/` and the top-level helpers.
- **`components/`** — `.tsx` files that render markup and surface events via props. No business
  logic, no direct imports of `notesData`.

## useNotesController ceiling

The orchestrator is ~750 lines. The remaining length is file-ops handlers (`handleRename*`,
`handleDelete*`, `handleMove`, `commitNew*`, `handleQuickAddCreate`). Each drives 5–10 setState
calls in a fixed sequence; the interesting part is the state computation, not the sequencing.

**The right pattern when a handler grows or needs a test:** extract the computation into a pure
function in `domain/` — e.g. `computeTabStateAfterDelete(tabs, activeTab, folder, path)` takes
state arrays and returns new ones. The handler calls it and feeds the result into the setters.
No setter-threading required.

**The orchestrator is a sequencer, not a logic owner.** New logic goes in `domain/`.

## Conventions

- Hooks coordinate state and effects; they call `domain/` functions and do not contain the
  logic themselves.
- One `.tsx` component per file in kebab-case. Components render markup and delegate everything
  else to their hook or parent via props.
- `domain/` for pure logic; top-level `.ts` files for non-React IO.

## Don't

- Don't call `window.fsApi` directly from React. Go through `data.ts` or a top-level helper.
- Don't reimplement folder tree state — `useFolderTree` is the source of truth.
- Don't put logic in the orchestrator. Extract the computation and call it.
