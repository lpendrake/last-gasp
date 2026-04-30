---
name: add-notes-feature
description: Use this skill when adding to the React notes view — folder sidebar, tabs, breadcrumbs, live editor, link picker, file operations, drafts, etc. Enforces the React conventions and hook/component/service split in app/src/notes/AGENTS.md.
---

# Add a Notes Feature

The notes view is React, not vanilla DOM. Pick the right kind of
module before writing any code.

## Decide: hook, component, service, or markdown helper?

| Kind | When | Folder |
|---|---|---|
| **Hook** | State, effects, subscriptions, refs | `notes/hooks/` |
| **Component** | JSX only, takes props, returns elements | `notes/components/` |
| **Service** | Pure logic that needs to be testable without React | `notes/services/` |
| **Markdown helper** | String → string or string → DOM rendering of markdown | `notes/editor/markdown/` |

If your feature has more than one of these (most do), make one of each
and have the component compose them. **Don't dump everything into
`Notes.tsx`** — that's the file we're trying to keep under 400 lines.

## Files (target structure)

```
notes/
  Notes.tsx                   # orchestrator
  types.ts
  hooks/
    useSaveSync.ts
    useFolderTree.ts
    useLinkPicker.ts
    useCaretTracking.ts
  components/
    FolderSidebar.tsx
    EditorTabs.tsx
    BreadcrumbNav.tsx
    EditorContent.tsx
    QuickAdd.tsx
    NoteContextMenu.tsx
  editor/
    LiveEditor.tsx
    LinkPickerDropdown.tsx
    markdown/
      inline.ts
      line.ts
      caret.ts
    upload.ts
  services/
    file-ops.ts
```

## Hook conventions

- Filename `useThing.ts`, exports `useThing(...)`.
- Extract a hook when a `useState` + `useEffect` block is over ~30
  lines, or when two components need it. One-off six-line `useState`s
  stay inline.
- Hooks own their localStorage keys. Document the key at the top:
  `// localStorage: notes.openTabs.v1`.
- Never import from `components/` — hooks are below components.

## Component conventions

- One component per file. Filename matches the export.
- Components take props and return JSX. No fetching, no localStorage,
  no business logic. Push that into a hook or service.
- Props are typed inline or in `types.ts` if shared.
- Default to function components; never class components.

## Service conventions

- Pure (or at least dep-injected) functions. No React imports.
- Take the data port as an argument, not via React context — services
  need to be unit-testable.
- Tests live in a sibling `.test.ts`.

## Markdown helper conventions

- Pure functions, no React, no DOM beyond what the editor's
  `contentEditable` layer needs.
- `inline.ts` — `escHtml`, `renderInline` (image, link, bold, italic,
  code patterns).
- `line.ts` — `classifyLine`, `lineHtml`. Per-kind rendering.
- `caret.ts` — `saveCaret`, `restoreCaret`, position helpers.
- `upload.ts` — paste/drag asset handling.

## Touching the data layer

- Use the data port from React via the existing context/provider
  pattern in `Notes.tsx`. Don't import `data/http/*` from a
  component.
- Autosave goes through `useSaveSync`. Don't add a parallel save
  path.

## Style

CSS goes in `src/styles/notes/<section>.css`. Don't introduce
CSS-in-JS, CSS modules, or inline style objects beyond one-off
transient UI states.

## Verification

- `npm --prefix app run build` clean.
- `npm --prefix app test` green. Hooks and services have tests;
  components don't (we don't run a React renderer in tests).
- Manual handoff to the user: open a note, edit, autosave, switch
  tabs, rename, delete, drag-drop a link.

## Don't

- Don't reach into `LiveEditor`'s contentEditable from outside —
  pass props in, listen via callbacks.
- Don't write to disk paths from React. The data port hides paths.
- Don't introduce a state-management library. `useState` + a few
  hooks is enough; if it isn't, that's a conversation, not a
  decision.

## See also

- `app/src/notes/AGENTS.md` for the local rules.
- `app/src/AGENTS.md` for the cross-slice rules.
