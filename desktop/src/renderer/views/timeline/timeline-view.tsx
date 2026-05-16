import { useCallback, useEffect, useRef, useState } from 'react';
import { timelinePort, ConflictError } from '../../timeline/data/ports';
import type { EventListItem, Palette, Session, State } from '../../timeline/data/types';
import {
  DEFAULT_SECONDS_PER_PIXEL,
  type ViewState,
  type ViewportSize,
} from '../../timeline/math/zoom';
import {
  parseISOString,
  toAbsoluteSeconds,
  fromAbsoluteSeconds,
  toISOString,
} from '../../timeline/calendar/golarian';
import { paletteToCssVars } from '../../timeline/palette';
import { Axis } from '../../timeline/render/axis';
import { Cards } from '../../timeline/render/cards.tsx';
import { NowMarker } from '../../timeline/render/now-marker';
import { SessionBands } from '../../timeline/render/session-bands.tsx';
import { usePan } from '../../timeline/interactions/usePan';
import { useZoom } from '../../timeline/interactions/useZoom';
import { useCardExpansion } from '../../timeline/interactions/useCardExpansion';
import { usePreviewSize } from '../../timeline/interactions/usePreviewSize';
import { useReschedule } from '../../timeline/interactions/useReschedule';
import { useQuickAddZones } from '../../timeline/interactions/useQuickAddZones';
import { useEventEditor } from '../../timeline/event-editor/useEventEditor';
import { EventEditorModal } from '../../timeline/event-editor/EventEditorModal';
import { sessionTagsForSeconds } from '../../timeline/render/session-bands';
import { AdvanceTimePopover } from '../../timeline/render/AdvanceTimePopover';
import { FooterPortal } from '../../components/footer-portal';
import { FooterButton } from '../../components/footer-button';
import { loadSavedViewState, saveViewState } from './view-state-persistence';
import './timeline-view.css';

interface TimelineViewProps {
  campaignPath: string;
  /** Palette loaded at the App level so theming persists across view switches. */
  palette: Palette | null;
}

interface LoadedData {
  gameState: State | null;
  events: EventListItem[];
  sessions: Session[];
}

export function TimelineView({ campaignPath, palette }: TimelineViewProps) {
  const [viewState, setViewState] = useState<ViewState>({
    centerSeconds: 0,
    secondsPerPixel: DEFAULT_SECONDS_PER_PIXEL,
  });
  const [viewportSize, setViewportSize] = useState<ViewportSize>({ width: 0, height: 0 });
  const [loadedData, setLoadedData] = useState<LoadedData>({
    gameState: null,
    events: [],
    sessions: [],
  });
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [advanceTimeAnchor, setAdvanceTimeAnchor] = useState<{ x: number; y: number } | null>(null);

  const isInitialized = useRef(false);
  const resizingRef = useRef(false);
  const handleResizeDragChange = useCallback((active: boolean) => {
    resizingRef.current = active;
  }, []);

  const viewportRef = useRef<HTMLDivElement>(null);
  const dragLabelRef = useRef<HTMLDivElement>(null);

  const viewRef = useRef<ViewState>(viewState);
  const sizeRef = useRef<ViewportSize>(viewportSize);
  viewRef.current = viewState;
  sizeRef.current = viewportSize;

  const eventsRef = useRef<EventListItem[]>(loadedData.events);
  eventsRef.current = loadedData.events;

  const sessionsRef = useRef<Session[]>(loadedData.sessions);
  sessionsRef.current = loadedData.sessions;

  const gameStateRef = useRef<State | null>(null);
  gameStateRef.current = loadedData.gameState;

  // collapseRef breaks the circular dep: refreshEvents→collapse→useCardExpansion→pan→reschedule
  const collapseRef = useRef<() => void>(() => {});

  const refreshEvents = useCallback(async () => {
    try {
      const events = await timelinePort.listEvents(campaignPath);
      setLoadedData((d) => ({ ...d, events }));
      collapseRef.current();
    } catch (err) {
      console.error('[TimelineView] failed to refresh events', err);
    }
  }, [campaignPath]);

  const saveReschedule = useCallback(
    async (filename: string, newSeconds: number) => {
      try {
        const { event, lastModified } = await timelinePort.getEvent(campaignPath, filename);
        const newDate = toISOString(fromAbsoluteSeconds(newSeconds));
        const nonSeshTags = (event.tags ?? []).filter((t) => !t.startsWith('sesh:'));
        const newSeshTags = sessionTagsForSeconds(newSeconds, sessionsRef.current);
        const updatedTags = [...nonSeshTags, ...newSeshTags];
        await timelinePort.updateEvent(
          campaignPath,
          filename,
          {
            title: event.title,
            date: newDate,
            ...(updatedTags.length > 0 ? { tags: updatedTags } : {}),
            ...(event.color ? { color: event.color } : {}),
            ...(event.status ? { status: event.status } : {}),
          },
          event.body,
          lastModified,
        );
        await refreshEvents();
      } catch (err) {
        console.error('[saveReschedule] failed', err);
        const msg =
          err instanceof ConflictError
            ? `"${filename}" was modified on disk — reschedule reverted.`
            : 'Reschedule failed. Please try again.';
        setTimelineError(msg);
        setTimeout(() => setTimelineError(null), 4000);
        // Rethrow so the reschedule module immediately reverts the card's DOM position.
        throw err;
      }
    },
    [campaignPath, refreshEvents],
  );

  const reschedule = useReschedule(
    viewportRef,
    dragLabelRef,
    viewRef,
    sizeRef,
    () => eventsRef.current,
    saveReschedule,
  );

  const pan = usePan(viewportRef, viewRef, setViewState, {
    shouldIgnore: useCallback(
      (e: MouseEvent) => e.shiftKey && !!(e.target as HTMLElement).closest('.event-card'),
      [],
    ),
    isOtherDragActive: () => resizingRef.current || reschedule.isActive(),
  });
  useZoom(viewportRef, viewRef, sizeRef, setViewState);

  const [previewSize, savePreviewSize] = usePreviewSize();
  const { expansion, handleCardClick, collapse } = useCardExpansion(campaignPath, pan, () =>
    reschedule.wasActivated(),
  );
  // Keep the ref in sync so refreshEvents always calls the current collapse.
  collapseRef.current = collapse;

  const editor = useEventEditor(campaignPath, refreshEvents);

  useQuickAddZones(viewportRef, {
    getView: () => viewRef.current,
    getViewport: () => sizeRef.current,
    isInteractionActive: () => pan.isDragging() || reschedule.isActive(),
    shouldSuppressClick: () => pan.wasMoved() || reschedule.wasActivated(),
    onQuickAdd: (seconds) => {
      editor.openCreate(toISOString(fromAbsoluteSeconds(seconds)));
    },
    onSetNow: async (seconds) => {
      const current = gameStateRef.current;
      if (!current) return;
      const next: State = { ...current, in_game_now: toISOString(fromAbsoluteSeconds(seconds)) };
      await timelinePort.putState(campaignPath, next);
      setLoadedData((d) => ({ ...d, gameState: next }));
    },
  });

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { contentRect } = entries[0];
      setViewportSize({ width: contentRect.width, height: contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Load campaign data. Defined before the persist effect so React runs this
  // first when campaignPath changes, resetting isInitialized before persist fires.
  useEffect(() => {
    isInitialized.current = false;
    let cancelled = false;
    Promise.all([
      timelinePort.getState(campaignPath),
      timelinePort.listEvents(campaignPath),
      timelinePort.getSessions(campaignPath),
    ])
      .then(([gameState, events, sessions]) => {
        if (cancelled) return;
        setLoadedData({ gameState, events, sessions });

        // Restore saved view state, or default to centering on in-game now.
        const saved = loadSavedViewState(campaignPath);
        if (saved) {
          setViewState(saved);
        } else {
          const fallback = gameState.in_game_now || gameState.campaign_start;
          const nowSeconds = fallback ? toAbsoluteSeconds(parseISOString(fallback)) : 0;
          setViewState({ centerSeconds: nowSeconds, secondsPerPixel: DEFAULT_SECONDS_PER_PIXEL });
        }
        isInitialized.current = true;
      })
      .catch((err) => console.error('[TimelineView] failed to load campaign data', err));
    return () => {
      cancelled = true;
    };
  }, [campaignPath]);

  // Persist view state to localStorage on every change (debounced).
  // Guard: only runs after initial data load to avoid overwriting saved state.
  const persistDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!isInitialized.current) return;
    if (persistDebounceRef.current) clearTimeout(persistDebounceRef.current);
    persistDebounceRef.current = setTimeout(() => {
      saveViewState(campaignPath, viewState);
    }, 300);
    return () => {
      if (persistDebounceRef.current) clearTimeout(persistDebounceRef.current);
    };
  }, [campaignPath, viewState]);

  const handleAdvanceTimeSave = useCallback(
    async (newNow: string) => {
      const current = gameStateRef.current;
      if (!current) return;
      const next: State = { ...current, in_game_now: newNow };
      try {
        await timelinePort.putState(campaignPath, next);
        setLoadedData((d) => ({ ...d, gameState: next }));
      } catch (err) {
        console.error('[handleAdvanceTimeSave] failed', err);
        setTimelineError('Failed to advance time. Please try again.');
        setTimeout(() => setTimelineError(null), 4000);
        throw err;
      }
    },
    [campaignPath],
  );

  const handleJumpToNow = useCallback(() => {
    const current = gameStateRef.current;
    if (!current) return;
    const nowSeconds = toAbsoluteSeconds(parseISOString(current.in_game_now));
    setViewState((v) => ({ ...v, centerSeconds: nowSeconds }));
  }, []);

  const bgColor = palette?.theme.background ?? '#09090b';
  const inGameNow = loadedData.gameState?.in_game_now || null;
  const inGameNowSeconds = inGameNow ? toAbsoluteSeconds(parseISOString(inGameNow)) : Infinity;

  return (
    <>
      <div
        ref={viewportRef}
        data-timeline-viewport
        data-width={viewportSize.width}
        data-height={viewportSize.height}
        data-center={viewState.centerSeconds}
        data-scale={viewState.secondsPerPixel}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          backgroundColor: bgColor,
          overflow: 'hidden',
          cursor: 'grab',
          userSelect: 'none',
          ...(palette ? paletteToCssVars(palette) : {}),
        }}
      >
        {palette && <Axis view={viewState} size={viewportSize} />}
        {palette && (
          <SessionBands
            sessions={loadedData.sessions}
            events={loadedData.events}
            view={viewState}
            size={viewportSize}
          />
        )}
        {palette && (
          <Cards
            events={loadedData.events}
            view={viewState}
            size={viewportSize}
            palette={palette}
            inGameNowSeconds={inGameNowSeconds}
            expansion={expansion}
            previewSize={previewSize}
            onCardClick={handleCardClick}
            onPreviewSizeChange={savePreviewSize}
            onResizeDragChange={handleResizeDragChange}
            onEditClick={editor.openEdit}
            onDeleteClick={editor.requestDeleteFromCard}
          />
        )}
        {palette && inGameNow && (
          <NowMarker
            view={viewState}
            size={viewportSize}
            inGameNow={inGameNow}
            inGameNowSeconds={inGameNowSeconds}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setAdvanceTimeAnchor({ x: r.left, y: r.top });
            }}
          />
        )}

        {/* Drag-to-reschedule floating time label */}
        <div ref={dragLabelRef} className="reschedule-drag-label" style={{ display: 'none' }} />

        {/* Error toast (reschedule failures, advance-time failures) */}
        {timelineError && <div className="timeline-error-toast">{timelineError}</div>}

        {/* Card-delete conflict overlay (inline modal) */}
        {editor.cardDeleteConflict && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.65)',
              zIndex: 1001,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                background: 'var(--theme-surface, #1e1e1a)',
                border: '1px solid var(--theme-border-strong, #5a4530)',
                borderRadius: 4,
                padding: '20px 24px',
                maxWidth: 400,
                textAlign: 'center',
              }}
            >
              <p
                style={{
                  margin: '0 0 16px',
                  color: 'var(--theme-text-primary, #d8d0b8)',
                  fontSize: 14,
                  lineHeight: 1.5,
                }}
              >
                &ldquo;{editor.cardDeleteConflict.title || editor.cardDeleteConflict.filename}
                &rdquo; changed on disk since the events list was loaded. Delete the current version
                anyway?
              </p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <button
                  className="event-editor-btn"
                  onClick={() => void editor.resolveCardDeleteConflict('cancel')}
                >
                  Cancel
                </button>
                <button
                  className="event-editor-btn event-editor-btn--danger"
                  onClick={() => void editor.resolveCardDeleteConflict('overwrite')}
                >
                  Delete anyway
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Advance-time popover — rendered outside viewport via portal */}
      {advanceTimeAnchor && inGameNow && (
        <AdvanceTimePopover
          anchor={advanceTimeAnchor}
          currentNow={inGameNow}
          onSave={handleAdvanceTimeSave}
          onClose={() => setAdvanceTimeAnchor(null)}
        />
      )}

      {/* Event editor modal — rendered outside viewport to avoid pan/zoom transform */}
      {editor.editorMode && (
        <EventEditorModal
          key={editor.editorMode.kind === 'edit' ? editor.editorMode.filename : 'new'}
          campaignPath={campaignPath}
          mode={editor.editorMode}
          onClose={editor.closeEditor}
          onSaved={editor.handleSaved}
          onAutosaved={editor.handleAutosaved}
          onDeleted={editor.handleDeleted}
        />
      )}

      {/* Footer buttons — center slot, hidden while event editor is open */}
      {!editor.editorMode && (
        <FooterPortal slot="center">
          <FooterButton
            variant="primary"
            onClick={() => editor.openCreate()}
            title="Create a new event"
          >
            + Event
          </FooterButton>
          <FooterButton onClick={handleJumpToNow} title="Jump to in-game now">
            Now
          </FooterButton>
        </FooterPortal>
      )}
    </>
  );
}
