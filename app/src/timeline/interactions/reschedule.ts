import {
  type ViewState, type ViewportSize,
  SECONDS_PER_DAY, xToSeconds, secondsToX,
} from './zoom.ts';
import { parseISOString, toAbsoluteSeconds, fromAbsoluteSeconds } from '../../calendar/golarian.ts';
import { formatAxisDay, formatAxisHour } from '../../calendar/format.ts';
import type { EventListItem } from '../../data/types.ts';

const SNAP_SECS = 900;

export interface RescheduleDeps {
  cardsLayer: HTMLElement;
  getView(): ViewState;
  getViewport(): ViewportSize;
  getEvents(): EventListItem[];
  /** Persist the reschedule. Caller refreshes state on success. */
  saveReschedule(filename: string, newSeconds: number): Promise<void>;
}

export interface RescheduleController {
  destroy(): void;
  /** Drag in progress — used by other interactions to suppress themselves. */
  isActive(): boolean;
  /** True if the most recent gesture entered reschedule mode (suppress
   * click). Cleared on the next non-reschedule mousedown. */
  wasActivated(): boolean;
}

interface DragSession {
  filename: string;
  cardEl: HTMLElement;
  connectorEl: HTMLElement | null;
  dotEl: HTMLElement | null;
  cardWidth: number;
  startMouseX: number;
  originalSecs: number;
  currentSecs: number;
}

export function createReschedule(container: HTMLElement, deps: RescheduleDeps): RescheduleController {
  const { cardsLayer } = deps;
  const ctrlDragLabel = document.createElement('div');
  ctrlDragLabel.className = 'ctrl-drag-label';
  ctrlDragLabel.style.display = 'none';
  container.appendChild(ctrlDragLabel);

  let session: DragSession | null = null;
  let activated = false;

  function endVisuals() {
    if (!session) return;
    session.cardEl.classList.remove('is-ctrl-dragging');
    ctrlDragLabel.style.display = 'none';
    container.style.cursor = '';
  }

  function onMouseDown(e: MouseEvent) {
    if ((e.target as HTMLElement).closest('.event-modal, .modal-overlay, .search-overlay')) return;

    const isRescheduleStart = e.shiftKey && e.button === 0;
    if (!isRescheduleStart) {
      activated = false;  // fresh gesture that isn't reschedule — clear stale flag
      return;
    }
    const cardEl = (e.target as HTMLElement).closest('.event-card') as HTMLElement | null;
    if (!cardEl) { activated = false; return; }
    const filename = cardEl.dataset.filename;
    if (!filename) { activated = false; return; }
    const ev = deps.getEvents().find(ev => ev.filename === filename);
    if (!ev) { activated = false; return; }

    const originalSecs = toAbsoluteSeconds(parseISOString(ev.date));
    session = {
      filename,
      cardEl,
      connectorEl: cardsLayer.querySelector<HTMLElement>(`.event-card-connector[data-filename="${CSS.escape(filename)}"]`),
      dotEl: cardsLayer.querySelector<HTMLElement>(`.event-card-dot[data-filename="${CSS.escape(filename)}"]`),
      cardWidth: parseInt(cardEl.style.width, 10),
      startMouseX: e.clientX,
      originalSecs,
      currentSecs: originalSecs,
    };
    activated = true;
    cardEl.classList.add('is-ctrl-dragging');
    container.style.cursor = 'ew-resize';
  }

  function onMouseMove(e: MouseEvent) {
    if (!session) return;
    const view = deps.getView();
    const size = deps.getViewport();
    const axisY = Math.floor(container.clientHeight * 0.8);
    const deltaX = e.clientX - session.startMouseX;
    const originalX = secondsToX(session.originalSecs, view, size);
    const rawSecs = xToSeconds(originalX + deltaX, view, size);
    const dragSnapUnit = e.ctrlKey ? SECONDS_PER_DAY : SNAP_SECS;
    const snappedSecs = Math.round(rawSecs / dragSnapUnit) * dragSnapUnit;
    session.currentSecs = snappedSecs;
    const snappedX = secondsToX(snappedSecs, view, size);
    session.cardEl.style.left = `${snappedX - session.cardWidth / 2}px`;
    if (session.connectorEl) session.connectorEl.style.left = `${snappedX}px`;
    if (session.dotEl) session.dotEl.style.left = `${snappedX}px`;
    const date = fromAbsoluteSeconds(snappedSecs);
    ctrlDragLabel.textContent = formatAxisDay(date) + ' ' + formatAxisHour(date);
    ctrlDragLabel.style.left = `${snappedX}px`;
    ctrlDragLabel.style.top = `${axisY + 8}px`;
    ctrlDragLabel.style.display = '';
  }

  async function onMouseUp() {
    if (!session) return;
    const { filename, originalSecs, currentSecs } = session;
    endVisuals();
    session = null;
    if (currentSecs !== originalSecs) {
      try {
        await deps.saveReschedule(filename, currentSecs);
      } catch (err) {
        console.error('Reschedule failed', err);
      }
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key !== 'Escape' || !session) return;
    const view = deps.getView();
    const size = deps.getViewport();
    const originalX = secondsToX(session.originalSecs, view, size);
    session.cardEl.style.left = `${originalX - session.cardWidth / 2}px`;
    if (session.connectorEl) session.connectorEl.style.left = `${originalX}px`;
    if (session.dotEl) session.dotEl.style.left = `${originalX}px`;
    endVisuals();
    session = null;
    // `activated` stays true so the upcoming mouseup→click is suppressed.
  }

  container.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('keydown', onKeyDown);

  return {
    destroy() {
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('keydown', onKeyDown);
      ctrlDragLabel.remove();
    },
    isActive: () => session !== null,
    wasActivated: () => activated,
  };
}
