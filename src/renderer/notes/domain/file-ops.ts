import type { NoteEntry, FileState } from '../types';
import { slugify } from './slugify';

export function removeFileFromFolderFiles(
  folderFiles: Record<string, NoteEntry[] | null>,
  folder: string,
  path: string,
): Record<string, NoteEntry[] | null> {
  if (!(folder in folderFiles)) return folderFiles;
  const entries = folderFiles[folder] ?? [];
  return { ...folderFiles, [folder]: entries.filter((e) => e.path !== path) };
}

export function removeFolderFromFolderFiles(
  folderFiles: Record<string, NoteEntry[] | null>,
  folder: string,
): Record<string, NoteEntry[] | null> {
  const { [folder]: _, ...rest } = folderFiles;
  return rest;
}

export function renameFileInFolderFiles(
  folderFiles: Record<string, NoteEntry[] | null>,
  folder: string,
  oldPath: string,
  newPath: string,
  newTitle: string,
): Record<string, NoteEntry[] | null> {
  const entries = folderFiles[folder] ?? [];
  return {
    ...folderFiles,
    [folder]: entries.map((e) =>
      e.path === oldPath ? { ...e, path: newPath, title: newTitle } : e,
    ),
  };
}

export function renameFileInOpenFiles(
  openFiles: Record<string, FileState>,
  folder: string,
  oldPath: string,
  newPath: string,
): Record<string, FileState> {
  const oldKey = `${folder}/${oldPath}`;
  const newKey = `${folder}/${newPath}`;
  if (!(oldKey in openFiles)) return openFiles;
  const { [oldKey]: data, ...rest } = openFiles;
  return { ...rest, [newKey]: data };
}

export function renameFolderInFolderFiles(
  folderFiles: Record<string, NoteEntry[] | null>,
  oldFolder: string,
  newFolder: string,
): Record<string, NoteEntry[] | null> {
  const { [oldFolder]: data, ...rest } = folderFiles;
  return { ...rest, [newFolder]: data };
}

export function renameFolderInOpenFiles(
  openFiles: Record<string, FileState>,
  oldFolder: string,
  newFolder: string,
): Record<string, FileState> {
  const next: Record<string, FileState> = {};
  const prefix = `${oldFolder}/`;
  for (const [key, val] of Object.entries(openFiles)) {
    if (key.startsWith(prefix)) {
      next[`${newFolder}/${key.slice(prefix.length)}`] = val;
    } else {
      next[key] = val;
    }
  }
  return next;
}

/** Computes the new path after a rename. Returns null if the name is empty or produces no change. */
export function computeRenamedPath(oldPath: string, newName: string): string | null {
  const trimmed = newName.trim();
  if (!trimmed) return null;
  const isDir = !(oldPath.split('/').pop() ?? oldPath).includes('.');
  const slug = slugify(trimmed);
  const newBaseName = isDir ? slug : slug.endsWith('.md') ? slug : `${slug}.md`;
  const parts = oldPath.split('/');
  parts[parts.length - 1] = newBaseName;
  const newPath = parts.join('/');
  return newPath === oldPath ? null : newPath;
}
