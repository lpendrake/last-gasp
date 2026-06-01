import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { timelinePort, ConflictError, FilenameConflictError } from '../../timeline/data/ports';
import type { EventListItem, Session, State } from '../../timeline/data/types';
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
import { ThemeProvider } from '../../theme';
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
import { useTimelineKeyboard } from '../../timeline/interactions/useTimelineKeyboard';
import { useEventEditor } from '../../timeline/event-editor/useEventEditor';
import { deriveFilename } from '../../timeline/event-editor/domain';
import { EventEditorModal } from '../../timeline/event-editor/EventEditorModal';
import { NewEventModal } from '../../timeline/event-editor/new-event-modal';
import { sessionTagsForSeconds } from '../../timeline/render/session-bands';
import { AdvanceTimePopover } from '../../timeline/render/AdvanceTimePopover';
import {
  applySessionUpdate,
  applySessionSave,
  applySessionDelete,
} from '../../timeline/interactions/session-transforms';
import {
  computeEventsNeedingSeshTagUpdate,
  mergeSeshTags,
} from '../../timeline/interactions/session-tag-sync';
import { useSessionMode } from '../../timeline/session-editor/use-session-mode';
import { useSessionEditor } from '../../timeline/session-editor/use-session-editor';
import { SessionEditorModal } from '../../timeline/session-editor/session-editor-modal';
import { FooterPortal } from '../../components/footer-portal';
import { FooterButton } from '../../components/footer-button';
import { loadSavedViewState, saveViewState } from './view-state-persistence';
import { useFilterState } from '../../timeline/filter/use-filter-state';
import { applyFilters } from '../../timeline/filter/logic';
import { isSessionTag } from '../../../shared/entity-tags';
import { FilterPanel } from '../../timeline/filter/filter-panel';
import { EventContextMenu } from '../../timeline/components/event-context-menu';
import { LabelOverrideEditor } from '../../shared/components/label-override-editor';
import '../../timeline/session-editor/session-mode.css';
import './timeline-view.css';

interface TimelineViewProps {
  campaignPath: string;
  /** When set, the timeline pans to this event filename and flashes the card. */
  pendingJumpFilename?: string | null;
  /** Called after the jump has been applied so the parent can clear the pending value. */
  onJumpHandled?: () => void;
  /** Navigate to a note by wiki-link ID (Ctrl+click from card expansions / event editor). */
  onOpenById?: (id: string) => void;
  /** Entity id → display label map for resolving [[id]] wiki links. */
  entityLabelMap: Map<string, string>;
  /** Entity id → tag label map for resolving id:XXXX tags to human-readable names. */
  entityTagLabelMap: Map<string, string>;
}

interface LoadedData {
  gameState: State | null;
  events: EventListItem[];
  sessions: Session[];
}

export function TimelineView({
  campaignPath,
  pendingJumpFilename,
  onJumpHandled,
  onOpenById,
  entityLabelMap,
  entityTagLabelMap,
}: TimelineViewProps) {
  const weekdays = ThemeProvider.get().timeline.days;
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
  const [contextMenuTarget, setContextMenuTarget] = useState<{
    item: EventListItem;
    x: number;
    y: number;
  } | null>(null);
  const [labelEditorTarget, setLabelEditorTarget] = useState<{
    entityId: string;
    target: 'tagLabel' | 'linkLabel';
  } | null>(null);

  const {
    filterState,
    activeCount,
    addFilter,
    removeFilter,
    toggleFilter,
    pinFilter,
    updateFilter,
  } = useFilterState(campaignPath);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

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

  // ---- Session persistence ----

  const applySessionTagsToEvent = useCallback(
    async (filename: string, sessions: Session[]): Promise<boolean> => {
      const ev = eventsRef.current.find((e) => e.filename === filename);
      if (!ev) return false;
      let secs: number;
      try {
        secs = toAbsoluteSeconds(parseISOString(ev.date));
      } catch {
        return false;
      }
      const computed = sessionTagsForSeconds(secs, sessions);
      const updatedTags = mergeSeshTags(ev.tags, computed);
      const { event: full, lastModified } = await timelinePort.getEvent(campaignPath, filename);
      await timelinePort.updateEvent(
        campaignPath,
        filename,
        {
          title: full.title,
          date: full.date,
          ...(updatedTags.length > 0 ? { tags: updatedTags } : {}),
          ...(full.color ? { color: full.color } : {}),
          ...(full.status ? { status: full.status } : {}),
        },
        full.body,
        lastModified,
      );
      return true;
    },
    [campaignPath],
  );

  const applySessionTagsToAllEvents = useCallback(
    async (sessions: Session[]): Promise<void> => {
      const toUpdate = computeEventsNeedingSeshTagUpdate(eventsRef.current, sessions);
      if (toUpdate.length === 0) return;
      for (const filename of toUpdate) {
        await applySessionTagsToEvent(filename, sessions);
      }
      await refreshEvents();
    },
    [applySessionTagsToEvent, refreshEvents],
  );

  const saveSessionUpdate = useCallback(
    async (updated: Session) => {
      const newSessions = applySessionUpdate(sessionsRef.current, updated);
      await timelinePort.putSessions(campaignPath, newSessions);
      setLoadedData((d) => ({ ...d, sessions: newSessions }));
      await applySessionTagsToAllEvents(newSessions);
    },
    [campaignPath, applySessionTagsToAllEvents],
  );

  const handleSessionSave = useCallback(
    async (saved: Session) => {
      const newSessions = applySessionSave(sessionsRef.current, saved);
      await timelinePort.putSessions(campaignPath, newSessions);
      setLoadedData((d) => ({ ...d, sessions: newSessions }));
      await applySessionTagsToAllEvents(newSessions);
    },
    [campaignPath, applySessionTagsToAllEvents],
  );

  const handleSessionDelete = useCallback(
    async (sessionId: string) => {
      const newSessions = applySessionDelete(sessionsRef.current, sessionId);
      await timelinePort.putSessions(campaignPath, newSessions);
      setLoadedData((d) => ({ ...d, sessions: newSessions }));
      await applySessionTagsToAllEvents(newSessions);
    },
    [campaignPath, applySessionTagsToAllEvents],
  );

  // ---- Session editor (modal state) ----

  const sessionEditor = useSessionEditor();

  // ---- Session mode (interaction controller) ----

  // Stable ref for use in pan's shouldIgnore callback
  const sessionModeActiveRef = useRef(false);

  const sessionMode = useSessionMode(viewportRef, viewRef, sizeRef, () => sessionsRef.current, {
    onSaveSession: saveSessionUpdate,
    onCreateSessionPrefill: (inGameStart, inGameEnd) => {
      sessionEditor.openCreate({ inGameStart, inGameEnd });
    },
  });

  // Keep stable ref in sync with React state
  sessionModeActiveRef.current = sessionMode.active;

  // Re-render handles synchronously after each DOM commit so handles stay
  // glued to their session endpoints during pan/zoom (useLayoutEffect fires
  // before the browser paints, matching legacy's synchronous renderTimeline).
  const renderSessionHandles = sessionMode.renderHandles;
  const sessionModeActive = sessionMode.active;
  useLayoutEffect(() => {
    if (!sessionModeActive) return;
    renderSessionHandles();
  }, [sessionModeActive, viewState, viewportSize, loadedData.sessions, renderSessionHandles]);

  // ---- Reschedule / pan ----

  const saveReschedule = useCallback(
    async (filename: string, newSeconds: number) => {
      try {
        const { event, lastModified } = await timelinePort.getEvent(campaignPath, filename);
        const newDate = toISOString(fromAbsoluteSeconds(newSeconds));
        const nonSeshTags = (event.tags ?? []).filter((t) => !isSessionTag(t));
        const newSeshTags = sessionTagsForSeconds(newSeconds, sessionsRef.current);
        const updatedTags = [...nonSeshTags, ...newSeshTags];
        const desiredFilename = deriveFilename({
          title: event.title,
          date: newDate,
          body: event.body,
          tagsText: '',
          color: '',
          tagLabelOverride: '',
          linkLabelOverride: '',
          systemTags: [],
        });
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
          desiredFilename,
        );
        await refreshEvents();
      } catch (err) {
        console.error('[saveReschedule] failed', err);
        const msg =
          err instanceof FilenameConflictError
            ? err.message
            : err instanceof ConflictError
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

  const handleRemoveTag = useCallback(
    async (filename: string, tag: string) => {
      const { event, lastModified } = await timelinePort.getEvent(campaignPath, filename);
      const newTags = (event.tags ?? []).filter((t) => t !== tag);
      await timelinePort.updateEvent(
        campaignPath,
        filename,
        {
          title: event.title,
          date: event.date,
          ...(newTags.length > 0 ? { tags: newTags } : {}),
          ...(event.color ? { color: event.color } : {}),
          ...(event.status ? { status: event.status } : {}),
        },
        event.body,
        lastModified,
      );
      setLoadedData((d) => ({
        ...d,
        events: d.events.map((e) =>
          e.filename === filename ? { ...e, tags: newTags.length > 0 ? newTags : undefined } : e,
        ),
      }));
    },
    [campaignPath],
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
      (e: MouseEvent) =>
        (e.shiftKey && !!(e.target as HTMLElement).closest('.event-card')) ||
        (sessionModeActiveRef.current &&
          !!(e.target as HTMLElement).closest('.session-drag-handle, .session-pill')),
      [],
    ),
    isOtherDragActive: () =>
      resizingRef.current || reschedule.isActive() || sessionMode.isHandleDragging(),
  });
  useZoom(viewportRef, viewRef, sizeRef, setViewState);

  const [previewSize, savePreviewSize] = usePreviewSize();
  const { expansion, handleCardClick, collapse } = useCardExpansion(campaignPath, pan, () =>
    reschedule.wasActivated(),
  );
  // Keep the ref in sync so refreshEvents always calls the current collapse.
  collapseRef.current = collapse;

  const editor = useEventEditor(campaignPath, refreshEvents);

  const quickAdd = useQuickAddZones(viewportRef, {
    getView: () => viewRef.current,
    getViewport: () => sizeRef.current,
    isInteractionActive: () =>
      pan.isDragging() || reschedule.isActive() || sessionModeActiveRef.current,
    shouldSuppressClick: () =>
      pan.wasMoved() || reschedule.wasActivated() || sessionModeActiveRef.current,
    onQuickAdd: (seconds) => {
      editor.openNewEventPrompt(toISOString(fromAbsoluteSeconds(seconds)));
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

  // Pan to a specific event and flash its card when triggered from the search overlay.
  useEffect(() => {
    if (!pendingJumpFilename || !loadedData.events.length) return;
    const ev = loadedData.events.find((e) => e.filename === pendingJumpFilename);
    if (!ev) return;
    const seconds = toAbsoluteSeconds(parseISOString(ev.date));
    setViewState((v) => ({ ...v, centerSeconds: seconds }));
    onJumpHandled?.();
    const filename = pendingJumpFilename;
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(
        `.event-card[data-filename="${CSS.escape(filename)}"]`,
      );
      if (el) {
        el.classList.add('is-flashing');
        setTimeout(() => el.classList.remove('is-flashing'), 1200);
      }
    });
    // Run when the filename changes or when event data first loads (for the case where
    // the jump is requested before events are fetched).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingJumpFilename, loadedData.events.length]);

  const handleCardContextMenu = useCallback((item: EventListItem, x: number, y: number) => {
    if (sessionModeActiveRef.current) return;
    setContextMenuTarget({ item, x, y });
  }, []);

  const filteredEvents = useMemo(
    () => applyFilters(loadedData.events, filterState, loadedData.sessions),
    [loadedData.events, filterState, loadedData.sessions],
  );

  const filteredEventsRef = useRef(filteredEvents);
  filteredEventsRef.current = filteredEvents;

  useTimelineKeyboard({
    isBlocked: () => !!(editor.editorMode || editor.newEventPrompt),
    getView: () => viewRef.current,
    getSize: () => sizeRef.current,
    setView: setViewState,
    getEvents: () => filteredEventsRef.current,
    getFocusedFilename: () => expansion?.filename ?? null,
    expandEvent: handleCardClick,
    collapse,
    quickAddShowAt: quickAdd.keyboardShowAt,
    quickAddHide: quickAdd.keyboardHide,
    createEventAt: (seconds) =>
      editor.openNewEventPrompt(toISOString(fromAbsoluteSeconds(seconds))),
  });

  const inGameNow = loadedData.gameState?.in_game_now || null;
  const inGameNowSeconds = inGameNow ? toAbsoluteSeconds(parseISOString(inGameNow)) : Infinity;

  const anyModalOpen = !!(
    editor.editorMode ||
    editor.newEventPrompt ||
    sessionEditor.mode ||
    labelEditorTarget
  );

  return (
    <>
      <div
        ref={viewportRef}
        data-timeline-viewport
        data-width={viewportSize.width}
        data-height={viewportSize.height}
        data-center={viewState.centerSeconds}
        data-scale={viewState.secondsPerPixel}
        className={sessionMode.active ? 'is-session-mode' : undefined}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          backgroundColor: 'var(--theme-background)',
          overflow: 'hidden',
          cursor: 'grab',
          userSelect: 'none',
        }}
      >
        <Axis view={viewState} size={viewportSize} weekdays={weekdays} />
        <SessionBands
          sessions={loadedData.sessions}
          events={filteredEvents}
          view={viewState}
          size={viewportSize}
          sessionMode={sessionMode.active}
          onPillClick={(sessionId) => {
            if (!sessionMode.isHandleDragging()) sessionEditor.openEdit(sessionId);
          }}
        />
        <Cards
          events={filteredEvents}
          view={viewState}
          size={viewportSize}
          weekdays={weekdays}
          inGameNowSeconds={inGameNowSeconds}
          expansion={expansion}
          previewSize={previewSize}
          onCardClick={sessionModeActiveRef.current ? undefined : handleCardClick}
          onPreviewSizeChange={savePreviewSize}
          onResizeDragChange={sessionModeActiveRef.current ? undefined : handleResizeDragChange}
          onEditClick={sessionModeActiveRef.current ? undefined : editor.openEdit}
          onDeleteClick={sessionModeActiveRef.current ? undefined : editor.requestDeleteFromCard}
          onContextMenu={sessionModeActiveRef.current ? undefined : handleCardContextMenu}
          onOpenById={onOpenById}
          onRemoveTag={sessionModeActiveRef.current ? undefined : handleRemoveTag}
          entityLabelMap={entityLabelMap}
          entityTagLabelMap={entityTagLabelMap}
        />
        {inGameNow && (
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
                background: 'var(--theme-surface)',
                border: '1px solid var(--theme-border-strong)',
                borderRadius: 4,
                padding: '20px 24px',
                maxWidth: 400,
                textAlign: 'center',
              }}
            >
              <p
                style={{
                  margin: '0 0 16px',
                  color: 'var(--theme-text-primary)',
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

      {/* Filter panel — rendered above the footer when open, hidden while modals are open */}
      {filterPanelOpen && !anyModalOpen && (
        <FilterPanel
          filterState={filterState}
          events={loadedData.events}
          sessions={loadedData.sessions}
          inGameNow={inGameNow ?? ''}
          entityTagLabelMap={entityTagLabelMap}
          onAdd={addFilter}
          onRemove={removeFilter}
          onToggle={toggleFilter}
          onPin={pinFilter}
          onUpdate={updateFilter}
        />
      )}

      {/* Advance-time popover — rendered outside viewport via portal */}
      {advanceTimeAnchor && inGameNow && (
        <AdvanceTimePopover
          anchor={advanceTimeAnchor}
          currentNow={inGameNow}
          onSave={handleAdvanceTimeSave}
          onClose={() => setAdvanceTimeAnchor(null)}
        />
      )}

      {/* Event context menu */}
      {contextMenuTarget && (
        <EventContextMenu
          item={contextMenuTarget.item}
          x={contextMenuTarget.x}
          y={contextMenuTarget.y}
          onClose={() => setContextMenuTarget(null)}
          onEdit={(filename) => editor.openEdit(filename)}
          onDelete={(item) => editor.requestDeleteFromCard(item)}
          onEditTagLabel={(entityId) => setLabelEditorTarget({ entityId, target: 'tagLabel' })}
          onEditLinkLabel={(entityId) => setLabelEditorTarget({ entityId, target: 'linkLabel' })}
        />
      )}

      {/* New event title prompt */}
      {editor.newEventPrompt && (
        <NewEventModal
          error={editor.newEventPrompt.error}
          onCreate={(title) => {
            void editor.createOnly(title);
          }}
          onCreateAndOpen={(title) => {
            void editor.createAndOpen(title);
          }}
          onCancel={editor.cancelNewEventPrompt}
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
          onOpenById={onOpenById}
        />
      )}

      {/* Session editor modal — rendered outside viewport */}
      {sessionEditor.mode && (
        <SessionEditorModal
          mode={sessionEditor.mode}
          sessions={loadedData.sessions}
          onClose={sessionEditor.close}
          onSave={async (saved) => {
            await handleSessionSave(saved);
            sessionEditor.close();
          }}
          onDelete={async (sessionId) => {
            await handleSessionDelete(sessionId);
            sessionEditor.close();
          }}
        />
      )}

      {/* Label override editor modal */}
      {labelEditorTarget && (
        <LabelOverrideEditor
          entityId={labelEditorTarget.entityId}
          target={labelEditorTarget.target}
          onClose={() => setLabelEditorTarget(null)}
        />
      )}

      {/* Footer buttons — hidden while any modal is open */}
      {!anyModalOpen && (
        <>
          <FooterPortal slot="far-left">
            <FooterButton
              variant={filterPanelOpen ? 'active' : 'default'}
              onClick={() => setFilterPanelOpen((open) => !open)}
              title="Filter events"
            >
              {activeCount > 0 ? `Filter (${activeCount})` : 'Filter'}
            </FooterButton>
          </FooterPortal>
          <FooterPortal slot="left">
            <FooterButton
              variant={sessionMode.active ? 'active' : 'default'}
              onClick={() => {
                if (!sessionMode.active) collapse();
                sessionMode.toggle();
              }}
              title="Manage sessions"
            >
              {sessionMode.active ? 'Session X' : 'Session'}
            </FooterButton>
          </FooterPortal>
          <FooterPortal slot="center">
            <FooterButton
              variant="primary"
              onClick={() =>
                editor.openNewEventPrompt(
                  toISOString(fromAbsoluteSeconds(viewRef.current.centerSeconds)),
                )
              }
              title="Create a new event"
            >
              + Event
            </FooterButton>
          </FooterPortal>
          <FooterPortal slot="right">
            <FooterButton onClick={handleJumpToNow} title="Jump to in-game now">
              Now
            </FooterButton>
          </FooterPortal>
        </>
      )}
    </>
  );
}
