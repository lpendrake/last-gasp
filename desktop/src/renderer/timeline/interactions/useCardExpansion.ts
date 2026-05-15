import { useState, useEffect, useCallback, useRef } from 'react';
import { timelinePort } from '../data/ports';
import type { PanController } from './usePan';

export interface CardExpansionState {
  filename: string;
  body: string | null; // null = still loading
}

export interface UseCardExpansionResult {
  expansion: CardExpansionState | null;
  handleCardClick: (filename: string) => void;
  collapse: () => void;
}

export function useCardExpansion(
  campaignPath: string,
  pan: PanController,
  suppressClick?: () => boolean,
): UseCardExpansionResult {
  const [expansion, setExpansion] = useState<CardExpansionState | null>(null);

  // Ref stays in sync with state, giving async callbacks a non-stale view
  // without making handleCardClick depend on expansion in its closure.
  const expansionRef = useRef<CardExpansionState | null>(null);
  expansionRef.current = expansion;

  // Ref for suppressClick so handleCardClick doesn't need it in deps.
  const suppressClickRef = useRef(suppressClick);
  suppressClickRef.current = suppressClick;

  const collapse = useCallback(() => {
    expansionRef.current = null;
    setExpansion(null);
  }, []);

  const handleCardClick = useCallback(
    (filename: string) => {
      if (pan.wasMoved() || suppressClickRef.current?.()) return;

      // Toggle off when clicking the already-expanded card (including while loading)
      if (expansionRef.current?.filename === filename) {
        collapse();
        return;
      }

      // Start loading; record intent so the fetch callback can detect staleness
      const next: CardExpansionState = { filename, body: null };
      expansionRef.current = next;
      setExpansion(next);

      timelinePort
        .getEvent(campaignPath, filename)
        .then(({ event }) => {
          // If the user navigated away from this card before the fetch resolved, discard
          if (expansionRef.current?.filename !== filename) return;
          const loaded: CardExpansionState = { filename, body: event.body };
          expansionRef.current = loaded;
          setExpansion(loaded);
        })
        .catch((err) => console.error('[useCardExpansion] failed to load event body', err));
    },
    [campaignPath, pan, collapse],
  );

  // Escape collapses while any card is expanded
  useEffect(() => {
    if (!expansion) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') collapse();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [expansion, collapse]);

  return { expansion, handleCardClick, collapse };
}
