import { panByPixels, type ViewState } from '../math/zoom';

const DRAG_THRESHOLD_PX = 5;

export interface PanDeps {
  getView(): ViewState;
  setView(next: ViewState): void;
  shouldIgnore?: (e: MouseEvent) => boolean;
  isOtherDragActive?: () => boolean;
}

export interface PanController {
  destroy(): void;
  isDragging(): boolean;
  wasMoved(): boolean;
}

export function createPan(container: HTMLElement, deps: PanDeps): PanController {
  let dragging = false;
  let dragStartX = 0;
  let dragMoved = false;
  let lastX = 0;
  let preDragCursor = '';

  function onMouseDown(e: MouseEvent) {
    // Always reset the moved flag on a new gesture, even if pan doesn't claim it.
    dragMoved = false;
    if (e.button !== 0) return;
    if (deps.shouldIgnore?.(e)) return;
    if (deps.isOtherDragActive?.()) return;
    dragging = true;
    dragStartX = e.clientX;
    lastX = e.clientX;
    preDragCursor = container.style.cursor;
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
    container.style.cursor = preDragCursor;
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
