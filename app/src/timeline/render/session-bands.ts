import type { EventListItem } from '../../data/types.ts';
import { parseISOString, toAbsoluteSeconds } from '../../calendar/golarian.ts';
import { formatCompact } from '../../calendar/format.ts';
import { type ViewState, type ViewportSize, secondsToX } from '../interactions/zoom.ts';
import { themeColor } from '../../theme.ts';

export interface SessionBand {
  sessionId: string;
  startSeconds: number;
  endSeconds: number;
  eventCount: number;
}

export interface SessionConflict {
  sessionId: string;
  conflictsWith: string;       // the other session
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
      // Strict overlap: one span starts INSIDE the other
      const overlaps = a.startSeconds < b.endSeconds && b.startSeconds < a.endSeconds
        && !(a.endSeconds === b.startSeconds || b.endSeconds === a.startSeconds);
      if (!overlaps) continue;

      // Events in session A whose dates fall inside session B's span
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

const STRIP_H = 14;
const STRIP_GAP = 2;
const SECONDS_PER_DAY = 86400;
const MIN_WIDTH_SECONDS = SECONDS_PER_DAY;

export function renderSessionBands(
  container: HTMLElement,
  bands: SessionBand[],
  view: ViewState,
  size: ViewportSize,
  overlappingIds?: Set<string>,
): void {
  container.innerHTML = '';

  const axisY = Math.floor(size.height * 0.8);

  // Sort by start time for greedy row packing
  const sorted = [...bands].sort((a, b) => a.startSeconds - b.startSeconds);

  // Greedy row packing: strips that don't overlap in x can share a row
  const rows: { left: number; right: number }[][] = [];
  const rowOf = new Map<string, number>();

  for (const band of sorted) {
    const leftX = secondsToX(band.startSeconds, view, size);
    const rightX = secondsToX(band.endSeconds + MIN_WIDTH_SECONDS, view, size);
    let row = 0;
    while (true) {
      if (!rows[row]) rows[row] = [];
      const clash = rows[row].some(r => !(rightX + 2 <= r.left || leftX - 2 >= r.right));
      if (!clash) { rows[row].push({ left: leftX, right: rightX }); break; }
      row++;
    }
    rowOf.set(band.sessionId, row);
  }

  for (let i = 0; i < bands.length; i++) {
    const band = bands[i];
    const start = band.startSeconds;
    const end = Math.max(band.endSeconds, start + MIN_WIDTH_SECONDS);
    const leftX = secondsToX(start, view, size);
    const rightX = secondsToX(end + SECONDS_PER_DAY, view, size);

    if (rightX < 0 || leftX > size.width) continue;

    const clampedLeft = Math.max(leftX, -20);
    const clampedRight = Math.min(rightX, size.width + 20);
    const row = rowOf.get(band.sessionId) ?? 0;
    const stripTop = axisY - STRIP_H - (row * (STRIP_H + STRIP_GAP));
    const isOverlap = overlappingIds?.has(band.sessionId) ?? false;

    // Subtle full-height background tint
    const bg = document.createElement('div');
    bg.className = 'session-band-bg' + (i % 2 === 0 ? '' : ' is-alt') + (isOverlap ? ' is-overlap' : '');
    bg.style.left = `${clampedLeft}px`;
    bg.style.width = `${clampedRight - clampedLeft}px`;
    bg.style.setProperty('--band-color',
      i % 2 === 0
        ? themeColor('session_band_a' as any)
        : themeColor('session_band_b' as any)
    );
    container.appendChild(bg);

    // Labeled strip just above the axis
    const strip = document.createElement('div');
    strip.className = 'session-strip' + (isOverlap ? ' is-overlap' : '');
    strip.style.left = `${clampedLeft}px`;
    strip.style.width = `${clampedRight - clampedLeft}px`;
    strip.style.top = `${stripTop}px`;
    strip.style.background = i % 2 === 0
      ? themeColor('session_band_a' as any)
      : themeColor('session_band_b' as any);
    strip.dataset.sessionId = band.sessionId;

    const label = document.createElement('span');
    label.className = 'session-strip-label';
    label.textContent = (isOverlap ? '⚠ ' : '') + band.sessionId;
    strip.appendChild(label);

    container.appendChild(strip);
  }
}
