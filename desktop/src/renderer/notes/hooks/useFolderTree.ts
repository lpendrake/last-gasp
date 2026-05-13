import { useMemo } from 'react';
import { buildTree, type NoteEntry, type TreeNode } from '../types.ts';

/** Memoised tree of NoteEntry → TreeNode for each loaded folder.
 * Folders that haven't been opened yet (entries === null/undefined)
 * map to an empty array. */
export function useFolderTree(
  folders: string[],
  folderFiles: Record<string, NoteEntry[] | null>,
): Record<string, TreeNode[]> {
  return useMemo(() => {
    const out: Record<string, TreeNode[]> = {};
    for (const f of folders) {
      const entries = folderFiles[f];
      out[f] = entries ? buildTree(entries) : [];
    }
    return out;
  }, [folders, folderFiles]);
}
