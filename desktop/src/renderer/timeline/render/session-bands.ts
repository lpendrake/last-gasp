import type { EventListItem, Session } from '../data/types';
import type { ViewState, ViewportSize } from '../math/zoom';
import { secondsToX } from '../math/zoom';
import { parseISOString, toAbsoluteSeconds } from '../calendar/golarian';
import { formatCompactWithTime } from '../calendar/format';

export interface SessionBand {
  sessionId: string;
  startSeconds: number;
  endSeconds: number;
  eventCount: number;
  color?: string;
}

export interface SessionPillLayout {
  sessionId: string;
  left: number;
  top: number;
  width: number;
  height: number;
  color: string;
  label: string | null;
  leftFlat: boolean;
  rightFlat: boolean;
}

export interface TooltipPosition {
  left: number;
  bottom: number;
}

export const RAIL_H = 24;
export const RAIL_OFFSET = 34;
export const TOOLTIP_MAX_W = 360;
const MIN_PILL_W = 12;
const LABEL_MIN_W = 60;
const DEFAULT_COLOR = '#6b7c5a';

// Short real-world month names — used for session labels derived from realStart.
export const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function computeSessionBandsFromSessions(
  sessions: Session[],
  events: EventListItem[],
): SessionBand[] {
  return sessions
    .filter((s) => !!s.inGameStart)
    .map((s) => {
      const startSeconds = toAbsoluteSeconds(parseISOString(s.inGameStart));
      const endSeconds = s.inGameEnd
        ? toAbsoluteSeconds(parseISOString(s.inGameEnd))
        : startSeconds;
      const eventCount = events.filter((ev) => {
        const secs = toAbsoluteSeconds(parseISOString(ev.date));
        return secs >= startSeconds && secs <= endSeconds;
      }).length;
      return { sessionId: s.id, startSeconds, endSeconds, eventCount, color: s.color };
    })
    .sort((a, b) => a.startSeconds - b.startSeconds);
}

export function computeSessionLabel(session: Session, allSessions: Session[]): string {
  const day = session.realStart.slice(0, 10);
  const parts = day.split('-');
  const month = MONTHS_SHORT[parseInt(parts[1], 10) - 1] ?? parts[1];
  const dayNum = parseInt(parts[2], 10);
  const base = `${month} ${dayNum}`;

  const sameDaySessions = allSessions
    .filter((s) => s.realStart.slice(0, 10) === day)
    .sort((a, b) =>
      a.inGameStart < b.inGameStart ? -1 : a.inGameStart > b.inGameStart ? 1 : a.id < b.id ? -1 : 1,
    );

  if (sameDaySessions.length <= 1) return base;
  const idx = sameDaySessions.findIndex((s) => s.id === session.id);
  return idx <= 0 ? base : `${base} (${idx + 1})`;
}

export function formatRealRange(realStart: string, realEnd: string): string {
  const s = new Date(realStart);
  const e = new Date(realEnd);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return `${realStart} – ${realEnd}`;
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const prefix = `${days[s.getDay()]} ${MONTHS_SHORT[s.getMonth()]} ${s.getDate()} ${s.getFullYear()}`;
  const fmt = (d: Date) => {
    const h12 = d.getHours() % 12 || 12;
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${h12}:${mm}${d.getHours() >= 12 ? 'pm' : 'am'}`;
  };
  return `${prefix} · ${fmt(s)} – ${fmt(e)}`;
}

export function formatGameRange(inGameStart: string, inGameEnd: string): string {
  try {
    const s = formatCompactWithTime(parseISOString(inGameStart));
    if (inGameStart === inGameEnd) return `${s} (instant)`;
    const e = formatCompactWithTime(parseISOString(inGameEnd));
    return `${s} – ${e}`;
  } catch {
    return inGameStart;
  }
}

/** Computes tooltip (left, bottom) from a pill's bounding rect + viewport dims. Pure. */
export function computeTooltipPosition(
  pillRect: { left: number; top: number },
  viewportWidth: number,
  viewportHeight: number,
): TooltipPosition {
  let left = pillRect.left;
  if (left + TOOLTIP_MAX_W > viewportWidth - 8) left = viewportWidth - TOOLTIP_MAX_W - 8;
  if (left < 8) left = 8;
  return { left, bottom: viewportHeight - pillRect.top + 6 };
}

export function computeSessionPills(
  bands: SessionBand[],
  sessions: Session[],
  view: ViewState,
  size: ViewportSize,
): SessionPillLayout[] {
  if (bands.length === 0 || size.width === 0 || size.height === 0) return [];

  const axisY = Math.floor(size.height * 0.8);
  const railTop = axisY + RAIL_OFFSET;
  const sessionMap = new Map<string, Session>(sessions.map((s) => [s.id, s]));
  const sorted = [...bands].sort((a, b) => a.startSeconds - b.startSeconds);

  const result: SessionPillLayout[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const band = sorted[i];
    const session = sessionMap.get(band.sessionId);
    const color = session?.color ?? DEFAULT_COLOR;

    const startX = secondsToX(band.startSeconds, view, size);
    const rawEndX = secondsToX(band.endSeconds, view, size);
    const endX =
      band.endSeconds === band.startSeconds
        ? startX + MIN_PILL_W
        : Math.max(rawEndX, startX + MIN_PILL_W);

    if (endX < 0 || startX > size.width) continue;

    const clampedLeft = Math.max(startX, -4);
    const clampedRight = Math.min(endX, size.width + 4);
    const pillW = clampedRight - clampedLeft;
    if (pillW <= 0) continue;

    const prevBand = sorted[i - 1];
    const nextBand = sorted[i + 1];
    const leftFlat = !!(prevBand && prevBand.endSeconds === band.startSeconds);
    const rightFlat = !!(nextBand && nextBand.startSeconds === band.endSeconds);

    const label =
      pillW > LABEL_MIN_W
        ? session
          ? computeSessionLabel(session, sessions)
          : band.sessionId
        : null;

    result.push({
      sessionId: band.sessionId,
      left: clampedLeft,
      top: railTop,
      width: pillW,
      height: RAIL_H,
      color,
      label,
      leftFlat,
      rightFlat,
    });
  }

  return result;
}
