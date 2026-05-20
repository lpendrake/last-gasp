import { promises as fs } from 'fs';
import { join } from 'path';
import { writeFileAtomic } from './atomic.ts';
import type { EventStore, EventRecord, EventStat } from '../ports.ts';

/** Filesystem-backed EventStore.
 *
 * Events live as `<repoRoot>/events/*.md`. Soft-deletes go to
 * `<repoRoot>/events/.trash/`. Adapter responsibilities:
 *   - read/write/list/stat/rename, no business logic
 *   - return null for "not found", throw for unexpected IO errors
 *   - never validate filenames (that's domain), never throw typed
 *     domain errors (those come from domain functions). */
export function makeFsEventStore(repoRoot: string): EventStore {
  const EVENTS_DIR = join(repoRoot, 'events');
  const TRASH_DIR = join(EVENTS_DIR, '.trash');

  async function dirExists(path: string): Promise<boolean> {
    try { await fs.access(path); return true; } catch { return false; }
  }

  async function ensureTrashDir() {
    await fs.mkdir(TRASH_DIR, { recursive: true });
  }

  async function statOrNull(filepath: string) {
    try {
      const stat = await fs.stat(filepath);
      return stat.isFile() ? stat : null;
    } catch (err: any) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
  }

  return {
    async list(): Promise<EventRecord[]> {
      if (!(await dirExists(EVENTS_DIR))) return [];
      await ensureTrashDir();
      const files = await fs.readdir(EVENTS_DIR);
      const out: EventRecord[] = [];
      for (const filename of files) {
        if (!filename.endsWith('.md') || filename === 'README.md') continue;
        const filepath = join(EVENTS_DIR, filename);
        const stat = await statOrNull(filepath);
        if (!stat) continue;
        const content = await fs.readFile(filepath, 'utf-8');
        out.push({ filename, content, mtime: stat.mtime });
      }
      return out;
    },

    async get(filename) {
      const filepath = join(EVENTS_DIR, filename);
      const stat = await statOrNull(filepath);
      if (!stat) return null;
      const content = await fs.readFile(filepath, 'utf-8');
      return { content, mtime: stat.mtime };
    },

    async stat(filename): Promise<EventStat | null> {
      const filepath = join(EVENTS_DIR, filename);
      const stat = await statOrNull(filepath);
      if (!stat) return null;
      return { mtime: stat.mtime };
    },

    async exists(filename) {
      const filepath = join(EVENTS_DIR, filename);
      try { await fs.access(filepath); return true; } catch { return false; }
    },

    async put(filename, content) {
      await fs.mkdir(EVENTS_DIR, { recursive: true });
      const filepath = join(EVENTS_DIR, filename);
      await writeFileAtomic(filepath, content);
      const stat = await fs.stat(filepath);
      return { mtime: stat.mtime };
    },

    async softDelete(filename, trashName) {
      await ensureTrashDir();
      const src = join(EVENTS_DIR, filename);
      const dest = join(TRASH_DIR, trashName);
      await fs.rename(src, dest);
    },
  };
}
