import { promises as fs } from 'fs';
import { dirname } from 'path';
import { randomBytes } from 'crypto';

/**
 * Atomic file write: temp file → fsync → rename → fsync parent dir.
 *
 * A crash at any instant leaves the file in either the old-complete or
 * new-complete state. Never partial, never corrupt
 */
export async function writeFileAtomic(path: string, content: string | Uint8Array): Promise<void> {
  const tempPath = `${path}.${randomBytes(6).toString('hex')}.tmp`;

  // Write temp file, then fsync to force data to disk
  const handle = await fs.open(tempPath, 'w');
  try {
    await handle.writeFile(content);
    await handle.sync();
  } finally {
    await handle.close();
  }

  // Atomic rename (POSIX and NTFS both guarantee this)
  try {
    await fs.rename(tempPath, path);
  } catch (err) {
    // Clean up temp file on failure
    try { await fs.unlink(tempPath); } catch { /* ignore */ }
    throw err;
  }

  // Fsync the parent directory so the rename itself is persisted.
  // No-op on Windows (opening a directory fails), so ignore EISDIR/EPERM.
  try {
    const dirHandle = await fs.open(dirname(path), 'r');
    try {
      await dirHandle.sync();
    } finally {
      await dirHandle.close();
    }
  } catch {
    // Windows can't fsync a directory; that's fine.
  }
}
