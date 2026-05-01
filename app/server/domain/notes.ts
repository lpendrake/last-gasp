import type { NoteStore } from '../data/ports.ts';
import { validNoteFolder, IMAGE_MIME, ASSET_EXTS } from '../data/fs/paths.ts';
import { ConflictError, NotFoundError, ValidationError } from './errors.ts';
import { mtimeMatch } from './events.ts';
import { updateNotesLinks } from './links.ts';
import type { NoteEntry } from '../../src/data/types.ts';

/** Whether a path looks like an image asset by extension. */
export function isImagePath(notePath: string): boolean {
  const ext = notePath.split('.').pop()?.toLowerCase() ?? '';
  return !!IMAGE_MIME[ext];
}

/** Mime type for an image path; throws ValidationError if unsupported. */
export function imageMimeFor(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const mime = IMAGE_MIME[ext];
  if (!mime) throw new ValidationError('Unsupported image type');
  return mime;
}

export function trashNameForFolder(folder: string, now: Date): string {
  const ts = now.toISOString().replace(/[:.]/g, '-');
  return `${ts}-folder-${folder}`;
}

export function trashNameForFile(folder: string, notePath: string, now: Date): string {
  const ts = now.toISOString().replace(/[:.]/g, '-');
  return `${ts}-${folder}-${notePath.replace(/\//g, '_')}`;
}

// ---- Folder operations ----

export async function listNoteFolders(store: NoteStore) {
  return store.listFolders();
}

export async function createNoteFolder(store: NoteStore, folder: string): Promise<void> {
  if (!validNoteFolder(folder)) throw new ValidationError('Invalid folder name');
  await store.createFolder(folder);
}

export interface FolderRenameResult { ok: true; updatedLinks: number }

export async function renameNoteFolder(
  store: NoteStore, folder: string, newName: string,
): Promise<FolderRenameResult> {
  if (!validNoteFolder(folder)) throw new ValidationError('Invalid folder name');
  if (!validNoteFolder(newName)) throw new ValidationError('Invalid new name');
  if (!(await store.isFolder(folder))) throw new NotFoundError('Folder not found');
  if (newName === folder) return { ok: true, updatedLinks: 0 };
  if (await store.isFolder(newName) || await store.fileExists(newName, '')) {
    throw new ConflictError('Destination already exists');
  }
  await store.renameFolder(folder, newName);
  const updatedLinks = await updateNotesLinks(store, folder, '', newName, '', true);
  return { ok: true, updatedLinks };
}

export async function deleteNoteFolder(
  store: NoteStore, folder: string, now: Date = new Date(),
): Promise<void> {
  if (!validNoteFolder(folder)) throw new ValidationError('Invalid folder name');
  if (!(await store.isFolder(folder))) throw new NotFoundError('Folder not found');
  await store.softDeleteFolder(folder, trashNameForFolder(folder, now));
}

// ---- File operations ----

export async function listNoteFiles(store: NoteStore, folder: string): Promise<NoteEntry[]> {
  if (!validNoteFolder(folder)) throw new ValidationError('Invalid folder');
  return store.scanFolder(folder);
}

export async function getNoteFile(store: NoteStore, folder: string, notePath: string) {
  if (!validNoteFolder(folder)) throw new ValidationError('Invalid folder');
  const isMd = notePath.endsWith('.md');
  if (!isMd && !isImagePath(notePath)) throw new ValidationError('Unsupported file type');
  const file = await store.readFile(folder, notePath);
  if (!file) throw new NotFoundError('Note not found');
  return { ...file, isMarkdown: isMd };
}

export async function createNoteFile(
  store: NoteStore, folder: string, notePath: string, content: string,
): Promise<{ mtime: Date }> {
  if (!validNoteFolder(folder)) throw new ValidationError('Invalid folder');
  if (!notePath.endsWith('.md')) throw new ValidationError('Not a markdown file');
  if (await store.fileExists(folder, notePath)) throw new ConflictError('Note already exists');
  return store.writeFile(folder, notePath, content);
}

export async function updateNoteFile(
  store: NoteStore, folder: string, notePath: string, content: string,
  ifUnmodifiedSince: string | undefined,
): Promise<{ mtime: Date }> {
  if (!validNoteFolder(folder)) throw new ValidationError('Invalid folder');
  if (!notePath.endsWith('.md')) throw new ValidationError('Not a markdown file');
  const stat = await store.statFile(folder, notePath);
  if (stat && ifUnmodifiedSince && !mtimeMatch(ifUnmodifiedSince, stat.mtime)) {
    throw new ConflictError('File modified since last read');
  }
  return store.writeFile(folder, notePath, content);
}

export interface FileRenameResult { ok: true; updatedLinks: number }

export async function renameNoteFile(
  store: NoteStore,
  folder: string, notePath: string,
  newFolder: string, newPath: string,
): Promise<FileRenameResult> {
  if (!validNoteFolder(folder)) throw new ValidationError('Invalid folder name');
  if (!validNoteFolder(newFolder)) throw new ValidationError('Invalid destination folder');
  const sourceStat = await store.statFile(folder, notePath);
  if (!sourceStat) throw new NotFoundError('Not found');
  if (folder === newFolder && notePath === newPath) return { ok: true, updatedLinks: 0 };
  if (await store.fileExists(newFolder, newPath)) throw new ConflictError('Destination already exists');
  await store.rename(folder, notePath, newFolder, newPath);
  const updatedLinks = await updateNotesLinks(
    store, folder, notePath, newFolder, newPath, sourceStat.isDirectory,
  );
  return { ok: true, updatedLinks };
}

export async function deleteNoteFile(
  store: NoteStore, folder: string, notePath: string, now: Date = new Date(),
): Promise<void> {
  if (!(await store.fileExists(folder, notePath))) throw new NotFoundError('Note not found');
  await store.softDeleteFile(folder, notePath, trashNameForFile(folder, notePath, now));
}

// ---- Asset upload ----

export async function uploadNoteAsset(
  store: NoteStore, folder: string, filename: string, data: Buffer,
): Promise<{ path: string }> {
  if (!validNoteFolder(folder)) throw new ValidationError('Invalid folder name');
  if (filename.includes('/') || filename.includes('\\') || filename.startsWith('.')) {
    throw new ValidationError('Invalid filename');
  }
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (!ASSET_EXTS.has(ext) || !IMAGE_MIME[ext]) throw new ValidationError('Unsupported image type');
  await store.writeAsset(folder, filename, data);
  return { path: `assets/${filename}` };
}

