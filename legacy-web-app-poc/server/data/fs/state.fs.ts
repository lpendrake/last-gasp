import { promises as fs } from 'fs';
import { join } from 'path';
import { writeFileAtomic } from './atomic.ts';
import type { StateStore, StateName } from '../ports.ts';

/** Filesystem-backed StateStore.
 *
 * Each StateName maps to `<repoRoot>/<name>.json`. read() returns
 * the raw UTF-8 bytes (no JSON parsing on the way through) so the
 * GET handler can stream them as the response body unchanged. */
export function makeFsStateStore(repoRoot: string): StateStore {
  const filePath = (name: StateName) => join(repoRoot, `${name}.json`);

  return {
    async read(name) {
      const path = filePath(name);
      try {
        return await fs.readFile(path, 'utf-8');
      } catch (err: any) {
        if (err.code === 'ENOENT') return null;
        throw err;
      }
    },

    async write(name, content) {
      await writeFileAtomic(filePath(name), content);
    },
  };
}
