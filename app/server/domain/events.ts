import type { EventStore } from '../data/ports.ts';
import type { Event, EventListItem, EventFrontmatter } from '../../src/data/types.ts';
import { ConflictError, NotFoundError, ValidationError } from './errors.ts';
import { eventFromParsed, eventListItemFromParsed, serialiseEvent } from './yaml.ts';

/** A valid event filename ends in `.md` and contains no path separators. */
export function isValidEventFilename(name: string): boolean {
  return name.endsWith('.md') && !name.includes('/') && !name.includes('\\');
}

/** Compare two HTTP dates at second resolution (HTTP precision). */
export function mtimeMatch(headerValue: string, mtime: Date): boolean {
  const clientMs = new Date(headerValue).getTime();
  const serverMs = mtime.getTime();
  return Math.floor(clientMs / 1000) === Math.floor(serverMs / 1000);
}

/** Construct the trash filename for a soft-deleted event. */
export function trashName(filename: string, now: Date): string {
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  return `${timestamp}-${filename}`;
}

export async function listEvents(store: EventStore): Promise<EventListItem[]> {
  const records = await store.list();
  return records.map(({ filename, content, mtime }) =>
    eventListItemFromParsed(filename, content, mtime),
  );
}

export async function getEvent(
  store: EventStore, filename: string,
): Promise<{ event: Event; mtime: Date }> {
  if (!isValidEventFilename(filename)) throw new ValidationError('Invalid filename');
  const r = await store.get(filename);
  if (!r) throw new NotFoundError('Event not found');
  return { event: eventFromParsed(filename, r.content, r.mtime), mtime: r.mtime };
}

export async function createEvent(
  store: EventStore, filename: string, fm: EventFrontmatter, body: string,
): Promise<{ event: Event; mtime: Date }> {
  if (!isValidEventFilename(filename)) throw new ValidationError('Invalid filename');
  if (await store.exists(filename)) throw new ConflictError('Event already exists');
  const content = serialiseEvent(fm, body);
  const { mtime } = await store.put(filename, content);
  return { event: eventFromParsed(filename, content, mtime), mtime };
}

export async function updateEvent(
  store: EventStore,
  filename: string,
  fm: EventFrontmatter,
  body: string,
  ifUnmodifiedSince: string | undefined,
): Promise<{ event: Event; mtime: Date }> {
  if (!isValidEventFilename(filename)) throw new ValidationError('Invalid filename');
  const stat = await store.stat(filename);
  if (!stat) throw new NotFoundError('Event not found');
  if (ifUnmodifiedSince && !mtimeMatch(ifUnmodifiedSince, stat.mtime)) {
    throw new ConflictError('File modified since last read');
  }
  const content = serialiseEvent(fm, body);
  const { mtime } = await store.put(filename, content);
  return { event: eventFromParsed(filename, content, mtime), mtime };
}

export async function deleteEvent(
  store: EventStore,
  filename: string,
  ifUnmodifiedSince: string | undefined,
  now: Date = new Date(),
): Promise<{ trashedAs: string }> {
  if (!isValidEventFilename(filename)) throw new ValidationError('Invalid filename');
  const stat = await store.stat(filename);
  if (!stat) throw new NotFoundError('Event not found');
  if (ifUnmodifiedSince && !mtimeMatch(ifUnmodifiedSince, stat.mtime)) {
    throw new ConflictError('File modified since last read');
  }
  const trashedAs = trashName(filename, now);
  await store.softDelete(filename, trashedAs);
  return { trashedAs };
}
