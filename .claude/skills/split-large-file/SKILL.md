---
name: split-large-file
description: Use this skill when a TypeScript or TSX file in app/ crosses ~250 lines, or when an existing file is hard to navigate. Walks through identifying seams, planning the split with a Plan agent, executing the split in commits that keep tests green, and updating the relevant AGENTS.md.
---

# Split a Large File

Files over ~300 lines are agent-hostile: every read costs context, and
every edit risks fighting unrelated code. When you cross ~250, plan a
split. When you cross ~300, do it.

## When to skip splitting

- **Test files** with many small, parallel cases — fine to be long.
- **Generated code** — leave it alone; refactor the generator.
- **Single coherent unit** that genuinely doesn't decompose (rare;
  almost everything decomposes). Document why in a comment at the top.

## Steps

### 1. Read the file end to end

Don't split blind. Read it once before deciding seams. Files often
have natural sections (state, effects, helpers, render) marked by
comments or function clusters.

### 2. Identify seams

Look for:

- **Top-level functions with no shared mutable state** — pure
  candidates for extraction.
- **Sub-components inside a `.tsx`** — own file each.
- **Helper functions used only by one section** — they go with that
  section.
- **`useState` / `useEffect` clusters** — extract into a hook.
- **DOM construction blocks** — `view.ts` / `template.ts`.
- **Persistence (localStorage / fetch)** — its own module.

### 3. Plan with a Plan agent

For non-trivial splits (more than three new files), launch the Plan
agent with the file contents and a seams list. The Plan agent
returns a per-file map; you execute it.

### 4. Execute one seam per commit

Each commit:

1. Creates the new file with the extracted code.
2. Updates the original to import from the new file.
3. Keeps `npm --prefix app run build` and `npm --prefix app test`
   green.
4. Has a message like `extract X from <original>` — small and
   verifiable.

If a seam doesn't fit in one commit cleanly, it's actually two
seams. Split it further.

### 5. Verify behaviour didn't drift

The split is structural. After all commits:

- `npm --prefix app run build` clean.
- `npm --prefix app test` green.
- Manual handoff to the user: exercise the slice end-to-end.
- Re-grep for files >300 lines to confirm the original is now small
  enough.

### 6. Update the relevant AGENTS.md

If the split introduces a new folder or convention, the slice's
`AGENTS.md` documents it. If the split simply followed an existing
target structure described in that AGENTS.md, no update is needed.

## Common seams

- `Notes.tsx` (1107) → hooks, components, services, editor
  subfolder. See `app/src/notes/AGENTS.md`.
- `LiveEditor.tsx` (697) → `editor/markdown/{inline,line,caret}.ts`,
  `editor/upload.ts`, `editor/LinkPickerDropdown.tsx`.
- `server/api.ts` (838) → `http/`, `domain/`, `data/fs/`,
  `index.ts`. See `app/server/AGENTS.md`.
- `src/main.ts` (768) → `bootstrap/{mount,view-switcher,shortcuts}.ts`,
  `timeline/app.ts`.
- `editor/modal.ts` (534) → `modal/{index,view,fields,save}.ts`.
- `panels/filters.ts` (421) →
  `filters/{types,logic,sidebar,persistence}.ts`.

## Don't

- Don't rename functions during the split. Rename in a separate
  commit before or after; keeping the same names makes the diff
  reviewable.
- Don't change behaviour during the split. Bug fixes happen
  separately.
- Don't stop at "moved everything to one new file". That's not a
  split; that's a rename.
- Don't introduce new abstractions that weren't there. The split
  exposes existing structure; it doesn't invent it.

## See also

- `app/AGENTS.md` for the file-size convention.
- The slice's `AGENTS.md` for the target structure.
