import { fromAbsoluteSeconds } from '../calendar/golarian';
import { formatAxisDay, formatAxisHour, formatNowMarker } from '../calendar/format';
import {
  xToSeconds,
  secondsToX,
  SECONDS_PER_DAY,
  type ViewState,
  type ViewportSize,
} from '../math/zoom';
export { SNAP_SECS } from './time-increments';
import { SNAP_SECS } from './time-increments';
export const QUICK_ADD_ZONE_TOP = 4; // px below axisY where indicator activates
export const QUICK_ADD_ZONE_BOTTOM = 68; // px below axisY where it stops

export interface QuickAddZonesDeps {
  getView(): ViewState;
  getViewport(): ViewportSize;
  /** True if pan or reschedule is currently dragging — hide indicators. */
  isInteractionActive(): boolean;
  /** True if the prior gesture should suppress the upcoming click. */
  shouldSuppressClick(): boolean;
  onQuickAdd(seconds: number): void | Promise<void>;
  onSetNow(seconds: number): void | Promise<void>;
}

export interface QuickAddZonesController {
  destroy(): void;
  hide(): void;
  /** Show the quick-add marker at the given absolute seconds (keyboard navigation). */
  keyboardShowAt(seconds: number): void;
  /** Hide the quick-add marker (keyboard navigation). */
  keyboardHide(): void;
}

export function createQuickAddZones(
  container: HTMLElement,
  deps: QuickAddZonesDeps,
): QuickAddZonesController {
  let quickAddSeconds: number | null = null;
  let shiftPreviewSeconds: number | null = null;

  const quickAdd = document.createElement('div');
  quickAdd.className = 'quick-add';
  quickAdd.innerHTML = `<div class="quick-add-circle">+</div><div class="quick-add-label"></div>`;
  quickAdd.style.display = 'none';
  container.appendChild(quickAdd);

  const shiftPreview = document.createElement('div');
  shiftPreview.className = 'shift-now-preview';
  shiftPreview.innerHTML = `
    <div class="shift-now-labels">
      <div class="shift-now-hint">set now</div>
      <div class="shift-now-date"></div>
      <div class="shift-now-year"></div>
      <div class="shift-now-time"></div>
    </div>`;
  shiftPreview.style.display = 'none';
  container.appendChild(shiftPreview);

  function hide() {
    quickAdd.style.display = 'none';
    quickAddSeconds = null;
    shiftPreview.style.display = 'none';
    shiftPreviewSeconds = null;
  }

  /** Render the quick-add marker at the given snapped seconds and x position. */
  function renderQuickAddMarker(snapped: number, labelText: string) {
    const view = deps.getView();
    const size = deps.getViewport();
    const axisY = Math.floor(container.clientHeight * 0.8);
    const x = secondsToX(snapped, view, size);
    const label = quickAdd.querySelector('.quick-add-label') as HTMLElement;
    label.textContent = labelText;
    quickAdd.style.left = `${x}px`;
    quickAdd.style.top = `${axisY}px`;
    quickAdd.style.display = '';
  }

  function onMouseMove(e: MouseEvent) {
    if (deps.isInteractionActive()) {
      hide();
      return;
    }

    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const axisY = Math.floor(container.clientHeight * 0.8);

    if (y < axisY + QUICK_ADD_ZONE_TOP || y > axisY + QUICK_ADD_ZONE_BOTTOM) {
      hide();
      return;
    }

    const view = deps.getView();
    const size = deps.getViewport();
    const rawSecs = xToSeconds(x, view, size);
    const snapUnit = e.ctrlKey ? SECONDS_PER_DAY : SNAP_SECS;
    const snapped = Math.round(rawSecs / snapUnit) * snapUnit;
    const date = fromAbsoluteSeconds(snapped);

    if (e.shiftKey) {
      quickAdd.style.display = 'none';
      quickAddSeconds = null;
      shiftPreviewSeconds = snapped;
      const [dayMonth, year, time] = formatNowMarker(date);
      const snappedX = secondsToX(snapped, view, size);
      shiftPreview.style.left = `${snappedX}px`;
      shiftPreview.style.display = '';
      const labelsEl = shiftPreview.querySelector('.shift-now-labels') as HTMLElement;
      labelsEl.style.top = `${axisY + 66}px`;
      (shiftPreview.querySelector('.shift-now-date') as HTMLElement).textContent = dayMonth;
      (shiftPreview.querySelector('.shift-now-year') as HTMLElement).textContent = year;
      const timeEl = shiftPreview.querySelector('.shift-now-time') as HTMLElement;
      timeEl.textContent = time ?? '';
      timeEl.style.display = time ? '' : 'none';
    } else {
      shiftPreview.style.display = 'none';
      shiftPreviewSeconds = null;
      quickAddSeconds = snapped;
      const labelText = e.ctrlKey
        ? formatAxisDay(date)
        : `${formatAxisDay(date)} ${formatAxisHour(date)}`;
      renderQuickAddMarker(snapped, labelText);
    }
  }

  function onMouseLeave() {
    hide();
  }

  function onKeyUp(e: KeyboardEvent) {
    if (e.key === 'Shift') {
      shiftPreview.style.display = 'none';
      shiftPreviewSeconds = null;
    }
  }

  async function onClick(e: MouseEvent) {
    if (deps.shouldSuppressClick()) return;

    if (e.shiftKey && shiftPreviewSeconds !== null) {
      const secs = shiftPreviewSeconds;
      hide();
      await deps.onSetNow(secs);
      return;
    }

    if (quickAddSeconds === null) return;
    if ((e.target as HTMLElement).closest('.event-card')) return;
    const secs = quickAddSeconds;
    quickAdd.style.display = 'none';
    quickAddSeconds = null;
    await deps.onQuickAdd(secs);
  }

  container.addEventListener('mousemove', onMouseMove);
  container.addEventListener('mouseleave', onMouseLeave);
  container.addEventListener('click', onClick);
  window.addEventListener('keyup', onKeyUp);

  return {
    destroy() {
      container.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('mouseleave', onMouseLeave);
      container.removeEventListener('click', onClick);
      window.removeEventListener('keyup', onKeyUp);
      quickAdd.remove();
      shiftPreview.remove();
    },
    hide,
    keyboardShowAt(seconds: number) {
      quickAddSeconds = seconds;
      const date = fromAbsoluteSeconds(seconds);
      const labelText = `${formatAxisDay(date)} ${formatAxisHour(date)}`;
      shiftPreview.style.display = 'none';
      shiftPreviewSeconds = null;
      renderQuickAddMarker(seconds, labelText);
    },
    keyboardHide() {
      hide();
    },
  };
}
