import { type ViewState, type ViewportSize, xToSeconds, secondsToX, SECONDS_PER_DAY } from '../interactions/zoom.ts';
import { fromAbsoluteDays, toAbsoluteDays, daysInMonth, monthName, fromAbsoluteSeconds } from '../../calendar/golarian.ts';
import { formatAxisDayTick, formatAxisHour } from '../../calendar/format.ts';

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

    const pxPerTick = pixelsPerDay * dayStep;
    const dayLabelLevel = pxPerTick >= 55 ? 'full' : 'short';

    const label = document.createElement('div');
    label.className = 'axis-tick-label';
    label.textContent = formatAxisDayTick(date, dayLabelLevel);
    tick.appendChild(label);

    container.appendChild(tick);
  }

  // Pinned day label: when zoomed to hours the midnight tick is off-screen left,
  // so pin the current day's label at the left edge (mirrors the month-label pin).
  if (dayStep === 1) {
    const leftDay = Math.floor(startSec / SECONDS_PER_DAY);
    const leftDayX = secondsToX(leftDay * SECONDS_PER_DAY, view, size);
    if (leftDayX < 0) {
      const date = fromAbsoluteDays(leftDay);
      const pin = document.createElement('div');
      pin.className = 'axis-day-pin';
      pin.style.left = '8px';
      pin.style.top = `${axisY + 17}px`;
      pin.textContent = formatAxisDayTick(date, 'full');
      container.appendChild(pin);
    }
  }

  // Month bands + labels
  const BAND_TOP = axisY - 2;
  const BAND_HEIGHT = 100; // covers tick marks + labels + session pills + month label
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
      lbl.style.top = `${axisY + 64}px`;
      lbl.innerHTML = `<div class="axis-month-name">${monthName(md.month)}</div><div class="axis-month-year">${md.year} AR</div>`;
      container.appendChild(lbl);
    }

    monthStartDay = monthEndDay;
  }

  // Intraday time dividers (appended last so they sit above month bands)
  renderTimeTicks(container, view, size, axisY, startSec, endSec);
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

// ---------------------------------------------------------------------------
// Intraday time dividers
// ---------------------------------------------------------------------------

export interface TimeTier {
  readonly id: 'midday' | 'hour' | 'half' | 'quarter' | 'minute';
  /** Seconds between ticks of this tier. */
  readonly stepSecs: number;
  /** Minimum pixels-per-day to render the tick mark. */
  readonly markMinPPD: number;
  /** Tick mark height in px (centered on the axis line). */
  readonly markHeight: number;
  /** Minimum pixels-per-day to also render the hh:mm label. */
  readonly labelMinPPD: number;
}

export const ALL_TIERS: readonly TimeTier[] = [
  { id: 'midday',  stepSecs: 43200, markMinPPD:   80, markHeight: 12, labelMinPPD:   120 },
  { id: 'hour',    stepSecs:  3600, markMinPPD:  800, markHeight:  8, labelMinPPD:  1500 },
  { id: 'half',    stepSecs:  1800, markMinPPD: 1600, markHeight:  5, labelMinPPD:  3000 },
  { id: 'quarter', stepSecs:   900, markMinPPD: 3200, markHeight:  3, labelMinPPD:  6000 },
  { id: 'minute',  stepSecs:    60, markMinPPD:40000, markHeight:  2, labelMinPPD: 100000 },
];

/**
 * Returns the coarsest tier (from `tiers`, ordered coarsest-first) whose step
 * evenly divides `withinDay`, or null if none do.
 *
 * Pure function — exported for tests.
 */
export function naturalTier(withinDay: number, tiers: readonly TimeTier[]): TimeTier | null {
  for (const tier of tiers) {
    if (withinDay % tier.stepSecs === 0) return tier;
  }
  return null;
}

/**
 * Render intraday time-divider ticks into `container`.
 * Called from `renderAxis` after day ticks and month bands are placed.
 */
function renderTimeTicks(
  container: HTMLElement,
  view: ViewState,
  size: ViewportSize,
  axisY: number,
  startSec: number,
  endSec: number,
): void {
  const pixelsPerDay = SECONDS_PER_DAY / view.secondsPerPixel;

  const activeTiers = ALL_TIERS.filter(t => pixelsPerDay >= t.markMinPPD);
  if (activeTiers.length === 0) return;

  // Step by the finest active tier so we visit every relevant position.
  const stepSecs = activeTiers[activeTiers.length - 1].stepSecs;

  const firstTick = Math.ceil(startSec / stepSecs) * stepSecs;
  const frag = document.createDocumentFragment();

  for (let t = firstTick; t <= endSec; t += stepSecs) {
    // Defensive positive modulo (seconds since epoch are always positive for
    // in-game dates, but guard anyway).
    const withinDay = ((t % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY;
    if (withinDay === 0) continue; // midnight → owned by day-boundary tick

    const tier = naturalTier(withinDay, activeTiers);
    if (!tier) continue;

    const x = secondsToX(t, view, size);
    if (x < -5 || x > size.width + 5) continue;

    const el = document.createElement('div');
    el.className = `axis-time-tick axis-time-${tier.id}`;
    el.style.left = `${x}px`;
    el.style.top = `${axisY}px`;

    const mark = document.createElement('div');
    mark.className = 'axis-time-mark';
    el.appendChild(mark);

    if (pixelsPerDay >= tier.labelMinPPD) {
      const date = fromAbsoluteSeconds(t);
      const lbl = document.createElement('div');
      lbl.className = 'axis-time-label';
      lbl.textContent = formatAxisHour(date, true);
      el.appendChild(lbl);
    }

    frag.appendChild(el);
  }

  container.appendChild(frag);
}

export function todayAbsoluteSeconds(): number {
  // Unused but kept for future "Now" button math
  return 0;
}

export { toAbsoluteDays };
