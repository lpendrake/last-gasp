import { promises as fs } from 'fs';
import { join } from 'path';
import type { EventTrashStore, TrashEntry } from '../ports.ts';

/** Filesystem-backed EventTrashStore.
 *
 * Trash lives under `<repoRoot>/events/.trash/`. The directory is
 * created on demand. */
export function makeFsEventTrashStore(repoRoot: string): EventTrashStore {
  const EVENTS_DIR = join(repoRoot, 'events');
  const TRASH_DIR = join(EVENTS_DIR, '.trash');

  async function ensureTrashDir() {
    await fs.mkdir(TRASH_DIR, { recursive: true });
  }

  return {
    async list(): Promise<TrashEntry[]> {
      await ensureTrashDir();
      const files = await fs.readdir(TRASH_DIR);
      const out: TrashEntry[] = [];
      for (const f of files) {
        if (!f.endsWith('.md')) continue;
        const full = join(TRASH_DIR, f);
        const stat = await fs.stat(full);
        out.push({ filename: f, trashedAt: stat.mtime, size: stat.size });
      }
      return out;
    },

    async exists(filename) {
      try { await fs.access(join(TRASH_DIR, filename)); return true; } catch { return false; }
    },

    async restore(filename, restoreAs) {
      const src = join(TRASH_DIR, filename);
      const dest = join(EVENTS_DIR, restoreAs);
      await fs.rename(src, dest);
    },

    async remove(filename) {
      try { await fs.unlink(join(TRASH_DIR, filename)); }
      catch (err: any) { if (err.code !== 'ENOENT') throw err; }
    },

    async empty() {
      await ensureTrashDir();
      const files = await fs.readdir(TRASH_DIR);
      for (const f of files) {
        if (f.endsWith('.md')) await fs.unlink(join(TRASH_DIR, f));
      }
    },
  };
}
