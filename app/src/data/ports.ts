/** Client-side persistence ports. The view slices depend on these
 * interfaces; today they are satisfied by HTTP adapters in
 * src/data/http/*. A different backend (e.g. an in-process store
 * for offline mode) could implement the same shapes without the
 * view code knowing.
 *
 * Adapters today are exposed as flat module-level functions for
 * convenience; the function signatures here document the contract
 * a future port-object adapter would expose. */

import type {
  Event, EventListItem, EventFrontmatter, State, TagsRegistry,
  Session, Palette, LinkIndexEntry, NoteEntry,
} from './types.ts';

export interface EventWithMtime extends Event {
  /** Last-Modified header value, used for If-Unmodified-Since on PUT/DELETE. */
  lastModified: string;
}

export interface EventStore {
  list(): Promise<EventListItem[]>;
  get(filename: string): Promise<EventWithMtime>;
  create(filename: string, frontmatter: EventFrontmatter, body: string): Promise<EventWithMtime>;
  update(filename: string, frontmatter: EventFrontmatter, body: string, ifUnmodifiedSince: string): Promise<EventWithMtime>;
  remove(filename: string, ifUnmodifiedSince: string): Promise<void>;
}

export interface StateStore {
  getState(): Promise<State>;
  putState(s: State): Promise<{ ok: true }>;
  getTags(): Promise<TagsRegistry>;
  putTags(t: TagsRegistry): Promise<{ ok: true }>;
  getPalette(): Promise<Palette>;
  putPalette(p: Palette): Promise<{ ok: true }>;
  getSessions(): Promise<Session[]>;
  appendSession(s: Session): Promise<Session[]>;
}

export interface LinkStore {
  getIndex(): Promise<LinkIndexEntry[]>;
  /** Read any md or image by repo-relative path (used by hover-peek). */
  getFile(relPath: string, signal?: AbortSignal): Promise<string>;
}

export interface NoteStore {
  listFolders(): Promise<{ name: string }[]>;
  createFolder(name: string): Promise<void>;
  deleteFolder(folder: string): Promise<void>;
  renameFolder(folder: string, newName: string): Promise<void>;

  list(folder: string): Promise<NoteEntry[]>;
  get(folder: string, path: string): Promise<{ content: string; mtime: string }>;
  create(folder: string, path: string, content: string): Promise<string>;
  put(folder: string, path: string, content: string, ifUnmodifiedSince?: string): Promise<string>;
  remove(folder: string, path: string): Promise<void>;
  rename(folder: string, path: string, newPath: string, newFolder?: string): Promise<void>;

  uploadAsset(folder: string, filename: string, data: ArrayBuffer, mimeType: string): Promise<string>;
}
