import { xToSeconds, secondsToX, type ViewState, type ViewportSize } from '../math/zoom';
import {
  parseISOString,
  toAbsoluteSeconds,
  fromAbsoluteSeconds,
  toISOString,
} from '../calendar/golarian';
import { formatAxisDay, formatAxisHour } from '../calendar/format';
import type { Session } from '../data/types';

const SNAP_SECS = 900;
const HANDLE_R = 7;
const HANDLE_ZONE = 12;
const CREATION_DRAG_THRESHOLD = 8;

export interface SessionModeDeps {
  getSessions(): Session[];
  getView(): ViewState;
  getViewport(): ViewportSize;
  onSaveSession(updated: Session): Promise<void>;
  onCreateSessionPrefill(inGameStart: string, inGameEnd: string): void;
  onExitSessionMode(): void;
}

export interface SessionModeController {
  enter(): void;
  exit(): void;
  renderHandles(): void;
  isHandleDragging(): boolean;
  isActive(): boolean;
  destroy(): void;
}

interface HandleDrag {
  sessionId: string;
  which: 'start' | 'end';
  originalSecs: number;
  currentSecs: number;
  anchorSecs: number;
}

interface WholeDrag {
  sessionId: string;
  originalStart: number;
  originalEnd: number;
  anchorSecs: number;
  currentDelta: number;
  ghostEl: HTMLElement | null;
}

/** Clamp the moving end so it never overlaps an existing session. Touching is allowed. */
export function clampCreationEnd(anchorSecs: number, rawSecs: number, sessions: Session[]): number {
  if (rawSecs === anchorSecs) return rawSecs;
  const movingRight = rawSecs > anchorSecs;
  let clamped = rawSecs;
  for (const s of sessions) {
    if (!s.inGameStart) continue;
    try {
      const sStart = toAbsoluteSeconds(parseISOString(s.inGameStart));
      const sEnd = s.inGameEnd ? toAbsoluteSeconds(parseISOString(s.inGameEnd)) : sStart;
      if (sStart === sEnd) continue;
      if (movingRight) {
        if (sStart >= anchorSecs && sStart < clamped) clamped = sStart;
        if (sStart < anchorSecs && anchorSecs < sEnd) clamped = anchorSecs;
      } else {
        if (sEnd < anchorSecs && sEnd > clamped) clamped = sEnd;
        if (sStart < anchorSecs && anchorSecs < sEnd) clamped = anchorSecs;
      }
    } catch {
      /* ignore parse errors */
    }
  }
  return clamped;
}

/** Clamp a whole-session shift delta so the moved session doesn't overlap any other. */
export function clampWholeDragDelta(
  originalStart: number,
  originalEnd: number,
  delta: number,
  sessions: Session[],
  excludeId: string,
): number {
  if (delta === 0) return 0;
  const movingRight = delta > 0;
  let clamped = delta;
  for (const s of sessions) {
    if (s.id === excludeId || !s.inGameStart) continue;
    try {
      const sStart = toAbsoluteSeconds(parseISOString(s.inGameStart));
      const sEnd = s.inGameEnd ? toAbsoluteSeconds(parseISOString(s.inGameEnd)) : sStart;
      if (sStart === sEnd) continue;
      if (movingRight) {
        if (sStart >= originalEnd && sStart - originalEnd < clamped) {
          clamped = sStart - originalEnd;
        }
      } else {
        if (sEnd <= originalStart && sEnd - originalStart > clamped) {
          clamped = sEnd - originalStart;
        }
      }
    } catch {
      /* ignore parse errors */
    }
  }
  return clamped;
}

export function createSessionMode(
  container: HTMLElement,
  deps: SessionModeDeps,
): SessionModeController {
  let active = false;
  let drag: HandleDrag | null = null;
  let wholeDrag: WholeDrag | null = null;

  const exitChip = document.createElement('div');
  exitChip.className = 'session-exit-chip';
  exitChip.textContent = '⎋ esc to exit session management';
  exitChip.style.display = 'none';
  container.appendChild(exitChip);

  const dragLabel = document.createElement('div');
  dragLabel.className = 'session-drag-label';
  dragLabel.style.display = 'none';
  container.appendChild(dragLabel);

  let pendingClickSecs: number | null = null;
  let pendingCurrentSecs = 0;
  let pendingPill: HTMLElement | null = null;
  let pendingGuideEl: HTMLElement | null = null;
  let pendingWashEl: HTMLElement | null = null;
  let creationMouseDown = false;
  let creationDragMoved = false;
  let creationStartX = 0;

  function getSessionLayer(): HTMLElement | null {
    return container.querySelector<HTMLElement>('[data-session-layer]');
  }

  function clearPendingCreation() {
    pendingClickSecs = null;
    creationMouseDown = false;
    creationDragMoved = false;
    pendingPill?.remove();
    pendingPill = null;
    pendingGuideEl?.remove();
    pendingGuideEl = null;
    pendingWashEl?.remove();
    pendingWashEl = null;
  }

  function yInRailZone(y: number, axisY: number): boolean {
    return y > axisY + 4 && y < axisY + 90;
  }

  function snapToSessionEndpoints(
    rawSecs: number,
    excludeSessionId: string,
    excludeWhich: 'start' | 'end',
  ): number {
    let best = rawSecs;
    let bestDist = Infinity;
    for (const s of deps.getSessions()) {
      if (!s.inGameStart) continue;
      const pts: Array<[number, 'start' | 'end']> = [
        [toAbsoluteSeconds(parseISOString(s.inGameStart)), 'start'],
      ];
      if (s.inGameEnd && s.inGameEnd !== s.inGameStart) {
        pts.push([toAbsoluteSeconds(parseISOString(s.inGameEnd)), 'end']);
      }
      for (const [secs, which] of pts) {
        if (s.id === excludeSessionId && which === excludeWhich) continue;
        const d = Math.abs(secs - rawSecs);
        if (d < bestDist) {
          bestDist = d;
          best = secs;
        }
      }
    }
    return best;
  }

  function onMouseDown(e: MouseEvent) {
    if (!active) return;
    if ((e.target as HTMLElement).closest('.session-editor-overlay')) return;

    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const axisY = Math.floor(container.clientHeight * 0.8);

    const handleEl = (e.target as HTMLElement).closest(
      '.session-drag-handle',
    ) as HTMLElement | null;
    if (handleEl) {
      const sessionId = handleEl.dataset.sessionId!;
      const which = handleEl.dataset.which as 'start' | 'end';
      const session = deps.getSessions().find((s) => s.id === sessionId);
      if (!session) return;
      e.stopPropagation();
      const startSecs = toAbsoluteSeconds(parseISOString(session.inGameStart));
      const endSecs = session.inGameEnd
        ? toAbsoluteSeconds(parseISOString(session.inGameEnd))
        : startSecs;
      const secs = which === 'start' ? startSecs : endSecs;
      const anchorSecs = which === 'start' ? endSecs : startSecs;
      drag = { sessionId, which, originalSecs: secs, currentSecs: secs, anchorSecs };
      dragLabel.style.display = '';
      return;
    }

    const pillEl = (e.target as HTMLElement).closest('.session-pill') as HTMLElement | null;
    if (pillEl && e.shiftKey) {
      const sessionId = pillEl.dataset.sessionId!;
      const session = deps.getSessions().find((s) => s.id === sessionId);
      if (session) {
        e.stopPropagation();
        const anchorSecs = xToSeconds(e.clientX - rect.left, deps.getView(), deps.getViewport());
        const originalStart = toAbsoluteSeconds(parseISOString(session.inGameStart));
        const originalEnd = session.inGameEnd
          ? toAbsoluteSeconds(parseISOString(session.inGameEnd))
          : originalStart;
        wholeDrag = {
          sessionId,
          originalStart,
          originalEnd,
          anchorSecs,
          currentDelta: 0,
          ghostEl: null,
        };
        dragLabel.style.display = '';
        return;
      }
    }

    // Plain pill click: let it bubble to React onClick handler
    if (pillEl) return;

    const y = e.clientY - rect.top;
    if (!yInRailZone(y, axisY)) return;

    const view = deps.getView();
    const size = deps.getViewport();
    const rawSecs = xToSeconds(x, view, size);
    const snapped = Math.round(rawSecs / SNAP_SECS) * SNAP_SECS;

    // Second click (anchor set, mouse released): commit creation
    if (pendingClickSecs !== null && !creationMouseDown) {
      const finalStart = Math.min(pendingClickSecs, pendingCurrentSecs);
      const finalEnd = Math.max(pendingClickSecs, pendingCurrentSecs);
      clearPendingCreation();
      deps.onCreateSessionPrefill(
        toISOString(fromAbsoluteSeconds(finalStart)),
        toISOString(fromAbsoluteSeconds(finalEnd)),
      );
      return;
    }
    if (pendingClickSecs !== null) return;

    e.preventDefault();
    creationMouseDown = true;
    creationDragMoved = false;
    creationStartX = e.clientX;
    const clamped = clampCreationEnd(snapped, snapped, deps.getSessions());
    pendingClickSecs = clamped;
    pendingCurrentSecs = clamped;
    const anchorX = secondsToX(clamped, view, size);
    const pillTop = axisY + 34;

    const wash = document.createElement('div');
    wash.className = 'session-wash';
    wash.style.left = `${anchorX}px`;
    wash.style.width = '0px';
    wash.style.setProperty('--wash-color', 'var(--theme-accent-gold, #c9a860)');
    container.appendChild(wash);
    pendingWashEl = wash;

    const guide = document.createElement('div');
    guide.className = 'session-drag-guide';
    guide.style.left = `${anchorX}px`;
    guide.style.setProperty('--handle-color', 'var(--theme-accent-gold, #c9a860)');
    container.appendChild(guide);
    pendingGuideEl = guide;

    const pill = document.createElement('div');
    pill.className = 'session-creation-pill';
    pill.style.top = `${pillTop}px`;
    pill.style.left = `${anchorX}px`;
    pill.style.width = '0px';
    container.appendChild(pill);
    pendingPill = pill;
  }

  function onMouseMove(e: MouseEvent) {
    if (!active) return;

    if (wholeDrag) {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const view = deps.getView();
      const size = deps.getViewport();
      const axisY = Math.floor(container.clientHeight * 0.8);
      const rawSecs = xToSeconds(x, view, size);
      const rawNewStart = wholeDrag.originalStart + (rawSecs - wholeDrag.anchorSecs);
      const snappedStart = Math.round(rawNewStart / SNAP_SECS) * SNAP_SECS;
      const rawDelta = snappedStart - wholeDrag.originalStart;
      const delta = clampWholeDragDelta(
        wholeDrag.originalStart,
        wholeDrag.originalEnd,
        rawDelta,
        deps.getSessions(),
        wholeDrag.sessionId,
      );
      wholeDrag.currentDelta = delta;

      const newStart = wholeDrag.originalStart + delta;
      const newEnd = wholeDrag.originalEnd + delta;
      const startX = secondsToX(newStart, view, size);
      const endX = secondsToX(newEnd, view, size);
      const pillW = Math.max(endX - startX, 12);

      const sessionLayer = getSessionLayer();
      if (!wholeDrag.ghostEl && sessionLayer) {
        const ghost = document.createElement('div');
        ghost.className = 'session-ghost-pill';
        const session = deps.getSessions().find((s) => s.id === wholeDrag!.sessionId);
        ghost.style.setProperty('--pill-color', session?.color ?? '#6b7c5a');
        ghost.style.height = '24px';
        ghost.style.borderRadius = '12px';
        ghost.style.top = `${axisY + 34}px`;
        sessionLayer.appendChild(ghost);
        wholeDrag.ghostEl = ghost;
      }
      if (wholeDrag.ghostEl) {
        wholeDrag.ghostEl.style.left = `${startX}px`;
        wholeDrag.ghostEl.style.width = `${pillW}px`;
      }

      const date = fromAbsoluteSeconds(newStart);
      dragLabel.textContent = formatAxisDay(date) + ' ' + formatAxisHour(date);
      dragLabel.style.left = `${startX}px`;
      dragLabel.style.top = `${axisY + 8}px`;
      return;
    }

    if (pendingClickSecs !== null && creationMouseDown && !creationDragMoved) {
      if (Math.abs(e.clientX - creationStartX) >= CREATION_DRAG_THRESHOLD) {
        creationDragMoved = true;
      }
    }

    if (pendingClickSecs !== null && pendingPill) {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const view = deps.getView();
      const size = deps.getViewport();
      const rawSecs = xToSeconds(x, view, size);
      const snappedRaw = Math.round(rawSecs / SNAP_SECS) * SNAP_SECS;
      const clamped = clampCreationEnd(pendingClickSecs, snappedRaw, deps.getSessions());
      pendingCurrentSecs = clamped;

      const previewStart = Math.min(pendingClickSecs, clamped);
      const previewEnd = Math.max(pendingClickSecs, clamped);
      const startX = secondsToX(previewStart, view, size);
      const endX = secondsToX(previewEnd, view, size);
      const pillW = Math.max(endX - startX, 2);

      pendingPill.style.left = `${startX}px`;
      pendingPill.style.width = `${pillW}px`;

      if (pendingWashEl) {
        pendingWashEl.style.left = `${startX}px`;
        pendingWashEl.style.width = `${pillW}px`;
      }

      const isClamped = clamped !== snappedRaw;
      const movingEndIsLeft = clamped <= pendingClickSecs;
      pendingPill.classList.toggle('left-flat', isClamped && movingEndIsLeft);
      pendingPill.classList.toggle('right-flat', isClamped && !movingEndIsLeft);
      return;
    }

    if (!drag) return;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const view = deps.getView();
    const size = deps.getViewport();
    const axisY = Math.floor(container.clientHeight * 0.8);
    const rawSecs = xToSeconds(x, view, size);
    const snapped = e.ctrlKey
      ? snapToSessionEndpoints(rawSecs, drag.sessionId, drag.which)
      : Math.round(rawSecs / SNAP_SECS) * SNAP_SECS;
    const otherSessions = deps.getSessions().filter((s) => s.id !== drag!.sessionId);
    const finalSecs = clampCreationEnd(drag.anchorSecs, snapped, otherSessions);
    drag.currentSecs = finalSecs;

    const finalX = secondsToX(finalSecs, view, size);
    const sessionLayer = getSessionLayer();
    if (sessionLayer) {
      const handleEl = sessionLayer.querySelector<HTMLElement>(
        `.session-drag-handle[data-session-id="${CSS.escape(drag.sessionId)}"][data-which="${drag.which}"]`,
      );
      if (handleEl) handleEl.style.left = `${finalX - HANDLE_R}px`;

      const guideEl = sessionLayer.querySelector<HTMLElement>(
        `.session-drag-guide[data-session-id="${CSS.escape(drag.sessionId)}"][data-which="${drag.which}"]`,
      );
      if (guideEl) guideEl.style.left = `${finalX}px`;
    }

    const date = fromAbsoluteSeconds(finalSecs);
    dragLabel.textContent = formatAxisDay(date) + ' ' + formatAxisHour(date);
    dragLabel.style.left = `${finalX}px`;
    dragLabel.style.top = `${axisY + 8}px`;
  }

  async function onMouseUp() {
    if (!active) return;

    if (pendingClickSecs !== null && creationMouseDown) {
      creationMouseDown = false;
      if (creationDragMoved) {
        const finalStart = Math.min(pendingClickSecs, pendingCurrentSecs);
        const finalEnd = Math.max(pendingClickSecs, pendingCurrentSecs);
        clearPendingCreation();
        deps.onCreateSessionPrefill(
          toISOString(fromAbsoluteSeconds(finalStart)),
          toISOString(fromAbsoluteSeconds(finalEnd)),
        );
      }
      // click without drag: anchor stays, wait for second click
      return;
    }

    if (wholeDrag) {
      const { sessionId, originalStart, originalEnd, currentDelta, ghostEl } = wholeDrag;
      wholeDrag = null;
      ghostEl?.remove();
      dragLabel.style.display = 'none';

      if (currentDelta === 0) return;
      const session = deps.getSessions().find((s) => s.id === sessionId);
      if (!session) return;

      const updated: Session = {
        ...session,
        inGameStart: toISOString(fromAbsoluteSeconds(originalStart + currentDelta)),
        inGameEnd: toISOString(fromAbsoluteSeconds(originalEnd + currentDelta)),
      };
      try {
        await deps.onSaveSession(updated);
      } catch (err) {
        console.error('Session whole-drag save failed', err);
      }
      return;
    }

    if (!drag) return;
    const { sessionId, which, originalSecs, currentSecs } = drag;
    drag = null;
    dragLabel.style.display = 'none';

    if (currentSecs === originalSecs) return;
    const session = deps.getSessions().find((s) => s.id === sessionId);
    if (!session) return;

    const updated: Session = { ...session };
    if (which === 'start') {
      updated.inGameStart = toISOString(fromAbsoluteSeconds(currentSecs));
      const endSecs = toAbsoluteSeconds(parseISOString(session.inGameEnd));
      if (currentSecs > endSecs) updated.inGameEnd = updated.inGameStart;
    } else {
      updated.inGameEnd = toISOString(fromAbsoluteSeconds(currentSecs));
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
        renderHandles();
        return;
      }
      if (wholeDrag) {
        wholeDrag.ghostEl?.remove();
        wholeDrag = null;
        dragLabel.style.display = 'none';
        return;
      }
      if (pendingClickSecs !== null) {
        clearPendingCreation();
        return;
      }
      if (document.querySelector('.session-editor-overlay')) return;
      deps.onExitSessionMode();
    }
  }

  function onMouseUpWrapper() {
    void onMouseUp();
  }

  function renderHandles() {
    const sessionLayer = getSessionLayer();
    if (!sessionLayer) return;
    sessionLayer
      .querySelectorAll(
        '.session-drag-handle, .session-drag-guide, .session-ghost-pill, .session-wash',
      )
      .forEach((el) => el.remove());

    if (!active) return;

    const view = deps.getView();
    const size = deps.getViewport();
    const axisY = Math.floor(container.clientHeight * 0.8);
    const railTop = axisY + 46; // center of pill: RAIL_OFFSET(34) + half RAIL_H(12)

    for (const session of deps.getSessions()) {
      if (!session.inGameStart) continue;

      const startSecs = toAbsoluteSeconds(parseISOString(session.inGameStart));
      const endSecs = session.inGameEnd
        ? toAbsoluteSeconds(parseISOString(session.inGameEnd))
        : startSecs;

      const startX = secondsToX(startSecs, view, size);
      const endX = secondsToX(endSecs, view, size);

      if (startX < -HANDLE_ZONE && endX < -HANDLE_ZONE) continue;
      if (startX > size.width + HANDLE_ZONE && endX > size.width + HANDLE_ZONE) continue;

      const clampedLeft = Math.max(startX, -10);
      const clampedRight = Math.min(endX, size.width + 10);
      const pillW = Math.max(clampedRight - clampedLeft, 12);

      const wash = document.createElement('div');
      wash.className = 'session-wash';
      wash.style.left = `${clampedLeft}px`;
      wash.style.width = `${pillW}px`;
      wash.style.setProperty('--wash-color', session.color);
      sessionLayer.appendChild(wash);

      for (const [which, x] of [
        ['start', startX],
        ['end', endX],
      ] as const) {
        const guide = document.createElement('div');
        guide.className = 'session-drag-guide';
        guide.dataset.sessionId = session.id;
        guide.dataset.which = which;
        guide.style.left = `${x}px`;
        guide.style.setProperty('--handle-color', session.color);
        sessionLayer.appendChild(guide);

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
  window.addEventListener('mouseup', onMouseUpWrapper);
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
      if (wholeDrag) {
        wholeDrag.ghostEl?.remove();
        wholeDrag = null;
      }
      dragLabel.style.display = 'none';
      exitChip.style.display = 'none';
      clearPendingCreation();
      const sessionLayer = getSessionLayer();
      sessionLayer
        ?.querySelectorAll(
          '.session-drag-handle, .session-drag-guide, .session-ghost-pill, .session-wash',
        )
        .forEach((el) => el.remove());
    },
    renderHandles,
    isHandleDragging: () => drag !== null || wholeDrag !== null || creationMouseDown,
    isActive: () => active,
    destroy() {
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUpWrapper);
      window.removeEventListener('keydown', onKeyDown);
      active = false;
      clearPendingCreation();
      exitChip.remove();
      dragLabel.remove();
      const sessionLayer = getSessionLayer();
      sessionLayer
        ?.querySelectorAll(
          '.session-drag-handle, .session-drag-guide, .session-ghost-pill, .session-wash',
        )
        .forEach((el) => el.remove());
    },
  };
}
