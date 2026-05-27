---
name: add-loading-task
description: Use this skill when adding a new loading task to the campaign loader — e.g. pre-warming a cache, validating files, migrating data, or building a secondary index during campaign open. Enforces the LoadingTask contract and the registration pattern in src/main/index.ts.
---

# Add a Campaign Loading Task

Campaign open runs a sequential list of `NamedTask` entries through
`CampaignLoader`. Each task reports incremental progress; the loader
aggregates all tasks into a single percentage and streams it to the
renderer via IPC.

## When to use this skill

| Scenario | Use this skill? |
|---|---|
| Work that must complete before the campaign is usable | Yes |
| Heavy IO that benefits from a visible progress bar | Yes |
| Background work that can happen after open | No — do it lazily or on a file-change event |
| Renderer-side data loading | No — that goes through the data port, not here |

## Files

```
src/main/
  campaign-loader.ts          # LoadingTask type, NamedTask interface, CampaignLoader class
  entity-index.ts             # Reference implementation of a task function
  index.ts                    # Registration site — add your NamedTask here
  __tests__/
    campaign-loader.test.ts   # Tests for CampaignLoader itself (aggregation, sequencing, error)
    <your-task>.test.ts       # Add your own tests for the task function
```

## Interfaces

```ts
// src/main/campaign-loader.ts
export type LoadingTask = (onProgress: (completed: number, total: number) => void) => Promise<void>;

export interface NamedTask {
  name: string;   // shown in the loading overlay (e.g. "Building entity index")
  task: LoadingTask;
}
```

`completed` and `total` are raw counts in whatever unit makes sense
(files processed, bytes read, items validated). Keep them consistent
within one task — don't mix units.

## How progress aggregation works

`CampaignLoader` keeps a `{ completed, total }` slot per task.
On every `onProgress` call it sums across all slots:

```
percentage = Math.round(sum(completed) / sum(total) * 100)
```

Tasks that never call `onProgress` contribute 0/0 and are ignored in
the sum (no divide-by-zero). Tasks run **sequentially** — a task cannot
start until the previous one resolves.

The renderer subscribes via `window.fsApi.onLoadProgress` (set up in
`src/preload/index.cts`) and drives `CampaignLoadOverlay` through
`useCampaigns`. You do not need to touch the renderer unless the task
produces new data that must flow back to the renderer (see step 5).

## Recipe

### 1. Write the task function

Create `src/main/<your-task>.ts`. Export a named function that matches
the `LoadingTask` signature. Keep IO sync-friendly where possible
(Node's `fs` sync APIs inside a task are fine — the main process is not
the render thread):

```ts
// src/main/validate-timeline.ts
import * as fs from 'node:fs';
import * as path from 'node:path';

export function validateTimeline(
  campaignPath: string,
  onProgress: (completed: number, total: number) => void,
): void {
  const dir = path.join(campaignPath, 'timeline');
  if (!fs.existsSync(dir)) return;

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
  const total = files.length;

  for (let i = 0; i < files.length; i++) {
    // ... validate files[i]
    onProgress(i + 1, total);
  }
}
```

If your task is truly async (network, child process), make the function
`async` and `await` naturally. The signature that reaches
`CampaignLoader` is still `LoadingTask` — a function that receives
`onProgress` and returns `Promise<void>`.

### 2. Return data through the `campaign:open` result (if needed)

`campaign:open` in `src/main/index.ts` already returns `{ success, entityIndex }`.
If your task produces data the renderer needs:

- Declare a mutable variable alongside `entityIndex` (see the pattern
  used for `entityIndex`).
- Assign inside the task closure.
- Add the variable to the return object.
- Update `src/preload/index.cts` and `src/types/global.d.ts` if the
  shape of `fsApi.openCampaign`'s return type changes.

If your task is side-effects only (writes files, warms caches), skip
this step.

### 3. Register the task in `src/main/index.ts`

```ts
// src/main/index.ts — inside the ipcMain.handle('campaign:open', ...) handler

import { validateTimeline } from './validate-timeline.js';

let entityIndex: EntityIndexEntry[] = [];
let myData: MyData | null = null;   // only if you need to return data

const loader = new CampaignLoader([
  {
    name: 'Building entity index',
    task: async (onProgress) => {
      entityIndex = buildEntityIndex(resolvedPath, onProgress);
    },
  },
  {
    name: 'Validating timeline',          // shown in the loading overlay
    task: async (onProgress) => {
      validateTimeline(resolvedPath, onProgress);
    },
  },
]);
```

Tasks run in array order. Put fast tasks first so the progress bar
moves early and gives visual feedback.

### 4. Test the task function

Create `src/main/__tests__/<your-task>.test.ts`. Test the task function
directly — no need to wrap it in a `CampaignLoader`:

```ts
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { validateTimeline } from '../validate-timeline.js';

function makeTmpCampaign(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'campaign-'));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf-8');
  }
  return dir;
}

describe('validateTimeline', () => {
  it('reports one tick per file', () => {
    const dir = makeTmpCampaign({
      'timeline/event-a.md': '---\ntitle: A\n---\nbody',
      'timeline/event-b.md': '---\ntitle: B\n---\nbody',
    });
    const ticks: Array<[number, number]> = [];
    validateTimeline(dir, (c, t) => ticks.push([c, t]));
    expect(ticks).toEqual([[1, 2], [2, 2]]);
  });

  it('does nothing when the directory is absent', () => {
    const ticks: Array<[number, number]> = [];
    validateTimeline('/no/such/path', (c, t) => ticks.push([c, t]));
    expect(ticks).toHaveLength(0);
  });
});
```

See `src/main/__tests__/campaign-loader.test.ts` for how to test
multi-task aggregation behaviour using `CampaignLoader` directly.

### 5. Verify

```
npm test                        # all tests pass
npm run build                   # TypeScript clean
```

## Common pitfalls

- **Never call `onProgress(0, 0)` as a "start" signal.** The loader
  only tracks the last values you pass. A `0/0` emit is a no-op in the
  percentage math, but it will overwrite a previous non-zero slot and
  drag the aggregate back to 0 if called after any real progress.
- **Don't emit after the task resolves.** `onProgress` callbacks after
  the `await` of your task is gone are silently swallowed but indicate
  a logic error (e.g., a stray async callback firing late).
- **Keep `total` stable within a task.** Changing `total` mid-run
  causes the progress bar to jump backwards. Count first, then iterate.
  See `buildEntityIndex` in `entity-index.ts` for the `countFiles`
  → `scanDir` pattern.
- **Throw real errors.** `CampaignLoader` catches exceptions, sends
  `campaign:loadError` to the renderer, and rethrows. Don't swallow
  errors silently inside a task — let them propagate so the UI shows the
  error state.
- **Task name is user-visible.** It appears in the loading overlay
  (`CampaignLoadOverlay`) as `progress.taskName`. Use title-case prose
  ("Validating timeline files"), not identifiers ("validateTimeline").

## See also

- `src/main/campaign-loader.ts` — `LoadingTask`, `NamedTask`, `CampaignLoader`
- `src/main/entity-index.ts` — reference task implementation (`buildEntityIndex`)
- `src/main/index.ts` — registration site
- `src/preload/index.cts` — IPC bridge (`onLoadProgress`, `onLoadComplete`, `onLoadError`)
- `src/renderer/components/campaign-load-overlay.tsx` — the loading UI
- `src/renderer/hooks/useCampaigns.ts` — renderer-side state for load progress
