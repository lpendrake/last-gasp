# Shared Markdown Editor

A CodeMirror 6 wrapper for editing and previewing markdown. Used by notes and the timeline card expansion; intended for any surface that needs to display or edit markdown.

## Boundary rules

- **No imports from `../notes/` or any other host module.** This directory must be reusable from any surface. If you find yourself wanting to import notes-specific code, add a callback prop instead.
- **All file names are kebab-case.**
- **Host-specific behavior is injected, not detected.** No `if (isNotes)` branches. Add an optional config prop and have the host supply it.

## Module shape

- `markdown-editor.tsx` — `<MarkdownEditor>` React wrapper around CodeMirror 6.
- `markdown-preview.tsx` — `<MarkdownPreview>` thin read-only wrapper around `<MarkdownEditor>`. Use for non-editing surfaces (timeline card expansion, future peek windows). No `onChange` required.
- `format-toolbar.tsx` — `<FormatToolbar>` markdown-formatting buttons. Renders a host-supplied `footerSlot` in the right side of the toolbar.
- `commands.ts` — pure CodeMirror commands (bold/italic/heading/list/etc). Safe to import standalone for custom toolbars.
- `theme.ts` — `lastGaspThemeExtensions` styling + syntax highlighting.
- `extensions/wiki-links.ts` — `[[name|id]]` parsing, completion, click handler. Activated via `props.wikiLinks`.
- `extensions/decorations.ts` — markdown visual decorations (headings, bold, etc).
- `extensions/image-decorations.ts` — renders `![alt](url)` as an inline image widget. Accepts `resolveSrc` to transform raw image paths (e.g. relative paths → `notes-asset://`).
- `extensions/image-paste.ts` — clipboard paste. Calls `props.imagePaste.onImagePaste(blob, mime)` and inserts the returned URL.
- `extensions/drop-link.ts` — drag-and-drop. Calls `props.dropLink.decodeDrop(event)` and inserts the returned markdown.
- `domain/markdown/` — pure markdown manipulation functions (toggle inline/block, insert templates). No IO.

## Props contract

- `content` / `onChange` — controlled document. `onChange` is optional when `readOnly` is true.
- `readOnly` — when true, sets `EditorState.readOnly` and `EditorView.editable.of(false)`. Suppresses `highlightActiveLine`. `onChange` becomes optional.
- `isSourceMode` — toggles between live-decoration mode and plain source. Reconfigures a `Compartment`; never remounts.
- `images` — optional `{ resolveSrc?: (rawSrc: string) => string | null }`. Passed to `imageDecorations()`. Supply `resolveSrc` to render images with relative or non-`notes-asset://` URLs (e.g. timeline event bodies). Return `null` to skip rendering a given image.
- `savedInstance` / `onSaveInstance` — preserve doc + selection + undo history across host-level remounts (e.g., tab switching). The compartment is part of the saved instance and must round-trip.
- `viewRef` — imperative access for toolbars and focus management.
- `wikiLinks`, `imagePaste`, `dropLink` — optional host-supplied behaviors. Each is its own config object; omit to disable that feature entirely.

## How to add a new read-only preview surface

Use `<MarkdownPreview>` — it accepts `content`, `images`, `wikiLinks`, and `className`. Do not reach for a separate markdown library.

## How to add a new host

1. Import `MarkdownEditor` and `FormatToolbar` from `shared/markdown-editor`.
2. If you need wiki links, image paste, or drag-drop, build the config objects in a host-local `editor-bindings.ts`.
3. Mount `<FormatToolbar viewRef={viewRef} isEditable footerSlot={...} />` somewhere visible — usually a `<FooterPortal>` — and put host-specific controls (mode toggle, metadata panel, etc.) inside `footerSlot`.

## Tests

- `__tests__/markdown-editor.test.tsx` — wrapper behavior (mount, onChange, mode toggle, instance restore, viewRef lifecycle, footerSlot).
- `extensions/__tests__/*.test.ts` — per-extension unit tests.
- `domain/markdown/__tests__/*.test.ts` — pure function unit tests.

When you add a new extension, write its tests in `extensions/__tests__/`. When you change the wrapper's prop contract, update `markdown-editor.test.tsx` and the props table above.

## Editor architecture

### Extension stack

`<MarkdownEditor>` builds its extension list at mount time and never remounts for prop changes. The stack has two layers:

**Base extensions (always active, built once):**
CodeMirror standard extensions (history, keymaps, bracket matching, closeBrackets, etc.), the markdown language grammar with code language auto-detection, `lastGaspThemeExtensions`, `EditorView.lineWrapping`, and the `updateListener` that fires `onChange`. `imagePaste` and `dropLink` are pushed into this layer when their config objects are supplied — they must be fixed at mount and cannot be toggled.

**Mode compartment (hot-swappable via `Compartment`):**
`markdownDecorations()`, `imageDecorations(imagesConfig)`, `wikiLinks(...)`, and `markdownLinkClick(...)` are all bundled inside a single `Compartment`. In source mode the compartment holds an empty array; in live mode it holds these four. Switching mode calls `compartment.reconfigure(...)` — no editor recreation. The compartment instance is part of the `SavedEditorInstance` and must always round-trip with the state it belongs to.

### Read vs write mode

`readOnly` is applied once at mount by pushing `EditorState.readOnly.of(true)` and `EditorView.editable.of(false)` into the base extensions. `highlightActiveLine` is omitted in this case. Both read and write modes use the same CodeMirror instance with the same mode-compartment extensions — decorations, image widgets, and wiki-link widgets all work in read-only mode. `<MarkdownPreview>` is simply `<MarkdownEditor readOnly ... />` wrapped in a `<div>` for layout; it accepts `content`, `images`, `wikiLinks`, and `baseDir` (used by the peek stack for plain `<a>` link resolution).

### Host-local wiring: the `editor-bindings.ts` pattern

A host is responsible for constructing the config objects that activate optional editor behaviors. Notes does this in `src/renderer/notes/editor-bindings.ts`, which exports three factory functions:

- `makeImagePasteConfig(folder, campaignPath)` — returns an `ImagePasteConfig` with `onImagePaste` that saves the blob to `notes/{folder}/assets/pasted-*.ext` and returns a `notes-asset://` URL.
- `makeDropLinkConfig()` — returns a `DropLinkConfig` that decodes the `application/x-last-gasp-note` MIME type from sidebar drags and produces either a `![…](notes-asset://…)` or `[[label|id]]` insert.
- `makePeekWikiLinksConfig()` — returns the hover callbacks (`onHover`, `onHoverEnd`) that open/close the peek stack.

The host passes these config objects as `imagePaste`, `dropLink`, and a spread into `wikiLinks` props. The shared editor never knows about campaign paths, sidebar MIME types, or the peek system.

The event editor (`EventEditorModal.tsx`) follows the same approach with a simpler setup: no image paste, no drop-link, wiki-links wired inline with `suggestLinksForIndex`, `onOpenById`, peek hover callbacks, `knownIds`, and `entityLabelMap`. No `editor-bindings.ts` is needed when the config is short enough to build inline.

### How state flows into the editor

`knownIds` and `entityLabels` are React props on `WikiLinksHostConfig`, but they do **not** flow through React's prop update path in the usual way. After mount, the editor holds a stable CodeMirror view. When these props change (because the entity index updated), dedicated `useEffect` hooks dispatch `StateEffect`s directly onto the view:

```ts
view.dispatch({ effects: setKnownIds.of(wikiLinksConfig.knownIds) });
view.dispatch({ effects: setEntityLabels.of(wikiLinksConfig.entityLabels) });
```

Inside the wiki-links extension, `knownIdsField` and `entityLabelMapField` are `StateField`s that update in response to those effects. The decoration `StateField` rebuilds whenever either effect arrives (`e.is(setKnownIds) || e.is(setEntityLabels)`). This means decoration rebuilds are O(doc) but happen only when the index actually changes — not on every keystroke.

The same dispatch-based pattern applies to external content updates (file reloaded from disk) and mode toggles: all use `view.dispatch(...)` rather than remounting.

### Key distinction

The editor is a shared rendering primitive. Hosts are responsible for wiring behavior via config objects; they must not modify the editor. If you find yourself wanting to add host-specific logic inside `markdown-editor.tsx`, add a callback prop instead and implement the behavior in the host's `editor-bindings.ts` (or inline).

## Common pitfalls

- **Don't put the campaign path or folder into the editor's props.** That's a notes-ism. Build the IO callback in the host and pass it as `imagePaste.onImagePaste`.
- **Don't add a sidebar drag MIME type here.** Add a `dropMimeType` + `decodeDrop` config instead.
- **The compartment and its state are paired.** Never share a compartment instance across editor mounts unless you also share the saved state it belongs to.
- **`wikiLinks.knownIds` drives broken-link highlighting.** An empty set means "don't highlight any links as broken yet" — pass `undefined` if the index hasn't loaded yet.
