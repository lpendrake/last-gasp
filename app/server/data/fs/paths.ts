import { resolve, relative, sep } from 'path';

/** Top-level directories never shown in the notes sidebar. */
export const NOTES_EXCLUDED = new Set([
  'events', 'app', 'designe', 'node_modules', '.notes-trash', 'maps',
]);

/** Image extensions accepted as note assets and via /api/file. */
export const ASSET_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']);

/** Mapping from image extension to MIME type for HTTP responses. */
export const IMAGE_MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
};

/** Top-level note directories scanned by the link-index endpoint. */
export const SCAN_DIRS = [
  'events', 'npcs', 'factions', 'locations', 'plots',
  'sessions', 'rules', 'player-facing', 'misc',
];

/** Resolve a repo-relative path to an absolute path, refusing to escape. */
export function safeResolveInRepo(repoRoot: string, relPath: string): string | null {
  if (relPath.includes('..')) return null;
  const absolute = resolve(repoRoot, relPath);
  const relCheck = relative(repoRoot, absolute);
  if (relCheck.startsWith('..') || relCheck.startsWith(sep + '..')) return null;
  return absolute;
}

/** A folder name is valid if it has no separators, no leading dot, and is not in NOTES_EXCLUDED. */
export function validNoteFolder(folder: string): boolean {
  return !folder.includes('/') && !folder.includes('\\')
    && !folder.startsWith('.') && !NOTES_EXCLUDED.has(folder);
}

/** Resolve a note path inside a valid note folder; returns null if either is unsafe. */
export function safeNoteResolve(repoRoot: string, folder: string, notePath: string): string | null {
  if (!validNoteFolder(folder)) return null;
  return safeResolveInRepo(repoRoot, `${folder}/${notePath}`);
}
