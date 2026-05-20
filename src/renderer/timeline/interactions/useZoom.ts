import { useEffect, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { zoomAbout, type ViewState, type ViewportSize } from '../math/zoom';

/**
 * Pure zoom math for a single wheel event — exported for testing.
 * `anchorX` is pixel x relative to the left edge of the timeline container.
 */
export function applyWheelZoom(
  anchorX: number,
  deltaY: number,
  view: ViewState,
  size: ViewportSize,
): ViewState {
  const factor = Math.pow(1.001, deltaY);
  return zoomAbout(view, size, anchorX, factor);
}

export function useZoom(
  containerRef: RefObject<HTMLDivElement | null>,
  viewRef: RefObject<ViewState>,
  sizeRef: RefObject<ViewportSize>,
  setView: Dispatch<SetStateAction<ViewState>>,
): void {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      // clientX - rect.left gives position relative to container left edge,
      // which is what zoomAbout expects. offsetX is target-relative and breaks
      // when the wheel fires over a child element (Cards, SessionBands, etc.).
      const rect = container!.getBoundingClientRect();
      const anchorX = e.clientX - rect.left;
      setView(applyWheelZoom(anchorX, e.deltaY, viewRef.current, sizeRef.current));
    }

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
    // containerRef.current, viewRef, sizeRef, and setView are all stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
