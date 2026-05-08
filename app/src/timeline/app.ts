import { loadPalette } from '../theme.ts';
import { listEvents, getEvent, deleteEvent, updateEvent } from '../data/http/events.http.ts';
import { getState, putState, getTags, getSessions, putSessions } from '../data/http/state.http.ts';
import { ApiError } from '../data/http/client.ts';
import { parseISOString, toAbsoluteSeconds, fromAbsoluteSeconds, toISOString } from '../calendar/golarian.ts';
import { formatNowMarker, formatAxisDay } from '../calendar/format.ts';
import { openAdvanceTimePopover, openSessionManagerPopover } from '../panels/toolbar.ts';
import {
  type ViewState, type ViewportSize,
  DEFAULT_SECONDS_PER_PIXEL, zoomAbout, panByPixels,
} from './interactions/zoom.ts';
import { createPan } from './interactions/pan.ts';
import { createReschedule } from './interactions/reschedule.ts';
import { createQuickAddZones } from './interactions/quick-add-zones.ts';
import { createSessionMode } from './interactions/session-mode.ts';
import { createSessionTooltip } from './interactions/session-tooltip.ts';
import { renderAxis } from './render/axis.ts';
import { layoutCards, renderCards, type CardExpansion } from './render/cards.ts';
import {
  computeSessionBandsFromSessions,
  findSessionConflicts,
  renderSessionRail,
} from './render/session-bands.ts';
import { openCreateEditor, openEditEditor } from '../editor/modal/index.ts';
import { openSessionEditModal } from './session-modal.ts';
import type { FilterState } from '../panels/filters/types.ts';
import { makeInitialFilterState, applyFilters } from '../panels/filters/logic.ts';
import { renderFilterSidebar } from '../panels/filters/sidebar.ts';
import { loadPinnedFilters, savePinnedFilters } from '../panels/filters/persistence.ts';
import { createSearchOverlay } from '../panels/search.ts';
import { initPeek } from '../peek/stack.ts';
import type { EventListItem, TagsRegistry, State, Session } from '../data/types.ts';
import type { DraftBuffer } from '../editor/drafts.ts';
import { normalizeSessions, normalizeSession } from '../data/session-normalize.ts';

interface AppState {
  events: EventListItem[];
  tags: TagsRegistry;
  state: State;
  sessions: Session[];
  inGameNowSeconds: number;
  campaignStart: string;
  inGameNow: string;
  view: ViewState;
  filter: FilterState;
  sessionMode: boolean;
}

/** Operations the timeline exposes to the rest of the bootstrap. */
export interface TimelineApp {
  zoomBy(factor: number): void;
  panBy(pixels: number): void;
  jumpToNow(): void;
  collapseExpansion(): boolean;
  exitSessionMode(): boolean;
  openSearch(): void;
  isSearchOpen(): boolean;
}

/** Build the timeline view: load data, render, attach all interactions
 * and toolbar handlers. The DOM scaffold from `mountAppShell` must
 * already be in place. */
export async function createTimelineApp(): Promise<TimelineApp> {
  const [, events, state, tags, rawSessions] = await Promise.all([
    loadPalette(),
    listEvents(),
    getState(),
    getTags(),
    getSessions(),
  ]);

  const inGameNow = parseISOString(state.in_game_now);
  const inGameNowSeconds = toAbsoluteSeconds(inGameNow);

  const initialFilter = makeInitialFilterState();
  for (const f of loadPinnedFilters()) {
    initialFilter.filters.push({ ...f, enabled: false });
  }

  const sessions = normalizeSessions(rawSessions as unknown[]);

  const appState: AppState = {
    events,
    tags,
    state,
    sessions,
    inGameNowSeconds,
    campaignStart: state.campaign_start,
    inGameNow: state.in_game_now,
    view: {
      centerSeconds: inGameNowSeconds,
      secondsPerPixel: DEFAULT_SECONDS_PER_PIXEL,
    },
    filter: initialFilter,
    sessionMode: false,
  };

  const container = document.getElementById('timeline') as HTMLDivElement;
  const filterBar = document.getElementById('filter-bar') as HTMLDivElement;
  const filterCount = document.getElementById('filter-count') as HTMLSpanElement;
  const sessionLayer = document.getElementById('session-layer') as HTMLDivElement;
  const axisLayer = document.getElementById('axis-layer') as HTMLDivElement;
  const cardsLayer = document.getElementById('cards-layer') as HTMLDivElement;

  function viewportSize(): ViewportSize {
    return { width: container.clientWidth, height: container.clientHeight };
  }

  function visibleEvents(): EventListItem[] {
    return applyFilters(appState.events, appState.filter);
  }

  let cardExpansion: CardExpansion | undefined;

  function renderTimeline() {
    const size = viewportSize();
    const filtered = visibleEvents();
    const sessionBands = computeSessionBandsFromSessions(appState.sessions, filtered);
    const sessionConflicts = findSessionConflicts(sessionBands, filtered);
    const overlappingIds = new Set(sessionConflicts.map(c => c.sessionId));
    void overlappingIds; // available for future conflict indicators

    renderSessionRail(sessionLayer, sessionBands, appState.sessions, appState.view, size, appState.sessionMode);
    renderAxis(axisLayer, appState.view, size);

    const laidOut = layoutCards(filtered, appState.view, size, appState.inGameNowSeconds);
    renderCards(cardsLayer, laidOut, size, cardExpansion);

    cardsLayer.classList.toggle('is-session-mode', appState.sessionMode);

    const existing = container.querySelector('.now-marker');
    if (existing) existing.remove();
    const nowX = (appState.inGameNowSeconds - appState.view.centerSeconds) / appState.view.secondsPerPixel + size.width / 2;
    if (nowX >= 0 && nowX <= size.width) {
      const axisY = Math.floor(size.height * 0.8);
      const nowDate = parseISOString(appState.inGameNow);
      const [dayMonth, year, time] = formatNowMarker(nowDate);
      const marker = document.createElement('div');
      marker.className = 'now-marker';
      marker.style.left = `${nowX}px`;
      const labels = document.createElement('div');
      labels.className = 'now-marker-labels';
      labels.style.top = `${axisY + 66}px`;
      labels.innerHTML = `
        <div class="now-marker-date">${dayMonth}</div>
        <div class="now-marker-year">${year}</div>
        ${time ? `<div class="now-marker-time">${time}</div>` : ''}
      `;
      labels.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        openAdvanceTimePopover(labels as unknown as HTMLButtonElement, appState.inGameNow, async (newNow) => {
          const newState: State = { ...appState.state, in_game_now: newNow };
          await putState(newState);
          appState.state = newState;
          appState.inGameNow = newNow;
          appState.inGameNowSeconds = toAbsoluteSeconds(parseISOString(newNow));
          renderTimeline();
        });
      });
      marker.appendChild(labels);
      container.appendChild(marker);
    }
  }

  function renderSidebar() {
    renderFilterSidebar(filterBar, {
      events: () => appState.events,
      tags: () => appState.tags,
      state: () => appState.filter,
      inGameNow: appState.inGameNow,
      realWorldNow: new Date().toISOString().slice(0, 10),
      onChange: () => {
        savePinnedFilters(appState.filter);
        renderSidebar();
        renderTimeline();
      },
    });
    const visible = visibleEvents().length;
    filterCount.textContent = `${visible} / ${appState.events.length}`;
  }

  function jumpToEvent(ev: EventListItem) {
    appState.view.centerSeconds = toAbsoluteSeconds(parseISOString(ev.date));
    renderTimeline();
    flashCard(ev.filename);
  }

  function flashCard(filename: string) {
    requestAnimationFrame(() => {
      const el = cardsLayer.querySelector(`.event-card[data-filename="${CSS.escape(filename)}"]`);
      if (!el) return;
      el.classList.add('is-flashing');
      setTimeout(() => el.classList.remove('is-flashing'), 1200);
    });
  }

  const search = createSearchOverlay(document.body, () => appState.events, {
    onJump: jumpToEvent,
  });

  container.addEventListener('wheel', (e) => {
    if ((e.target as HTMLElement).closest('.event-card.is-expanded')) return;
    e.preventDefault();
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
    appState.view = zoomAbout(appState.view, viewportSize(), x, factor);
    renderTimeline();
  }, { passive: false });

  const reschedule = createReschedule(container, {
    cardsLayer,
    getView: () => appState.view,
    getViewport: viewportSize,
    getEvents: () => appState.events,
    saveReschedule: async (filename, newSeconds) => {
      const full = await getEvent(filename);
      const newDate = toISOString(fromAbsoluteSeconds(newSeconds));
      await updateEvent(filename, {
        title: full.title,
        date: newDate,
        ...(full.tags ? { tags: full.tags } : {}),
        ...(full.color ? { color: full.color } : {}),
        ...(full.status ? { status: full.status } : {}),
      }, full.body, full.lastModified);
      await refreshEvents();
    },
  });

  const pan = createPan(container, {
    getView: () => appState.view,
    setView: (v) => { appState.view = v; renderTimeline(); },
    shouldIgnore: (target) =>
      !!(target as HTMLElement | null)?.closest?.('.event-modal, .modal-overlay, .search-overlay'),
    isOtherDragActive: () => reschedule.isActive() || sessionModeCtrl.isHandleDragging(),
  });

  createQuickAddZones(container, {
    getView: () => appState.view,
    getViewport: viewportSize,
    isInteractionActive: () => pan.isDragging() || reschedule.isActive() || appState.sessionMode,
    shouldSuppressClick: () => pan.wasMoved() || reschedule.wasActivated(),
    onQuickAdd: async (secs) => {
      const sessionTag = appState.state.current_session ? `session:${appState.state.current_session}` : undefined;
      const result = await openCreateEditor({
        initialDate: toISOString(fromAbsoluteSeconds(secs)),
        initialTags: sessionTag,
        extraValidate: makeSessionValidator(),
      });
      await handleEditorResult(result);
    },
    onSetNow: async (secs) => {
      const newNow = toISOString(fromAbsoluteSeconds(secs));
      const newState: State = { ...appState.state, in_game_now: newNow };
      await putState(newState);
      appState.state = newState;
      appState.inGameNow = newNow;
      appState.inGameNowSeconds = toAbsoluteSeconds(parseISOString(newNow));
      renderTimeline();
    },
  });

  // ---- Session mode interaction ----

  const sessionModeCtrl = createSessionMode(container, sessionLayer, {
    getSessions: () => appState.sessions,
    getView: () => appState.view,
    getViewport: viewportSize,
    onSaveSession: async (updated: Session) => {
      const newSessions = appState.sessions.map(s => s.id === updated.id ? updated : s);
      await putSessions(newSessions);
      appState.sessions = newSessions;
      renderTimeline();
    },
    onCreateSession: async (inGameStart: string, inGameEnd: string) => {
      const result = await openSessionEditModal(null, { inGameStart, inGameEnd });
      if (result.status === 'saved' && result.session) {
        const newSessions = [...appState.sessions, result.session];
        await putSessions(newSessions);
        appState.sessions = newSessions;
        renderTimeline();
      }
    },
    onExitSessionMode: () => {
      appState.sessionMode = false;
      renderTimeline();
      updateSessionBtn();
    },
  });

  // ---- Session tooltip (hover, always on) ----

  createSessionTooltip(sessionLayer, {
    getSessions: () => appState.sessions,
  });

  // ---- Session rail pill click (open edit modal) ----

  sessionLayer.addEventListener('click', async (e) => {
    const pill = (e.target as HTMLElement).closest('.session-pill') as HTMLElement | null;
    if (!pill) return;
    const sessionId = pill.dataset.sessionId;
    if (!sessionId) return;
    const session = appState.sessions.find(s => s.id === sessionId);
    if (!session) return;

    const result = await openSessionEditModal(session, null);
    if (result.status === 'saved' && result.session) {
      const newSessions = appState.sessions.map(s => s.id === result.session!.id ? result.session! : s);
      await putSessions(newSessions);
      appState.sessions = newSessions;
      renderTimeline();
    } else if (result.status === 'deleted') {
      const newSessions = appState.sessions.filter(s => s.id !== sessionId);
      await putSessions(newSessions);
      appState.sessions = newSessions;
      renderTimeline();
    }
  });

  function makeSessionValidator(skipFilename?: string): (buf: DraftBuffer) => string | null {
    return (buf: DraftBuffer): string | null => {
      const sessionTag = buf.tagsText.split(',').map(t => t.trim()).find(t => t.startsWith('session:'));
      if (!sessionTag) return null;
      const sessionId = sessionTag.slice('session:'.length);

      let eventSecs: number;
      try { eventSecs = toAbsoluteSeconds(parseISOString(buf.date)); } catch { return null; }

      const otherEvents = appState.events.filter(ev => ev.filename !== skipFilename);
      const bands = computeSessionBandsFromSessions(appState.sessions, otherEvents);

      for (const band of bands) {
        if (band.sessionId === sessionId) continue;
        if (eventSecs > band.startSeconds && eventSecs < band.endSeconds) {
          const fmt = (s: number) => formatAxisDay(fromAbsoluteSeconds(s));
          return `This date falls inside session ${band.sessionId}'s in-game span `
            + `(${fmt(band.startSeconds)} – ${fmt(band.endSeconds)}). `
            + `Sessions cannot overlap. Use session:${band.sessionId} or choose a date outside that range.`;
        }
      }
      return null;
    };
  }

  async function refreshEvents() {
    const fresh = await listEvents();
    appState.events = fresh;
    renderSidebar();
    renderTimeline();
  }

  async function refreshSessions() {
    const raw = await getSessions();
    appState.sessions = normalizeSessions(raw as unknown[]);
    renderTimeline();
  }
  void refreshSessions; // available for future use

  async function handleEditorResult(result: { status: 'saved' | 'deleted' | 'cancelled'; filename?: string }) {
    if (result.status === 'saved' || result.status === 'deleted') {
      await refreshEvents();
      if (result.status === 'saved' && result.filename) {
        const ev = appState.events.find(e => e.filename === result.filename);
        if (ev) jumpToEvent(ev);
      }
    }
  }

  async function softDelete(filename: string, title: string) {
    const ok = window.confirm(`Move "${title}" to trash?\n\nRecoverable via Settings → Trash.`);
    if (!ok) return;
    try {
      const full = await getEvent(filename);
      await deleteEvent(filename, full.lastModified);
      await refreshEvents();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const force = window.confirm('File was modified on disk. Delete anyway?');
        if (!force) return;
        await deleteEvent(filename, '');
        await refreshEvents();
        return;
      }
      console.error('Delete failed', err);
      window.alert(`Delete failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  let lastCardClick = { filename: '', time: 0 };
  const DBLCLICK_MS = 300;

  cardsLayer.addEventListener('click', async (e) => {
    if (appState.sessionMode) return;
    if (pan.wasMoved()) return;
    if (reschedule.wasActivated()) return;

    const actionBtn = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
    if (actionBtn) {
      e.stopPropagation();
      const filename = actionBtn.closest('.event-card')?.getAttribute('data-filename');
      if (!filename) return;
      if (actionBtn.dataset.action === 'edit') {
        cardExpansion = undefined;
        renderTimeline();
        const result = await openEditEditor(filename, { extraValidate: makeSessionValidator(filename) });
        await handleEditorResult(result);
      } else if (actionBtn.dataset.action === 'delete') {
        const ev = appState.events.find(ev => ev.filename === filename);
        if (ev) await softDelete(filename, ev.title);
      }
      return;
    }

    const cardEl = (e.target as HTMLElement).closest('.event-card') as HTMLElement | null;
    if (!cardEl) { cardExpansion = undefined; renderTimeline(); return; }
    const filename = cardEl.dataset.filename;
    if (!filename) return;

    const now = Date.now();
    const isDoubleClick = filename === lastCardClick.filename && now - lastCardClick.time < DBLCLICK_MS;
    lastCardClick = { filename, time: now };

    if (isDoubleClick) {
      cardExpansion = undefined;
      renderTimeline();
      const result = await openEditEditor(filename, { extraValidate: makeSessionValidator(filename) });
      await handleEditorResult(result);
      return;
    }

    if (cardExpansion?.filename === filename) {
      cardExpansion = undefined;
      renderTimeline();
    } else {
      cardExpansion = { filename, body: null };
      renderTimeline();
      const full = await getEvent(filename);
      if (cardExpansion?.filename === filename) {
        cardExpansion = { filename, body: full.body };
        renderTimeline();
      }
    }
  });

  document.getElementById('btn-new-event')!.addEventListener('click', async () => {
    const sessionTag = appState.state.current_session ? `session:${appState.state.current_session}` : undefined;
    const result = await openCreateEditor({
      initialDate: appState.inGameNow,
      initialTags: sessionTag,
      extraValidate: makeSessionValidator(),
    });
    await handleEditorResult(result);
  });

  document.getElementById('btn-advance-time')!.addEventListener('click', (e) => {
    openAdvanceTimePopover(e.currentTarget as HTMLButtonElement, appState.inGameNow, async (newNow) => {
      const newState: State = { ...appState.state, in_game_now: newNow };
      await putState(newState);
      appState.state = newState;
      appState.inGameNow = newNow;
      appState.inGameNowSeconds = toAbsoluteSeconds(parseISOString(newNow));
      renderTimeline();
    });
  });

  const sessionBtn = document.getElementById('btn-session') as HTMLButtonElement;

  function updateSessionBtn() {
    if (appState.sessionMode) {
      sessionBtn.textContent = 'Session ✕';
      sessionBtn.classList.add('is-active');
    } else {
      sessionBtn.textContent = 'Session';
      sessionBtn.classList.remove('is-active');
    }
  }
  updateSessionBtn();

  sessionBtn.addEventListener('click', async (e) => {
    if (appState.sessionMode) {
      // Toggle off
      appState.sessionMode = false;
      sessionModeCtrl.exit();
      renderTimeline();
      updateSessionBtn();
      return;
    }

    // Toggle on — enter session mode
    appState.sessionMode = true;
    sessionModeCtrl.enter();
    renderTimeline();
    updateSessionBtn();

    // Also open legacy session manager popover for managing current_session
    const btn = e.currentTarget as HTMLButtonElement;
    const today = new Date().toISOString().slice(0, 10);
    const knownIds = new Set(appState.sessions.map(s => s.id));
    const legacyDerived = appState.events
      .flatMap(ev => (ev.tags ?? [])
        .filter(t => t.startsWith('session:'))
        .map(t => t.slice('session:'.length)))
      .filter(d => d && !knownIds.has(d))
      .filter((d, i, arr) => arr.indexOf(d) === i)
      .sort()
      .map(d => ({ real_date: d, in_game_start: '', notes: '' }));
    const legacySessions = [
      ...appState.sessions.map(s => ({ real_date: s.id, in_game_start: s.inGameStart, notes: s.notes ?? '' })),
      ...legacyDerived,
    ];
    openSessionManagerPopover(
      btn,
      appState.state.current_session,
      legacySessions,
      appState.inGameNow,
      today,
      {
        onActivate: async (realDate) => {
          const newState: State = { ...appState.state, current_session: realDate };
          await putState(newState);
          appState.state = newState;
        },
        onNew: async (session, realDate) => {
          const newSession = normalizeSession({
            id: realDate,
            real_date: realDate,
            in_game_start: session.in_game_start,
            notes: session.notes,
          }, appState.sessions.length);
          await putSessions([...appState.sessions, newSession]);
          await refreshSessions();
          const newState: State = { ...appState.state, current_session: realDate };
          await putState(newState);
          appState.state = newState;
        },
      },
    );
  });

  document.getElementById('btn-now')!.addEventListener('click', () => {
    appState.view.centerSeconds = appState.inGameNowSeconds;
    renderTimeline();
  });
  document.getElementById('btn-search')!.addEventListener('click', () => search.open());

  const filterPanel = document.getElementById('filter-panel') as HTMLDivElement;
  const filterBtn = document.getElementById('btn-filters') as HTMLButtonElement;
  filterBtn.addEventListener('click', () => {
    const isOpen = !filterPanel.classList.contains('is-visible');
    filterPanel.classList.toggle('is-visible', isOpen);
    filterBtn.classList.toggle('is-active', isOpen);
  });

  window.addEventListener('resize', renderTimeline);

  initPeek();
  renderSidebar();
  renderTimeline();

  return {
    zoomBy(factor) {
      appState.view = zoomAbout(appState.view, viewportSize(), viewportSize().width / 2, factor);
      renderTimeline();
    },
    panBy(pixels) {
      appState.view = panByPixels(appState.view, pixels);
      renderTimeline();
    },
    jumpToNow() {
      appState.view.centerSeconds = appState.inGameNowSeconds;
      renderTimeline();
    },
    collapseExpansion() {
      if (!cardExpansion) return false;
      cardExpansion = undefined;
      renderTimeline();
      return true;
    },
    exitSessionMode() {
      if (!appState.sessionMode) return false;
      appState.sessionMode = false;
      sessionModeCtrl.exit();
      renderTimeline();
      updateSessionBtn();
      return true;
    },
    openSearch: () => search.open(),
    isSearchOpen: () => search.isOpen(),
  };
}
