import type { Session } from '../data/types';

/** Replace the session with the same id; leaves the array unchanged if not found. */
export function applySessionUpdate(sessions: Session[], updated: Session): Session[] {
  return sessions.map((s) => (s.id === updated.id ? updated : s));
}

/** Upsert: replace if id already exists, otherwise append. */
export function applySessionSave(sessions: Session[], saved: Session): Session[] {
  const exists = sessions.some((s) => s.id === saved.id);
  return exists ? sessions.map((s) => (s.id === saved.id ? saved : s)) : [...sessions, saved];
}

/** Remove the session with the given id. */
export function applySessionDelete(sessions: Session[], sessionId: string): Session[] {
  return sessions.filter((s) => s.id !== sessionId);
}
