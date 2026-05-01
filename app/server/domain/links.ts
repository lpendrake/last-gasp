import type { NoteStore } from '../data/ports.ts';

/** Regex matching all markdown links: `[text](href)` and `![alt](href)` */
const LINK_RE = /\]\(([^)]+)\)/g;

/**
 * After a rename or move, scan all notes in the repo and rewrite any
 * markdown links that pointed at the old path so they point at the
 * new path.
 *
 * Returns the number of files whose content changed.
 */
export async function updateNotesLinks(
  store: NoteStore,
  oldFolder: string, oldPath: string,
  newFolder: string, newPath: string,
  isDir: boolean,
): Promise<number> {
  const oldKey = oldPath === '' ? oldFolder : `${oldFolder}/${oldPath}`;
  const newKey = newPath === '' ? newFolder : `${newFolder}/${newPath}`;

  const allFiles = await store.listAllNoteMarkdown();
  let changed = 0;

  for (const repoRelPath of allFiles) {
    const srcTopFolder = repoRelPath.split('/')[0];
    const content = await store.readMarkdown(repoRelPath);
    if (content === null) continue;

    let modified = false;
    const newContent = content.replace(LINK_RE, (_match, href: string) => {
      // Skip absolute URLs
      if (href.startsWith('/') || href.includes('://') || href.startsWith('mailto:')) return _match;

      // Compute absolute key for this href
      let absKey: string;
      if (href.startsWith('../')) {
        absKey = href.slice(3); // strip "../"
      } else {
        absKey = `${srcTopFolder}/${href}`;
      }

      // Check if absKey matches the renamed path
      const exactMatch = absKey === oldKey;
      const prefixMatch = isDir && (absKey === oldKey || absKey.startsWith(oldKey + '/'));
      if (!exactMatch && !prefixMatch) return _match;

      // Compute new absolute key
      const newAbsKey = prefixMatch && absKey !== oldKey
        ? newKey + absKey.slice(oldKey.length)
        : newKey;

      // Compute new href relative to the scanning file's top folder
      const destTopFolder = newAbsKey.split('/')[0];
      const newHref = destTopFolder === srcTopFolder
        ? newAbsKey.split('/').slice(1).join('/')
        : `../${newAbsKey}`;

      modified = true;
      return `](${newHref})`;
    });

    if (modified) {
      await store.writeMarkdown(repoRelPath, newContent);
      changed++;
    }
  }
  return changed;
}
