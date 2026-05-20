import { useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { createPan, type PanController, type PanDeps } from './pan';
import type { ViewState } from '../math/zoom';

export type { PanController };

export function usePan(
  containerRef: RefObject<HTMLDivElement | null>,
  viewRef: RefObject<ViewState>,
  setView: Dispatch<SetStateAction<ViewState>>,
  extra?: Pick<PanDeps, 'shouldIgnore' | 'isOtherDragActive'>,
): PanController {
  const innerRef = useRef<PanController>({
    destroy: () => {},
    isDragging: () => false,
    wasMoved: () => false,
  });

  // Stable delegate object — callers can hold this reference safely across renders.
  const stable = useRef<PanController>({
    destroy: () => innerRef.current.destroy(),
    isDragging: () => innerRef.current.isDragging(),
    wasMoved: () => innerRef.current.wasMoved(),
  }).current;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const pan = createPan(container, {
      getView: () => viewRef.current,
      setView,
      shouldIgnore: extra?.shouldIgnore,
      isOtherDragActive: extra?.isOtherDragActive,
    });
    innerRef.current = pan;

    return () => {
      pan.destroy();
      innerRef.current = { destroy: () => {}, isDragging: () => false, wasMoved: () => false };
    };
    // containerRef.current, viewRef, and setView are all stable for the component lifetime.
    // extra callbacks intentionally omitted — callers must provide stable references.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return stable;
}
