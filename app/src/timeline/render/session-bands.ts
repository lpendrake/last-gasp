import type { EventListItem, Session } from '../../data/types.ts';
import { parseISOString, toAbsoluteSeconds } from '../../calendar/golarian.ts';
import { formatCompact } from '../../calendar/format.ts';
import { type ViewState, type ViewportSize, secondsToX } from '../interactions/zoom.ts';

// ---- Legacy band computation (from event tags) — kept for tests ----

export interface SessionBand {
  sessionId: string;
  startSeconds: number;
  endSeconds: number;
  eventCount: number;
  color?: string;
}

export interface SessionConflict {
  sessionId: string;
  conflictsWith: string;
  conflictingEvents: Array<{ filename: string; title: string; date: string }>;
}

export function computeSessionBands(events: EventListItem[]): SessionBand[] {
  const byId = new Map<string, { min: number; max: number; count: number }>();

  for (const ev of events) {
    const tags = ev.tags ?? [];
    const seconds = toAbsoluteSeconds(parseISOString(ev.date));
    for (const tag of tags) {
      if (!tag.startsWith('session:')) continue;
      const id = tag.slice('session:'.length);
      const existing = byId.get(id);
      if (!existing) {
        byId.set(id, { min: seconds, max: seconds, count: 1 });
      } else {
        if (seconds < existing.min) existing.min = seconds;
        if (seconds > existing.max) existing.max = seconds;
        existing.count++;
      }
    }
  }

  return Array.from(byId.entries())
    .map(([sessionId, v]) => ({
      sessionId,
      startSeconds: v.min,
      endSeconds: v.max,
      eventCount: v.count,
    }))
    .sort((a, b) => a.startSeconds - b.startSeconds);
}

// ---- New: compute bands from explicit Session records ----

export function computeSessionBandsFromSessions(
  sessions: Session[],
  events: EventListItem[],
): SessionBand[] {
  return sessions
    .filter(s => s.inGameStart)
    .map(s => {
      const startSeconds = toAbsoluteSeconds(parseISOString(s.inGameStart));
      const endSeconds = s.inGameEnd
        ? toAbsoluteSeconds(parseISOString(s.inGameEnd))
        : startSeconds;
      const eventCount = events.filter(ev => {
        const secs = toAbsoluteSeconds(parseISOString(ev.date));
        return secs >= startSeconds && secs <= endSeconds;
      }).length;
      return {
        sessionId: s.id,
        startSeconds,
        endSeconds,
        eventCount,
        color: s.color,
      };
    })
    .sort((a, b) => a.startSeconds - b.startSeconds);
}

/**
 * Two sessions overlap when their in-game spans strictly interleave.
 * Sharing an exact endpoint (continuation) is NOT an overlap.
 */
export function findSessionConflicts(
  bands: SessionBand[],
  events: EventListItem[],
): SessionConflict[] {
  const conflicts: SessionConflict[] = [];

  for (let i = 0; i < bands.length; i++) {
    for (let j = i + 1; j < bands.length; j++) {
      const a = bands[i];
      const b = bands[j];
      const overlaps = a.startSeconds < b.endSeconds && b.startSeconds < a.endSeconds
        && !(a.endSeconds === b.startSeconds || b.endSeconds === a.startSeconds);
      if (!overlaps) continue;

      const aConflicts = events.filter(ev =>
        (ev.tags ?? []).some(t => t === `session:${a.sessionId}`) &&
        (() => {
          const s = toAbsoluteSeconds(parseISOString(ev.date));
          return s >= b.startSeconds && s <= b.endSeconds;
        })()
      );
      const bConflicts = events.filter(ev =>
        (ev.tags ?? []).some(t => t === `session:${b.sessionId}`) &&
        (() => {
          const s = toAbsoluteSeconds(parseISOString(ev.date));
          return s >= a.startSeconds && s <= a.endSeconds;
        })()
      );

      if (aConflicts.length) {
        conflicts.push({
          sessionId: a.sessionId,
          conflictsWith: b.sessionId,
          conflictingEvents: aConflicts.map(ev => ({
            filename: ev.filename,
            title: ev.title,
            date: formatCompact(parseISOString(ev.date)),
          })),
        });
      }
      if (bConflicts.length) {
        conflicts.push({
          sessionId: b.sessionId,
          conflictsWith: a.sessionId,
          conflictingEvents: bConflicts.map(ev => ({
            filename: ev.filename,
            title: ev.title,
            date: formatCompact(parseISOString(ev.date)),
          })),
        });
      }
    }
  }

  return conflicts;
}

// ---- Rail rendering ----

const RAIL_H = 24;           // pill height
const RAIL_OFFSET = 10;      // px below the axis line
const MIN_PILL_W = 12;       // minimum rendered pill width (px)
const LABEL_MIN_W = 60;      // show label only if pill is wider than this

function formatRailLabel(isoStart: string): string {
  try {
    const d = parseISOString(isoStart);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[(d.month - 1) % 12]} ${d.day}`;
  } catch {
    return '';
  }
}

export function renderSessionRail(
  container: HTMLElement,
  bands: SessionBand[],
  sessions: Session[],
  view: ViewState,
  size: ViewportSize,
  sessionMode: boolean,
): void {
  container.innerHTML = '';

  if (bands.length === 0) return;

  const axisY = Math.floor(size.height * 0.8);
  const railTop = axisY + RAIL_OFFSET;

  // Build a color map from sessionId → color
  const colorMap = new Map<string, string>(sessions.map(s => [s.id, s.color]));

  const sorted = [...bands].sort((a, b) => a.startSeconds - b.startSeconds);

  for (let i = 0; i < sorted.length; i++) {
    const band = sorted[i];
    const color = colorMap.get(band.sessionId) ?? '#6b7c5a';

    const startX = secondsToX(band.startSeconds, view, size);
    const rawEndX = secondsToX(band.endSeconds, view, size);
    // Instant sessions get a minimum pill width
    const endX = band.endSeconds === band.startSeconds
      ? startX + MIN_PILL_W
      : Math.max(rawEndX, startX + MIN_PILL_W);

    if (endX < 0 || startX > size.width) continue;

    const clampedLeft = Math.max(startX, -4);
    const clampedRight = Math.min(endX, size.width + 4);
    const pillW = clampedRight - clampedLeft;
    if (pillW <= 0) continue;

    // Determine if adjacent sessions share an endpoint (touching edges)
    const prevBand = sorted[i - 1];
    const nextBand = sorted[i + 1];
    const leftFlat = prevBand && prevBand.endSeconds === band.startSeconds;
    const rightFlat = nextBand && nextBand.startSeconds === band.endSeconds;

    const pill = document.createElement('div');
    pill.className = 'session-pill' + (leftFlat ? ' left-flat' : '') + (rightFlat ? ' right-flat' : '');
    pill.style.left = `${clampedLeft}px`;
    pill.style.width = `${pillW}px`;
    pill.style.top = `${railTop}px`;
    pill.style.height = `${RAIL_H}px`;
    pill.style.setProperty('--pill-color', color);
    pill.dataset.sessionId = band.sessionId;

    if (pillW > LABEL_MIN_W) {
      const label = document.createElement('span');
      label.className = 'session-pill-label';
      const session = sessions.find(s => s.id === band.sessionId);
      label.textContent = session ? formatRailLabel(session.inGameStart) : band.sessionId;
      pill.appendChild(label);
    }

    if (leftFlat) {
      const seam = document.createElement('div');
      seam.className = 'session-pill-seam';
      pill.appendChild(seam);
    }

    container.appendChild(pill);

    if (sessionMode) {
      // Wash: full-height column from top, fading near axis
      const wash = document.createElement('div');
      wash.className = 'session-wash';
      wash.style.left = `${clampedLeft}px`;
      wash.style.width = `${pillW}px`;
      wash.style.setProperty('--wash-color', color);
      container.appendChild(wash);
    }
  }
}

// Keep old function name as alias so app.ts compiles during the transition
export const renderSessionBands = renderSessionRail;
