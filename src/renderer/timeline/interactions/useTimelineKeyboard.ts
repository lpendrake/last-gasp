import { useEffect, useRef } from 'react';
import type { ViewState, ViewportSize } from '../math/zoom';
import type { EventListItem } from '../data/types';
import { reduceKey, isTypingTarget, type KeyboardMode } from './keyboard-mode';
import { keyboardZoom, keyboardPan } from './keyboard-steps';
import { findAdjacentEvent } from './event-navigation';
import { SNAP_SECS } from './time-increments';

export interface TimelineKeyboardDeps {
  isBlocked(): boolean;
  getView(): ViewState;
  getSize(): ViewportSize;
  setView(updater: (v: ViewState) => ViewState): void;
  getEvents(): EventListItem[];
  getFocusedFilename(): string | null;
  expandEvent(filename: string): void;
  collapse(): void;
  quickAddShowAt(seconds: number): void;
  quickAddHide(): void;
  createEventAt(seconds: number): void;
}

export function useTimelineKeyboard(deps: TimelineKeyboardDeps): void {
  const depsRef = useRef(deps);
  depsRef.current = deps;

  const modeRef = useRef<KeyboardMode>('nav');
  const markerSecsRef = useRef<number | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const d = depsRef.current;

      if (isTypingTarget(e.target) || d.isBlocked()) return;

      const { mode, action } = reduceKey(modeRef.current, { key: e.key, shiftKey: e.shiftKey });
      modeRef.current = mode;

      let handled = false;

      switch (action.type) {
        case 'zoom':
          d.setView((v) => keyboardZoom(v, d.getSize(), action.dir));
          handled = true;
          break;

        case 'pan':
          d.setView((v) => keyboardPan(v, action.dir));
          handled = true;
          break;

        case 'nav-event': {
          const hit = findAdjacentEvent(
            d.getEvents(),
            d.getView().centerSeconds,
            d.getFocusedFilename(),
            action.dir,
          );
          if (hit) {
            d.setView((v) => ({ ...v, centerSeconds: hit.seconds }));
            d.expandEvent(hit.filename);
            handled = true;
          }
          break;
        }

        case 'quickadd-enter': {
          const base = d.getView().centerSeconds;
          const snapped = Math.round(base / SNAP_SECS) * SNAP_SECS;
          markerSecsRef.current = snapped;
          d.setView((v) => ({ ...v, centerSeconds: snapped }));
          d.quickAddShowAt(snapped);
          handled = true;
          break;
        }

        case 'quickadd-move': {
          const next =
            (markerSecsRef.current ?? d.getView().centerSeconds) +
            (action.dir === 'later' ? SNAP_SECS : -SNAP_SECS);
          markerSecsRef.current = next;
          d.setView((v) => ({ ...v, centerSeconds: next }));
          d.quickAddShowAt(next);
          handled = true;
          break;
        }

        case 'quickadd-commit':
          if (markerSecsRef.current != null) {
            d.createEventAt(markerSecsRef.current);
          }
          d.quickAddHide();
          markerSecsRef.current = null;
          handled = true;
          break;

        case 'quickadd-exit':
          d.quickAddHide();
          markerSecsRef.current = null;
          handled = true;
          break;

        case 'focus-cycle': {
          const buttons = Array.from(
            document.querySelectorAll<HTMLElement>(
              '.event-card.is-expanded [data-action="edit"], .event-card.is-expanded [data-action="delete"]',
            ),
          );
          if (buttons.length > 0) {
            const activeIdx = buttons.findIndex((btn) => btn === document.activeElement);
            if (action.dir === 'forward') {
              const nextIdx = activeIdx === -1 ? 0 : (activeIdx + 1) % buttons.length;
              buttons[nextIdx].focus();
            } else {
              const prevIdx =
                activeIdx === -1
                  ? buttons.length - 1
                  : (activeIdx - 1 + buttons.length) % buttons.length;
              buttons[prevIdx].focus();
            }
            handled = true;
          }
          break;
        }

        case 'unfocus':
          d.collapse();
          handled = true;
          break;

        case 'none':
          break;
      }

      if (handled) {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, []);
}
