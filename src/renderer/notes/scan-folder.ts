import { notesData } from './data';
import type { LinkIndexEntry } from '../../types/global';
import type { NoteEntry } from './types';

export async function scanFolderContents(
  campaignPath: string,
  folder: string,
  index: readonly LinkIndexEntry[],
): Promise<NoteEntry[]> {
  const results: NoteEntry[] = [];

  async function scan(dirPath: string, relPrefix: string): Promise<boolean> {
    let items: { name: string; isDirectory: boolean }[];
    try {
      items = await notesData.listFolder(dirPath);
    } catch {
      return false;
    }

    let hasChildren = false;
    for (const item of items) {
      if (item.name.startsWith('.')) continue; // skip dotfiles
      if (item.isDirectory) {
        const childRel = relPrefix ? `${relPrefix}/${item.name}` : item.name;
        const childHasChildren = await scan(`${dirPath}/${item.name}`, childRel);
        if (!childHasChildren) {
          results.push({ id: '', path: childRel, title: item.name, kind: 'dir' });
        }
        hasChildren = true;
      } else {
        const relPath = relPrefix ? `${relPrefix}/${item.name}` : item.name;
        const indexEntry = index.find((e) => e.path === `notes/${folder}/${relPath}`);
        if (indexEntry) {
          results.push({
            id: indexEntry.id,
            path: relPath,
            title: indexEntry.title,
            kind: indexEntry.type === 'asset' ? 'asset' : 'note',
          });
        } else {
          results.push({ id: '', path: relPath, title: item.name, kind: 'unsupported' });
        }
        hasChildren = true;
      }
    }
    return hasChildren;
  }

  await scan(`${campaignPath}/notes/${folder}`, '');
  return results;
}
