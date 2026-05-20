import type { LinkIndexEntry } from '../../types/global';

export interface PeekTarget {
  path: string;
}

/**
 * Resolve a link (plain href or wiki-link id) to a peekable target.
 *
 * @param href      Raw href or wiki-link id
 * @param baseDir   Campaign-relative directory of the source file (e.g. "notes/npcs")
 * @param linkIndex Current link index entries (for wiki-link id lookup)
 */
export function resolvePeekTarget(
  href: string,
  baseDir: string,
  linkIndex: readonly LinkIndexEntry[],
): PeekTarget | null {
  if (!href) return null;

  // Wiki-link id path: no slashes, no anchor, no protocol, no .md extension
  if (
    !href.includes('/') &&
    !href.startsWith('#') &&
    !href.includes('://') &&
    !href.endsWith('.md')
  ) {
    const entry = linkIndex.find((e) => e.id === href);
    if (!entry) return null;
    if (entry.type === 'asset') return null;
    return { path: entry.path };
  }

  // Plain href — mirror legacy resolveHref line-for-line
  if (href.startsWith('#') || href.includes('://') || href.startsWith('mailto:')) return null;
  if (!href.endsWith('.md')) return null;

  try {
    const resolved = new URL(href, `http://x/${baseDir}/`);
    return { path: resolved.pathname.slice(1) };
  } catch {
    return null;
  }
}
