import { useEffect, useRef, type RefObject } from 'react';
import {
  createQuickAddZones,
  type QuickAddZonesController,
  type QuickAddZonesDeps,
} from './quick-add-zones';
import '../render/quick-add-zones.css';

export type { QuickAddZonesController };

export function useQuickAddZones(
  containerRef: RefObject<HTMLDivElement | null>,
  deps: QuickAddZonesDeps,
): QuickAddZonesController {
  const innerRef = useRef<QuickAddZonesController>({
    destroy: () => {},
    hide: () => {},
  });

  const depsRef = useRef(deps);
  depsRef.current = deps;

  // Stable delegate — callers hold this reference safely across renders.
  const stable = useRef<QuickAddZonesController>({
    destroy: () => innerRef.current.destroy(),
    hide: () => innerRef.current.hide(),
  }).current;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const controller = createQuickAddZones(container, {
      getView: () => depsRef.current.getView(),
      getViewport: () => depsRef.current.getViewport(),
      isInteractionActive: () => depsRef.current.isInteractionActive(),
      shouldSuppressClick: () => depsRef.current.shouldSuppressClick(),
      onQuickAdd: (secs) => depsRef.current.onQuickAdd(secs),
      onSetNow: (secs) => depsRef.current.onSetNow(secs),
    });
    innerRef.current = controller;

    return () => {
      controller.destroy();
      innerRef.current = { destroy: () => {}, hide: () => {} };
    };
    // containerRef.current is stable for the component lifetime.
    // depsRef is updated each render; the stable wrapper above delegates to depsRef.current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return stable;
}
