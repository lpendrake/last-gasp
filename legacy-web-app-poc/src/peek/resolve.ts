/**
 * Resolve a markdown href to a repo-relative path suitable for /api/file/:path.
 * Returns null for external links, anchor links, or non-.md targets.
 *
 * @param href    Raw href attribute value
 * @param baseDir Directory of the source file, relative to repo root (e.g. "events")
 */
export function resolveHref(href: string, baseDir: string): string | null {
  if (!href || href.startsWith('#') || href.includes('://')) return null;
  if (!href.endsWith('.md')) return null;
  try {
    const resolved = new URL(href, `http://x/${baseDir}/`);
    return resolved.pathname.slice(1); // strip leading /
  } catch {
    return null;
  }
}
