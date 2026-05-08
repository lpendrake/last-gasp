import {
  type ViewState, type ViewportSize,
  SECONDS_PER_DAY, xToSeconds, secondsToX,
} from './zoom.ts';
import { parseISOString, toAbsoluteSeconds, fromAbsoluteSeconds, toISOString } from '../../calendar/golarian.ts';
import { formatAxisDay, formatAxisHour } from '../../calendar/format.ts';
import type { Session } from '../../data/types.ts';

const SNAP_SECS = 900;
const HANDLE_R = 7;          // radius of circular drag handle knob
const HANDLE_ZONE = 12;      // px detection zone around handle centre

export interface SessionModeDeps {
  getSessions(): Session[];
  getView(): ViewState;
  getViewport(): ViewportSize;
  onSaveSession(updated: Session): Promise<void>;
  onCreateSession(inGameStart: string, inGameEnd: string): Promise<void>;
  onExitSessionMode(): void;
}

export interface SessionModeController {
  enter(): void;
  exit(): void;
  isHandleDragging(): boolean;
}

interface HandleDrag {
  sessionId: string;
  which: 'start' | 'end';
  originalSecs: number;
  currentSecs: number;
}

export function createSessionMode(
  container: HTMLElement,
  sessionLayer: HTMLElement,
  deps: SessionModeDeps,
): SessionModeController {
  let active = false;
  let drag: HandleDrag | null = null;

  // Exit chip shown at top of container
  const exitChip = document.createElement('div');
  exitChip.className = 'session-exit-chip';
  exitChip.textContent = '⎋ esc to exit session management';
  exitChip.style.display = 'none';
  container.appendChild(exitChip);

  // Live drag label
  const dragLabel = document.createElement('div');
  dragLabel.className = 'ctrl-drag-label';
  dragLabel.style.display = 'none';
  container.appendChild(dragLabel);

  // Two-click creation state
  let pendingClickSecs: number | null = null;
  let pendingGuide: HTMLElement | null = null;

  function clearPendingCreation() {
    pendingClickSecs = null;
    pendingGuide?.remove();
    pendingGuide = null;
  }

  function onMouseDown(e: MouseEvent) {
    if (!active) return;
    if ((e.target as HTMLElement).closest('.modal-overlay, .search-overlay')) return;

    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const axisY = Math.floor(container.clientHeight * 0.8);

    // Check if we clicked a drag handle
    const handleEl = (e.target as HTMLElement).closest('.session-drag-handle') as HTMLElement | null;
    if (handleEl) {
      const sessionId = handleEl.dataset.sessionId!;
      const which = handleEl.dataset.which as 'start' | 'end';
      const session = deps.getSessions().find(s => s.id === sessionId);
      if (!session) return;
      e.stopPropagation();
      const secs = which === 'start'
        ? toAbsoluteSeconds(parseISOString(session.inGameStart))
        : toAbsoluteSeconds(parseISOString(session.inGameEnd));
      drag = { sessionId, which, originalSecs: secs, currentSecs: secs };
      dragLabel.style.display = '';
      return;
    }

    // Two-click session creation — only below the axis in the rail zone
    if (y_inRailZone(e.clientY - rect.top, axisY)) return;

    // Must be in the event area (above axis) for two-click creation
    const y = e.clientY - rect.top;
    if (y > axisY) return;

    const view = deps.getView();
    const size = deps.getViewport();
    const rawSecs = xToSeconds(x, view, size);
    const snapped = Math.round(rawSecs / SNAP_SECS) * SNAP_SECS;

    if (pendingClickSecs === null) {
      pendingClickSecs = snapped;
      // Show a guide line at the first click
      const guide = document.createElement('div');
      guide.className = 'session-creation-guide';
      guide.style.left = `${secondsToX(snapped, view, size)}px`;
      container.appendChild(guide);
      pendingGuide = guide;
    } else {
      const start = Math.min(pendingClickSecs, snapped);
      const end = Math.max(pendingClickSecs, snapped);
      clearPendingCreation();
      deps.onCreateSession(
        toISOString(fromAbsoluteSeconds(start)),
        toISOString(fromAbsoluteSeconds(end)),
      );
    }
  }

  function y_inRailZone(y: number, axisY: number): boolean {
    return y > axisY + 6 && y < axisY + 50;
  }

  function onMouseMove(e: MouseEvent) {
    if (!active || !drag) return;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const view = deps.getView();
    const size = deps.getViewport();
    const axisY = Math.floor(container.clientHeight * 0.8);
    const rawSecs = xToSeconds(x, view, size);
    const snapUnit = e.ctrlKey ? SECONDS_PER_DAY : SNAP_SECS;
    const snapped = Math.round(rawSecs / snapUnit) * snapUnit;
    drag.currentSecs = snapped;

    // Update handle position live
    const snappedX = secondsToX(snapped, view, size);
    const handleEl = sessionLayer.querySelector<HTMLElement>(
      `.session-drag-handle[data-session-id="${CSS.escape(drag.sessionId)}"][data-which="${drag.which}"]`
    );
    if (handleEl) {
      handleEl.style.left = `${snappedX - HANDLE_R}px`;
    }
    const guideEl = sessionLayer.querySelector<HTMLElement>(
      `.session-drag-guide[data-session-id="${CSS.escape(drag.sessionId)}"][data-which="${drag.which}"]`
    );
    if (guideEl) {
      guideEl.style.left = `${snappedX}px`;
    }

    const date = fromAbsoluteSeconds(snapped);
    dragLabel.textContent = formatAxisDay(date) + ' ' + formatAxisHour(date);
    dragLabel.style.left = `${snappedX}px`;
    dragLabel.style.top = `${axisY + 8}px`;
  }

  async function onMouseUp() {
    if (!active || !drag) return;
    const { sessionId, which, originalSecs, currentSecs } = drag;
    drag = null;
    dragLabel.style.display = 'none';

    if (currentSecs === originalSecs) return;
    const session = deps.getSessions().find(s => s.id === sessionId);
    if (!session) return;

    const updated: Session = { ...session };
    if (which === 'start') {
      updated.inGameStart = toISOString(fromAbsoluteSeconds(currentSecs));
      // Don't let start exceed end
      const endSecs = toAbsoluteSeconds(parseISOString(session.inGameEnd));
      if (currentSecs > endSecs) updated.inGameEnd = updated.inGameStart;
    } else {
      updated.inGameEnd = toISOString(fromAbsoluteSeconds(currentSecs));
      // Don't let end precede start
      const startSecs = toAbsoluteSeconds(parseISOString(session.inGameStart));
      if (currentSecs < startSecs) updated.inGameStart = updated.inGameEnd;
    }

    try {
      await deps.onSaveSession(updated);
    } catch (err) {
      console.error('Session handle drag save failed', err);
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!active) return;
    if (e.key === 'Escape') {
      if (drag) {
        drag = null;
        dragLabel.style.display = 'none';
        return;
      }
      clearPendingCreation();
      deps.onExitSessionMode();
    }
  }

  function renderHandles() {
    // Remove existing handles from the session layer (they're rebuilt each render)
    sessionLayer.querySelectorAll('.session-drag-handle, .session-drag-guide').forEach(el => el.remove());

    if (!active) return;

    const view = deps.getView();
    const size = deps.getViewport();
    const axisY = Math.floor(container.clientHeight * 0.8);
    const railTop = axisY + 10;

    for (const session of deps.getSessions()) {
      if (!session.inGameStart) continue;

      const startSecs = toAbsoluteSeconds(parseISOString(session.inGameStart));
      const endSecs = session.inGameEnd
        ? toAbsoluteSeconds(parseISOString(session.inGameEnd))
        : startSecs;

      const startX = secondsToX(startSecs, view, size);
      const endX = secondsToX(endSecs, view, size);

      // Only render handles if at least one endpoint is visible
      if (startX < -HANDLE_ZONE && endX < -HANDLE_ZONE) continue;
      if (startX > size.width + HANDLE_ZONE && endX > size.width + HANDLE_ZONE) continue;

      for (const [which, x] of [['start', startX], ['end', endX]] as const) {
        // Guide line (full height)
        const guide = document.createElement('div');
        guide.className = 'session-drag-guide';
        guide.dataset.sessionId = session.id;
        guide.dataset.which = which;
        guide.style.left = `${x}px`;
        guide.style.setProperty('--handle-color', session.color);
        sessionLayer.appendChild(guide);

        // Knob at the axis
        const handle = document.createElement('div');
        handle.className = 'session-drag-handle';
        handle.dataset.sessionId = session.id;
        handle.dataset.which = which;
        handle.style.left = `${x - HANDLE_R}px`;
        handle.style.top = `${railTop - HANDLE_R}px`;
        handle.style.setProperty('--handle-color', session.color);
        sessionLayer.appendChild(handle);
      }
    }
  }

  container.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('keydown', onKeyDown);

  return {
    enter() {
      active = true;
      exitChip.style.display = '';
      renderHandles();
    },
    exit() {
      active = false;
      drag = null;
      dragLabel.style.display = 'none';
      exitChip.style.display = 'none';
      clearPendingCreation();
      sessionLayer.querySelectorAll('.session-drag-handle, .session-drag-guide').forEach(el => el.remove());
    },
    isHandleDragging: () => drag !== null,
  };
}
