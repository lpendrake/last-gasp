/**
 * Canonical file-kind classification for the notes feature.
 *
 * Single source of truth for asset extensions and the helpers that derive
 * meaning from them.  Both main-process and renderer import from here so
 * adding a new extension is a one-line change.
 */

/** Asset file extensions (lowercase, with leading dot). */
export const ASSET_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);

/** Derive a simple extension from a filename or path (lowercase, with dot). */
function extOf(name: string): string {
  const base = name.split('/').pop() ?? name;
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot).toLowerCase() : '';
}

/**
 * Classify a file by its name / extension.
 * Returns 'note' | 'asset' | 'unsupported' — never null, never 'dir'.
 * Pass just the filename or the full path; only the last segment matters.
 */
export function classifyByExt(name: string): 'note' | 'asset' | 'unsupported' {
  const ext = extOf(name);
  if (ext === '.md') return 'note';
  if (ASSET_EXTENSIONS.has(ext)) return 'asset';
  return 'unsupported';
}

/** True when the kind represents content that can be opened and edited. */
export function isEditableNote(kind: string | undefined): boolean {
  return kind === 'note';
}

/**
 * True when the kind represents an actual file entry (not a virtual 'dir'
 * placeholder).  Use this for counts, drag targets, etc.
 */
export function isFileKind(kind: string | undefined): boolean {
  return kind === 'note' || kind === 'asset' || kind === 'unsupported';
}
