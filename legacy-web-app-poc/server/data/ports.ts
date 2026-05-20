/** Persistence ports. Domain functions depend on these interfaces;
 * adapters in `data/fs/*` (or any future backend) implement them. The
 * vocabulary stays domain-shaped — never paths, never streams. */

import type { NoteEntry, LinkIndexEntry } from '../../src/data/types.ts';

export interface EventRecord {
  filename: string;
  content: string;
  mtime: Date;
}

export interface EventStat {
  mtime: Date;
}

export interface EventStore {
  /** List all event records (filename + raw content + mtime). */
  list(): Promise<EventRecord[]>;
  /** Read one event. Returns null if not found. */
  get(filename: string): Promise<{ content: string; mtime: Date } | null>;
  /** Stat an event (mtime only). Returns null if not found. */
  stat(filename: string): Promise<EventStat | null>;
  /** Whether the event exists. */
  exists(filename: string): Promise<boolean>;
  /** Create or overwrite the event file. Returns the new mtime. */
  put(filename: string, content: string): Promise<EventStat>;
  /** Move the event into trash under `trashName`. */
  softDelete(filename: string, trashName: string): Promise<void>;
}

export type StateName = 'state' | 'tags' | 'palette' | 'sessions';

export interface StateStore {
  /** Read the named JSON blob. Returns the raw UTF-8 bytes, or null. */
  read(name: StateName): Promise<string | null>;
  /** Write the named JSON blob atomically. */
  write(name: StateName, content: string): Promise<void>;
}

export interface TrashEntry {
  filename: string;
  trashedAt: Date;
  size: number;
}

export interface NoteFileStat {
  mtime: Date;
  isFile: boolean;
  isDirectory: boolean;
}

export interface NoteFile {
  content: Buffer;
  mtime: Date;
}

export interface NoteStore {
  // ---- folders (top-level note directories under repoRoot) ----
  /** List visible top-level note folders, sorted. */
  listFolders(): Promise<{ name: string }[]>;
  /** Whether the folder exists and is a directory. */
  isFolder(folder: string): Promise<boolean>;
  /** Create the folder (mkdir -p). */
  createFolder(folder: string): Promise<void>;
  /** Rename a top-level folder. */
  renameFolder(oldName: string, newName: string): Promise<void>;
  /** Move a folder into the notes-trash with the given trash name. */
  softDeleteFolder(folder: string, trashName: string): Promise<void>;

  // ---- files within a folder ----
  /** Recursively list .md notes and known image assets. */
  scanFolder(folder: string): Promise<NoteEntry[]>;
  /** Whether the file exists. */
  fileExists(folder: string, notePath: string): Promise<boolean>;
  /** Read a note or asset (raw bytes). Null if missing. */
  readFile(folder: string, notePath: string): Promise<NoteFile | null>;
  /** Stat a file without reading it. Null if missing. */
  statFile(folder: string, notePath: string): Promise<NoteFileStat | null>;
  /** Write text content; creates parents. Returns mtime. */
  writeFile(folder: string, notePath: string, content: string): Promise<{ mtime: Date }>;
  /** Move a file or directory across folders/paths. */
  rename(oldFolder: string, oldPath: string, newFolder: string, newPath: string): Promise<void>;
  /** Move a file into the notes-trash with the given trash name. */
  softDeleteFile(folder: string, notePath: string, trashName: string): Promise<void>;
  /** Write binary asset bytes to <folder>/assets/<filename>. */
  writeAsset(folder: string, filename: string, data: Buffer): Promise<void>;

  // ---- cross-folder ----
  /** Read any md or image by repo-relative path (used by hover-peek). */
  readRepoFile(relPath: string): Promise<NoteFile | null>;

  // ---- link index ----
  /** Scan SCAN_DIRS + party.md and return one entry per .md file. */
  scanLinkIndex(): Promise<LinkIndexEntry[]>;

  // ---- link rewriter ----
  /** Repo-relative paths of every .md file under any non-excluded
   * top-level note folder (used by domain/links updateNotesLinks). */
  listAllNoteMarkdown(): Promise<string[]>;
  /** Read a markdown file by repo-relative path. Null if missing. */
  readMarkdown(relPath: string): Promise<string | null>;
  /** Write a markdown file atomically by repo-relative path. */
  writeMarkdown(relPath: string, content: string): Promise<void>;
}

export interface EventTrashStore {
  /** List trashed events with mtime + size metadata. */
  list(): Promise<TrashEntry[]>;
  /** Whether the named trash entry exists. */
  exists(filename: string): Promise<boolean>;
  /** Move a trash entry back to the events directory under `restoreAs`. */
  restore(filename: string, restoreAs: string): Promise<void>;
  /** Permanently delete one trash entry. No-op if missing. */
  remove(filename: string): Promise<void>;
  /** Permanently delete every `.md` entry in trash. */
  empty(): Promise<void>;
}
