import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  createSessionMode,
  type SessionModeController,
  type SessionModeDeps,
} from './session-mode';
import type { ViewState, ViewportSize } from '../math/zoom';
import type { Session } from '../data/types';

export interface UseSessionModeResult {
  active: boolean;
  toggle: () => void;
  enter: () => void;
  exit: () => void;
  renderHandles: () => void;
  isHandleDragging: () => boolean;
}

const noopController: SessionModeController = {
  enter: () => {},
  exit: () => {},
  renderHandles: () => {},
  isHandleDragging: () => false,
  isActive: () => false,
  destroy: () => {},
};

export function useSessionMode(
  containerRef: RefObject<HTMLDivElement | null>,
  viewRef: RefObject<ViewState>,
  sizeRef: RefObject<ViewportSize>,
  getSessions: () => Session[],
  callbacks: Pick<SessionModeDeps, 'onSaveSession' | 'onCreateSessionPrefill'>,
): UseSessionModeResult {
  const [active, setActive] = useState(false);

  const innerRef = useRef<SessionModeController>(noopController);

  // Keep callbacks current without recreating the controller
  const getSessionsRef = useRef(getSessions);
  const callbacksRef = useRef(callbacks);
  getSessionsRef.current = getSessions;
  callbacksRef.current = callbacks;

  // Stable delegate — callers hold this reference safely across renders
  const stable = useMemo<Pick<UseSessionModeResult, 'renderHandles' | 'isHandleDragging'>>(
    () => ({
      renderHandles: () => innerRef.current.renderHandles(),
      isHandleDragging: () => innerRef.current.isHandleDragging(),
    }),
    [],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ctrl = createSessionMode(container, {
      getSessions: () => getSessionsRef.current(),
      getView: () => viewRef.current,
      getViewport: () => sizeRef.current,
      onSaveSession: (s) => callbacksRef.current.onSaveSession(s),
      onCreateSessionPrefill: (start, end) =>
        callbacksRef.current.onCreateSessionPrefill(start, end),
      onExitSessionMode: () => {
        ctrl.exit();
        setActive(false);
      },
    });
    innerRef.current = ctrl;

    return () => {
      ctrl.destroy();
      innerRef.current = noopController;
    };
    // containerRef.current, viewRef, and sizeRef are stable for the component lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enter = useCallback(() => {
    innerRef.current.enter();
    setActive(true);
  }, []);

  const exit = useCallback(() => {
    innerRef.current.exit();
    setActive(false);
  }, []);

  const toggle = useCallback(() => {
    if (innerRef.current.isActive()) {
      innerRef.current.exit();
      setActive(false);
    } else {
      innerRef.current.enter();
      setActive(true);
    }
  }, []);

  return {
    active,
    toggle,
    enter,
    exit,
    renderHandles: stable.renderHandles,
    isHandleDragging: stable.isHandleDragging,
  };
}
