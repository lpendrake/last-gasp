import type { EventListItem } from '../data/types.ts';
import { parseISOString, toAbsoluteSeconds } from '../calendar/golarian.ts';
import { type ViewState, type ViewportSize, secondsToX } from './zoom.ts';
import { themeColor } from '../theme.ts';

export interface SessionBand {
  sessionId: string;      // real-world date e.g. "2026-02-08"
  startSeconds: number;   // earliest event tagged with this session
  endSeconds: number;     // latest event tagged with this session
  eventCount: number;
}

/**
 * Group events by their session tag and compute the time range each session spans.
 * A session is any tag prefixed `session:`. An event may belong to multiple sessions
 * (rare but legal); it contributes to each band's min/max.
 *
 * Returns bands sorted by startSeconds.
 */
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
 * Render alternating-colour bands for each session. Single-day sessions get a
 * minimum visible width so they don't collapse to zero.
 */
export function renderSessionBands(
  container: HTMLElement,
  bands: SessionBand[],
  view: ViewState,
  size: ViewportSize,
): void {
  container.innerHTML = '';

  const SECONDS_PER_DAY = 86400;
  const MIN_WIDTH_SECONDS = SECONDS_PER_DAY; // at least 1 day wide

  for (let i = 0; i < bands.length; i++) {
    const band = bands[i];
    const start = band.startSeconds;
    const end = Math.max(band.endSeconds, start + MIN_WIDTH_SECONDS);

    const leftX = secondsToX(start, view, size);
    const rightX = secondsToX(end + SECONDS_PER_DAY, view, size); // extend to end of the last day

    // Cull bands entirely off-screen
    if (rightX < 0 || leftX > size.width) continue;

    const clampedLeft = Math.max(leftX, -20);
    const clampedRight = Math.min(rightX, size.width + 20);

    const bandEl = document.createElement('div');
    bandEl.className = 'session-band';
    bandEl.style.left = `${clampedLeft}px`;
    bandEl.style.width = `${clampedRight - clampedLeft}px`;
    bandEl.style.background = i % 2 === 0
      ? themeColor('session_band_a' as any)
      : themeColor('session_band_b' as any);
    bandEl.dataset.sessionId = band.sessionId;

    const label = document.createElement('div');
    label.className = 'session-band-label';
    label.textContent = `Session: ${band.sessionId}`;
    bandEl.appendChild(label);

    container.appendChild(bandEl);
  }
}
