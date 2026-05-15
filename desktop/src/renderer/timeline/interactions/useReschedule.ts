import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { createReschedule, type RescheduleController, type RescheduleDeps } from './reschedule';
import type { ViewState, ViewportSize } from '../math/zoom';

export type { RescheduleController };

export function useReschedule(
  containerRef: RefObject<HTMLDivElement | null>,
  dragLabelRef: RefObject<HTMLDivElement | null>,
  viewRef: RefObject<ViewState>,
  sizeRef: RefObject<ViewportSize>,
  getEvents: RescheduleDeps['getEvents'],
  saveReschedule: RescheduleDeps['saveReschedule'],
): RescheduleController {
  const innerRef = useRef<RescheduleController>({
    destroy: () => {},
    isActive: () => false,
    wasActivated: () => false,
  });

  // Keep callbacks current without recreating the controller when campaignPath changes.
  const getEventsRef = useRef(getEvents);
  const saveRescheduleRef = useRef(saveReschedule);
  getEventsRef.current = getEvents;
  saveRescheduleRef.current = saveReschedule;

  // Stable delegate — callers hold this reference safely across renders.
  const stable = useMemo<RescheduleController>(
    () => ({
      destroy: () => innerRef.current.destroy(),
      isActive: () => innerRef.current.isActive(),
      wasActivated: () => innerRef.current.wasActivated(),
    }),
    [],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const reschedule = createReschedule(container, {
      getView: () => viewRef.current,
      getSize: () => sizeRef.current,
      getEvents: () => getEventsRef.current(),
      getDragLabel: () => dragLabelRef.current,
      saveReschedule: (f, s) => saveRescheduleRef.current(f, s),
    });
    innerRef.current = reschedule;

    return () => {
      reschedule.destroy();
      innerRef.current = { destroy: () => {}, isActive: () => false, wasActivated: () => false };
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return stable;
}
