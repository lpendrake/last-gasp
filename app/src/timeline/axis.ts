import { type ViewState, type ViewportSize, xToSeconds, secondsToX, SECONDS_PER_DAY } from './zoom.ts';
import { fromAbsoluteDays, toAbsoluteDays, daysInMonth, monthName } from '../calendar/golarian.ts';
import { formatAxisDay } from '../calendar/format.ts';

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

  // Month bands + labels
  const BAND_TOP = axisY - 2;
  const BAND_HEIGHT = 64; // covers tick marks + labels + month label
  const LABEL_MIN_BAND_PX = 60; // don't draw label if the visible slice is too narrow

  const startDate = fromAbsoluteDays(Math.max(0, Math.floor(startSec / SECONDS_PER_DAY)));
  let monthStartDay = toAbsoluteDays({ year: startDate.year, month: startDate.month, day: 1 });

  while (true) {
    const md = fromAbsoluteDays(monthStartDay);
    const dm = daysInMonth(md.year, md.month);
    const monthEndDay = monthStartDay + dm;

    const bandStartX = secondsToX(monthStartDay * SECONDS_PER_DAY, view, size);
    const bandEndX = secondsToX(monthEndDay * SECONDS_PER_DAY, view, size);

    if (bandStartX > size.width) break;
    if (bandEndX < 0) { monthStartDay = monthEndDay; continue; }

    const clampedStart = Math.max(0, bandStartX);
    const clampedEnd = Math.min(size.width, bandEndX);

    const band = document.createElement('div');
    band.className = `axis-month-band${md.month % 2 === 0 ? ' is-even' : ''}`;
    band.style.left = `${clampedStart}px`;
    band.style.width = `${clampedEnd - clampedStart}px`;
    band.style.top = `${BAND_TOP}px`;
    band.style.height = `${BAND_HEIGHT}px`;
    container.insertBefore(band, container.firstChild); // behind ticks

    if (clampedEnd - clampedStart >= LABEL_MIN_BAND_PX) {
      const labelX = Math.max(8, bandStartX + 8);
      const lbl = document.createElement('div');
      lbl.className = 'axis-month-label';
      lbl.style.left = `${labelX}px`;
      lbl.style.top = `${axisY + 32}px`;
      lbl.innerHTML = `<div class="axis-month-name">${monthName(md.month)}</div><div class="axis-month-year">${md.year} AR</div>`;
      container.appendChild(lbl);
    }

    monthStartDay = monthEndDay;
  }
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
