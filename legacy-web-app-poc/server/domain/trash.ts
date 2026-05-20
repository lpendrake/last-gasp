import type { EventStore, EventTrashStore } from '../data/ports.ts';
import { ConflictError, NotFoundError } from './errors.ts';

/** Strip the timestamp prefix added by `events.softDelete` to recover
 * the event's original filename. Falls back to the trash name itself
 * if the prefix is missing. */
export function originalNameFromTrashName(trashName: string): string {
  const m = trashName.match(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d+Z?-(.+)$/);
  return m ? m[1] : trashName;
}

export interface ListedTrashEntry {
  filename: string;
  trashedAt: string;       // HTTP-format string
  size: number;
}

export async function listTrash(trash: EventTrashStore): Promise<ListedTrashEntry[]> {
  const entries = await trash.list();
  return entries.map(({ filename, trashedAt, size }) =>
    ({ filename, trashedAt: trashedAt.toUTCString(), size }));
}

export async function restoreTrash(
  trash: EventTrashStore, events: EventStore, filename: string,
): Promise<{ restored: string }> {
  if (!(await trash.exists(filename))) throw new NotFoundError('Trash entry not found');
  const original = originalNameFromTrashName(filename);
  if (await events.exists(original)) {
    throw new ConflictError(`An event already exists at ${original}`);
  }
  await trash.restore(filename, original);
  return { restored: original };
}

export async function deleteTrashEntry(trash: EventTrashStore, filename: string): Promise<void> {
  if (!(await trash.exists(filename))) throw new NotFoundError('Trash entry not found');
  await trash.remove(filename);
}

export async function emptyTrash(trash: EventTrashStore): Promise<void> {
  await trash.empty();
}
