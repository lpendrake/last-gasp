# `src/main/` — Electron Main Process

Electron's main process: IPC handlers, file system access, file watcher, and the entity index.
All business logic that requires Node.js APIs lives here; the renderer communicates through IPC.

## Layout

```
main/
  index.ts                    # app bootstrap: BrowserWindow, menu, autoUpdater
  ipcHandlers.ts              # registers all IPC handlers (delegates to sub-registrars)
  entity-index.ts             # buildEntityIndex, indexSingleEntity, findEntityById
  entity-index-handlers.ts    # IPC handlers: entity:getAll, entity:updateLabelOverride
  fileWatcher.ts              # chokidar watcher → entity:indexDelta events
  campaign-state.ts           # getCampaignPath / setCampaignPath singleton
  campaign-loader.ts          # progress-reporting task runner for campaign open
  timelineIpcHandlers.ts      # timeline IPC (events, sessions, state, tags)
  windowManager.ts            # BrowserWindow lifecycle helpers
  __tests__/
    entity-index.test.ts      # integration tests using real tmp dirs
```

## Entity Index

The entity index is an in-memory (on the renderer side) + on-disk (in frontmatter) registry of
every tracked file in a campaign. It lets the renderer resolve entity IDs to display labels for
wiki links and inline tags without reading individual files.

### EntityIndexEntry shape

```ts
interface EntityIndexEntry {
  id: string;               // stable UUID from frontmatter
  path: string;             // campaign-relative forward-slash path, e.g. "notes/npcs/elara.md"
  title: string;            // frontmatter title (falls back to filename stem)
  type: 'note' | 'event' | 'asset';
  tagLabelOverride?: string;   // overrides title when entity appears as a tag
  linkLabelOverride?: string;  // overrides title when entity appears as a wiki link
}
```

Assets (images, etc. in `notes/`) carry `id: ''` and have no overrides — they exist in the index
so the link-suggestion UI can surface them.

### How the index is built

`buildEntityIndex(campaignPath, onProgress?)` scans `notes/` (`.md` + asset extensions) and
`timeline/` (`.md` only) recursively. For each `.md` file it calls `parseNote`, which assigns a
stable `id` and `title` if the frontmatter is missing them, writing the file back when it does
(`needsWrite`). Progress is reported as `(completed, total)` per file for the loading overlay.

This full build runs once at campaign open. The result is handed to the renderer via
`openCampaign`'s return value (`{ success: true; entityIndex: EntityIndexEntry[] }`).

### Delta updates (file watcher)

After load, `FileWatcher` (chokidar) keeps the renderer in sync without a full rebuild:

- **add / change** → `indexSingleEntity(fullPath, campaignPath)` re-parses the single file and
  emits `entity:indexDelta` with `{ op: 'add' | 'update', entry }`.
- **unlink** → emits `entity:indexDelta` with `{ op: 'remove', path }` (no disk read needed).

The renderer applies deltas with `applyEntityDelta` from `src/shared/entity-labels.ts`.

`indexSingleEntity` handles the same `needsWrite` logic as the bulk scan so auto-generated IDs
are persisted immediately.

### Label override flow

Two optional frontmatter keys — `tagLabelOverride` and `linkLabelOverride` — let the user rename
how an entity is displayed in tags and wiki links independently of its canonical title.

**Writing an override** goes through a single IPC handler:

```
entity:updateLabelOverride(id, target, value)
  target: 'tagLabel' | 'linkLabel'
  value:  string  → sets the key
          null    → deletes the key (reset to title)
```

`entity-index-handlers.ts` finds the file by ID, reads it, mutates the frontmatter, writes it
back, and returns. The file watcher then picks up the write and emits `entity:indexDelta` —
**no separate event is needed for overrides**.

**Reading an override** uses helpers in `src/shared/entity-labels.ts`:

```ts
effectiveTagLabel(entry)   // entry.tagLabelOverride ?? entry.title
effectiveLinkLabel(entry)  // entry.linkLabelOverride ?? entry.title
buildEntityLabelMap(index) // Map<id, effectiveLinkLabel>  (used by wiki-link renderer)
buildEntityTagLabelMap(index) // Map<id, effectiveTagLabel>  (used by tag chips)
```

Never access `tagLabelOverride` / `linkLabelOverride` directly — always go through these helpers.

## Data flow

```
campaign:open (IPC)
  └── buildEntityIndex → EntityIndexEntry[]
        └── returned inline to renderer (pendingEntityIndex in useCampaigns)

FileWatcher (chokidar)
  ├── add/change → indexSingleEntity → entity:indexDelta { op, entry }
  └── unlink     →                     entity:indexDelta { op: 'remove', path }

entity:updateLabelOverride (IPC)
  └── writes frontmatter → FileWatcher detects change → entity:indexDelta
```

Renderer side (`src/renderer/app.tsx`):
- `entityIndexRef` (stable ref) holds the live array.
- `entityLabelMap` / `entityTagLabelMap` (state) drive React re-renders.
- `onEntityDelta` listener calls `applyEntityDelta` and rebuilds both maps.

## Preload bridge

`src/preload/index.cts` exposes these methods on `window.fsApi`:

| Method | IPC channel |
|---|---|
| `getEntityIndex()` | `entity:getAll` |
| `updateEntityLabelOverride(id, target, value)` | `entity:updateLabelOverride` |
| `onEntityDelta(callback)` | `entity:indexDelta` (event, returns unsubscribe) |

The renderer-side port is `src/renderer/shared/entity-index.ts` — use it instead of calling
`window.fsApi` directly from renderer code.

## Conventions

- **Main process owns truth at rest.** Overrides live in frontmatter, not in a separate DB.
  The index is always reconstructible by re-scanning the campaign directory.
- **File watcher is the update bus.** Anything that mutates a `.md` file (rename, delete,
  frontmatter edit) automatically propagates through `entity:indexDelta`. Don't emit a separate
  event for label override writes.
- **`indexSingleEntity` is the canonical single-file parser.** Use it in tests and in any new
  code path that needs to read one entity's metadata.

## Don't

- Don't build a secondary label store in the renderer — the ref + two derived Maps in `app.tsx`
  are the source of truth on the renderer side.
- Don't call `buildEntityIndex` on every file change — use `indexSingleEntity` for incremental
  updates.
- Don't skip `effectiveTagLabel` / `effectiveLinkLabel` — reading `entry.title` directly ignores
  user-set overrides.
- Don't add new frontmatter keys for per-entity display config without updating both
  `indexSingleEntity` and `buildEntityIndex` (the bulk scanner) to read them.
