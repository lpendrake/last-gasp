import { parseISOString, toAbsoluteSeconds, tryParseDate } from '../calendar/golarian';
import type { Session } from '../data/types';

export const SESSION_COLORS: readonly string[] = [
  '#6b7c5a', // sage
  '#7a5c7a', // plum
  '#7a6448', // tobacco
  '#3d7068', // dusty teal
  '#7a4840', // muted brick
];

export const COLOR_STORAGE_KEY = 'last-gasp:session-color-idx';

export interface SessionBuffer {
  id: string;
  inGameStart: string;
  inGameEnd: string;
  realStart: string;
  realEnd: string;
  color: string;
  notes: string;
}

export type SessionEditorMode =
  | { kind: 'create'; prefill?: { inGameStart: string; inGameEnd: string } }
  | { kind: 'edit'; sessionId: string };

export function nextDefaultColor(): string {
  const stored = localStorage.getItem(COLOR_STORAGE_KEY);
  const last = stored !== null ? parseInt(stored, 10) : -1;
  return SESSION_COLORS[(last + 1) % SESSION_COLORS.length];
}

export function recordColorUsed(color: string): void {
  const idx = SESSION_COLORS.indexOf(color);
  if (idx >= 0) localStorage.setItem(COLOR_STORAGE_KEY, String(idx));
}

export function randomSessionId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 4; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

export function toDatetimeLocal(isoRealWorld: string): string {
  return isoRealWorld.slice(0, 16);
}

export function fromDatetimeLocal(val: string): string {
  return val.length === 16 ? val + ':00' : val;
}

export function validateSessionBuffer(
  buf: SessionBuffer,
  existingSessions: Session[],
  isNew: boolean,
): string | null {
  if (!buf.inGameStart || !tryParseDate(buf.inGameStart)) {
    return 'Invalid in-game start date.';
  }
  if (!buf.inGameEnd || !tryParseDate(buf.inGameEnd)) {
    return 'Invalid in-game end date.';
  }
  const realDay = buf.realStart.slice(0, 10);
  const editingId = isNew ? null : buf.id;
  const sameDaySessions = existingSessions.filter(
    (s) => s.id !== editingId && s.realStart.slice(0, 10) === realDay,
  );
  if (sameDaySessions.length > 0) {
    try {
      const newStart = toAbsoluteSeconds(parseISOString(buf.inGameStart));
      const newEnd = toAbsoluteSeconds(parseISOString(buf.inGameEnd));
      for (const s of sameDaySessions) {
        const existStart = toAbsoluteSeconds(parseISOString(s.inGameStart));
        const existEnd = toAbsoluteSeconds(parseISOString(s.inGameEnd));
        if (existStart === existEnd) continue;
        const overlaps = newStart < existEnd && existStart < newEnd;
        if (overlaps) {
          return 'In-game time overlaps another session on the same real-world day.';
        }
      }
    } catch {
      /* parse errors caught above */
    }
  }
  return null;
}

export function bufferFromSession(s: Session): SessionBuffer {
  return {
    id: s.id,
    inGameStart: s.inGameStart,
    inGameEnd: s.inGameEnd,
    realStart: s.realStart,
    realEnd: s.realEnd,
    color: s.color,
    notes: s.notes ?? '',
  };
}

export function emptyBuffer(prefill?: { inGameStart: string; inGameEnd: string }): SessionBuffer {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: '',
    inGameStart: prefill?.inGameStart ?? '',
    inGameEnd: prefill?.inGameEnd ?? '',
    realStart: `${today}T12:00:00`,
    realEnd: `${today}T16:00:00`,
    color: nextDefaultColor(),
    notes: '',
  };
}

export function buildSavedSession(
  buf: SessionBuffer,
  existingSessions: Session[],
  isNew: boolean,
): Session {
  let id = buf.id;
  if (isNew) {
    do {
      id = randomSessionId();
    } while (existingSessions.some((s) => s.id === id));
  }
  return {
    id,
    inGameStart: buf.inGameStart,
    inGameEnd: buf.inGameEnd,
    realStart: buf.realStart,
    realEnd: buf.realEnd,
    color: buf.color,
    notes: buf.notes,
    real_date: buf.realStart.slice(0, 10),
    in_game_start: buf.inGameStart,
  };
}
