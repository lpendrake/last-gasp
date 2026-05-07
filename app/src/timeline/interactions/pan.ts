import { panByPixels, type ViewState } from './zoom.ts';

const DRAG_THRESHOLD_PX = 5;

export interface PanDeps {
  getView(): ViewState;
  setView(next: ViewState): void;
  /** Pan must yield to interactions inside modals/overlays. */
  shouldIgnore(target: EventTarget | null): boolean;
  /** Pan defers to a higher-priority interaction (e.g. reschedule) that
   * claimed the same mousedown. */
  isOtherDragActive(): boolean;
}

export interface PanController {
  destroy(): void;
  /** True while a drag is in progress (mousedown happened, mouseup hasn't). */
  isDragging(): boolean;
  /** True if the most recent gesture moved past the threshold. Cleared on
   * the next mousedown. Both click handlers may safely peek. */
  wasMoved(): boolean;
}

export function createPan(container: HTMLElement, deps: PanDeps): PanController {
  let dragging = false;
  let dragStartX = 0;
  let dragMoved = false;
  let lastX = 0;

  function onMouseDown(e: MouseEvent) {
    // Reset for the new gesture. Cleared whether or not pan claims this
    // mousedown — keeps the click-suppression flag fresh per-gesture.
    dragMoved = false;
    if (deps.shouldIgnore(e.target)) return;
    if (deps.isOtherDragActive()) return;
    dragging = true;
    dragStartX = e.clientX;
    lastX = e.clientX;
    container.style.cursor = 'grabbing';
  }

  function onMouseMove(e: MouseEvent) {
    if (!dragging) return;
    if (!dragMoved && Math.abs(e.clientX - dragStartX) >= DRAG_THRESHOLD_PX) {
      dragMoved = true;
    }
    if (!dragMoved) return;
    const delta = e.clientX - lastX;
    lastX = e.clientX;
    deps.setView(panByPixels(deps.getView(), delta));
  }

  function onMouseUp() {
    if (!dragging) return;
    dragging = false;
    container.style.cursor = '';
  }

  container.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);

  return {
    destroy() {
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    },
    isDragging: () => dragging,
    wasMoved: () => dragMoved,
  };
}
