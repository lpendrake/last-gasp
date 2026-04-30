/** Persistence ports. Domain functions depend on these interfaces;
 * adapters in `data/fs/*` (or any future backend) implement them. The
 * vocabulary stays domain-shaped — never paths, never streams. */

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
