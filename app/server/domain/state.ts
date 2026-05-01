import type { StateStore } from '../data/ports.ts';
import { ValidationError } from './errors.ts';

/** Append a new session to sessions.json, creating the array if missing.
 * Returns the full session list after the append. */
export async function appendSession(store: StateStore, newSession: unknown): Promise<unknown[]> {
  const raw = await store.read('sessions');
  let current: unknown[] = [];
  if (raw) {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new ValidationError('sessions.json is not an array');
    }
    current = parsed;
  }
  current.push(newSession);
  await store.write('sessions', JSON.stringify(current, null, 2) + '\n');
  return current;
}
