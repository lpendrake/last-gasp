import { parseISOString, toAbsoluteSeconds, fromAbsoluteSeconds } from '../calendar/golarian';
import { formatAxisDay, formatAxisHour } from '../calendar/format';
import { secondsToX, xToSeconds, SECONDS_PER_DAY } from '../math/zoom';
import type { ViewState, ViewportSize } from '../math/zoom';
import type { EventListItem } from '../data/types';

const SNAP_SECS = 900;

export interface RescheduleDeps {
  getView(): ViewState;
  getSize(): ViewportSize;
  getEvents(): EventListItem[];
  getDragLabel(): HTMLElement | null;
  saveReschedule(filename: string, newSeconds: number): Promise<void>;
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

export interface RescheduleController {
  destroy(): void;
  isActive(): boolean;
  /** True if the most recent gesture entered reschedule mode (suppress click).
   * Cleared on the next non-reschedule mousedown. */
  wasActivated(): boolean;
}

export function createReschedule(
  container: HTMLElement,
  deps: RescheduleDeps,
): RescheduleController {
  let session: DragSession | null = null;
  let activated = false;

  function onMouseDown(e: MouseEvent) {
    if (!e.shiftKey || e.button !== 0) {
      activated = false;
      return;
    }

    const cardEl = (e.target as HTMLElement).closest('.event-card') as HTMLElement | null;
    if (!cardEl) {
      activated = false;
      return;
    }

    const filename = cardEl.dataset.filename;
    if (!filename) {
      activated = false;
      return;
    }

    const ev = deps.getEvents().find((ev) => ev.filename === filename);
    if (!ev) {
      activated = false;
      return;
    }

    const originalSecs = toAbsoluteSeconds(parseISOString(ev.date));

    session = {
      filename,
      cardEl,
      connectorEl: container.querySelector<HTMLElement>(
        `.event-card-connector[data-filename="${CSS.escape(filename)}"]`,
      ),
      dotEl: container.querySelector<HTMLElement>(
        `.event-card-dot[data-filename="${CSS.escape(filename)}"]`,
      ),
      // getBoundingClientRect is reliable regardless of box-sizing or inline-style presence.
      cardWidth: Math.round(cardEl.getBoundingClientRect().width),
      startMouseX: e.clientX,
      originalSecs,
      currentSecs: originalSecs,
    };

    activated = true;
    cardEl.classList.add('is-rescheduling');
    container.style.cursor = 'ew-resize';
    e.preventDefault(); // suppress text selection during drag
  }

  function placeAt(s: DragSession, secs: number) {
    const x = secondsToX(secs, deps.getView(), deps.getSize());
    s.cardEl.style.left = `${x - s.cardWidth / 2}px`;
    if (s.connectorEl) s.connectorEl.style.left = `${x}px`;
    if (s.dotEl) s.dotEl.style.left = `${x}px`;
    return x;
  }

  function hideDragLabel() {
    const label = deps.getDragLabel();
    if (label) label.style.display = 'none';
  }

  function endSession(s: DragSession) {
    s.cardEl.classList.remove('is-rescheduling');
    container.style.cursor = '';
    session = null;
    hideDragLabel();
  }

  function onMouseMove(e: MouseEvent) {
    if (!session) return;

    const view = deps.getView();
    const size = deps.getSize();
    const axisY = Math.floor(size.height * 0.8);

    const deltaX = e.clientX - session.startMouseX;
    const originalX = secondsToX(session.originalSecs, view, size);
    const rawSecs = xToSeconds(originalX + deltaX, view, size);
    const snapUnit = e.ctrlKey ? SECONDS_PER_DAY : SNAP_SECS;
    const snappedSecs = Math.round(rawSecs / snapUnit) * snapUnit;

    session.currentSecs = snappedSecs;
    const snappedX = placeAt(session, snappedSecs);

    const date = fromAbsoluteSeconds(snappedSecs);
    const labelText = `${formatAxisDay(date)} ${formatAxisHour(date)}`;
    const label = deps.getDragLabel();
    if (label) {
      label.textContent = labelText;
      label.style.left = `${snappedX}px`;
      label.style.top = `${axisY + 8}px`;
      label.style.display = '';
    }
  }

  async function onMouseUp() {
    if (!session) return;
    const s = session;
    const { filename, originalSecs, currentSecs } = s;
    endSession(s);

    if (currentSecs !== originalSecs) {
      try {
        await deps.saveReschedule(filename, currentSecs);
      } catch (err) {
        // Revert the imperatively-moved DOM nodes — React won't do it because it
        // compares its own last-set value and sees no change.
        placeAt(s, originalSecs);
        console.error('[reschedule] save failed', err);
      }
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key !== 'Escape' || !session) return;
    placeAt(session, session.originalSecs);
    endSession(session);
    // activated stays true so the upcoming mouseup→click is suppressed
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
    },
    isActive: () => session !== null,
    wasActivated: () => activated,
  };
}
