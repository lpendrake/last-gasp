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
