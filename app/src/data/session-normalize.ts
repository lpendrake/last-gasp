import type { Session } from './types.ts';

export const SESSION_COLORS = [
  '#6b7c5a',  // sage
  '#7a5c7a',  // plum
  '#7a6448',  // tobacco
  '#3d7068',  // dusty teal
  '#7a4840',  // muted brick
];

export function normalizeSession(raw: Record<string, unknown>, index: number): Session {
  const id = (raw.id ?? raw.real_date ?? '') as string;
  const inGameStart = (raw.inGameStart ?? raw.in_game_start ?? '') as string;
  const inGameEnd = (raw.inGameEnd ?? inGameStart) as string;

  // Real-world times: legacy data only has a date string, default to 7pm–11pm
  const legacyDate = (raw.real_date ?? id) as string;
  const realStart = (raw.realStart ?? `${legacyDate.slice(0, 10)}T19:00:00`) as string;
  const realEnd = (raw.realEnd ?? deriveRealEnd(realStart)) as string;

  const color = (raw.color ?? SESSION_COLORS[index % SESSION_COLORS.length]) as string;
  const notes = (raw.notes ?? '') as string;

  return { id, inGameStart, inGameEnd, realStart, realEnd, color, notes, real_date: legacyDate, in_game_start: inGameStart };
}

function deriveRealEnd(realStart: string): string {
  try {
    const d = new Date(realStart);
    d.setHours(d.getHours() + 4);
    return d.toISOString().slice(0, 19);
  } catch {
    return realStart;
  }
}

export function normalizeSessions(raws: unknown[]): Session[] {
  return raws.map((r, i) => normalizeSession(r as Record<string, unknown>, i));
}
