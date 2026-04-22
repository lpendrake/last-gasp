import { type ViewState, type ViewportSize, xToSeconds, secondsToX, SECONDS_PER_DAY } from './zoom.ts';
import { fromAbsoluteDays, toAbsoluteDays } from '../calendar/golarian.ts';
import { formatAxisDay, formatFloatingMonth } from '../calendar/format.ts';

/**
 * Render axis major tick marks and labels for the visible range.
 * Returns the DOM elements to add to an axis container.
 */
export function renderAxis(
  container: HTMLElement,
  view: ViewState,
  size: ViewportSize,
): void {
  container.innerHTML = '';

  const axisY = Math.floor(size.height * 0.8);
  const line = document.createElement('div');
  line.className = 'axis-line';
  line.style.top = `${axisY}px`;
  container.appendChild(line);

  // Choose tick granularity based on zoom
  const pixelsPerDay = SECONDS_PER_DAY / view.secondsPerPixel;
  const dayStep = chooseDayStep(pixelsPerDay);

  const startSec = xToSeconds(0, view, size);
  const endSec = xToSeconds(size.width, view, size);
  const startDay = Math.floor(startSec / SECONDS_PER_DAY) - 1;
  const endDay = Math.ceil(endSec / SECONDS_PER_DAY) + 1;

  const firstTickDay = Math.ceil(startDay / dayStep) * dayStep;

  for (let d = firstTickDay; d <= endDay; d += dayStep) {
    const x = secondsToX(d * SECONDS_PER_DAY, view, size);
    if (x < -50 || x > size.width + 50) continue;

    const date = fromAbsoluteDays(d);
    const tick = document.createElement('div');
    tick.className = 'axis-tick';
    tick.style.left = `${x}px`;
    tick.style.top = `${axisY}px`;

    const mark = document.createElement('div');
    mark.className = 'axis-tick-mark';
    tick.appendChild(mark);

    const label = document.createElement('div');
    label.className = 'axis-tick-label';
    label.textContent = formatAxisDay(date);
    tick.appendChild(label);

    container.appendChild(tick);
  }

  // Floating month header on the left edge
  const centerDate = fromAbsoluteDays(Math.floor(xToSeconds(0, view, size) / SECONDS_PER_DAY));
  const floating = document.createElement('div');
  floating.className = 'axis-floating-header';
  floating.textContent = formatFloatingMonth({ ...centerDate, hour: 0, minute: 0, second: 0 });
  container.appendChild(floating);
}

/** Choose day-tick spacing that keeps labels readable at the current zoom level. */
function chooseDayStep(pixelsPerDay: number): number {
  const TARGET_PX = 80; // aim for ticks ~80px apart
  const candidates = [1, 2, 5, 10, 20, 30, 60, 90, 180, 365];
  const idealDays = TARGET_PX / pixelsPerDay;
  for (const c of candidates) {
    if (c >= idealDays) return c;
  }
  return candidates[candidates.length - 1];
}

export function todayAbsoluteSeconds(): number {
  // Unused but kept for future "Now" button math
  return 0;
}

export { toAbsoluteDays };
