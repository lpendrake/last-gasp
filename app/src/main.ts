// NOTE FOR AGENTS: do not extend this file. New client code goes in
// the relevant slice — DOM scaffolding in bootstrap/mount.ts, view
// switching in bootstrap/view-switcher.ts, hotkeys in
// bootstrap/shortcuts.ts, timeline behaviour in timeline/app.ts. See
// app/src/AGENTS.md and app/src/timeline/AGENTS.md.
import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import { NotesApp } from './notes/Notes.tsx';
import { loadPalette } from './theme.ts';
import { listEvents, getState, putState, getTags, getSessions, getEvent, deleteEvent, appendSession, updateEvent, ApiError } from './data/api.ts';
import { parseISOString, toAbsoluteSeconds, fromAbsoluteSeconds, toISOString } from './calendar/golarian.ts';
import { formatNowMarker, formatAxisDay, formatAxisHour } from './calendar/format.ts';
import { openAdvanceTimePopover, openSessionManagerPopover } from './panels/toolbar.ts';
import {
  type ViewState, type ViewportSize,
  DEFAULT_SECONDS_PER_PIXEL, SECONDS_PER_DAY, zoomAbout, panByPixels, xToSeconds, secondsToX,
} from './timeline/zoom.ts';
import { renderAxis } from './timeline/axis.ts';
import { layoutCards, renderCards, type CardExpansion } from './timeline/card.ts';
import { computeSessionBands, renderSessionBands, findSessionConflicts } from './timeline/session-band.ts';
import { openCreateEditor, openEditEditor } from './editor/modal.ts';
import {
  type FilterState, makeInitialFilterState, applyFilters, renderFilterSidebar,
  loadPinnedFilters, savePinnedFilters,
} from './panels/filters.ts';
import { createSearchOverlay } from './panels/search.ts';
import { initPeek } from './peek/stack.ts';
import type { EventListItem, TagsRegistry, State } from './data/types.ts';
import type { DraftBuffer } from './editor/drafts.ts';

interface AppState {
  events: EventListItem[];
  tags: TagsRegistry;
  state: State;
  inGameNowSeconds: number;
  campaignStart: string;
  inGameNow: string;
  view: ViewState;
  filter: FilterState;
}

let notesReactRoot: ReturnType<typeof createRoot> | null = null;

async function main() {
  const appEl = document.getElementById('app')!;
  appEl.innerHTML = `
    <div id="timeline-shell" style="display:contents">
      <div class="timeline-container" id="timeline">
        <div class="timeline-session-layer" id="session-layer"></div>
        <div class="timeline-axis-layer" id="axis-layer"></div>
        <div class="timeline-cards-layer" id="cards-layer"></div>
      </div>
      <div class="filter-panel" id="filter-panel">
        <div class="filter-bar" id="filter-bar"></div>
      </div>
      <footer class="toolbar">
        <div class="toolbar-left">
          <button id="btn-filters">Filters</button>
          <span class="filter-count" id="filter-count"></span>
        </div>
        <div class="toolbar-main">
          <div class="toolbar-main-left">
            <button id="btn-search" title="Search (Ctrl+F)">Search</button>
            <button id="btn-session">Session</button>
          </div>
          <button id="btn-new-event" class="is-primary" title="New event (N)">+ Event</button>
          <div class="toolbar-main-right">
            <button id="btn-now">Now</button>
            <button id="btn-advance-time">Advance Time</button>
          </div>
        </div>
        <div class="toolbar-right" style="display:flex;gap:8px;align-items:center;justify-content:flex-end">
          <div class="view-switcher">
            <button class="is-active" id="btn-view-timeline">Timeline</button>
            <button id="btn-view-notes">Notes</button>
          </div>
        </div>
      </footer>
    </div>
    <div id="notes-shell" style="display:none;flex:1 1 auto;flex-direction:column;min-height:0"></div>
  `;

  // ---- View switching ----
  const timelineShell = document.getElementById('timeline-shell') as HTMLDivElement;
  const notesShell = document.getElementById('notes-shell') as HTMLDivElement;
  const root = document.getElementById('app')!;

  function showNotes() {
    // Set app to flex-column so notes-shell fills it
    root.style.display = 'flex';
    root.style.flexDirection = 'column';
    timelineShell.style.display = 'none';
    notesShell.style.display = 'flex';
    notesShell.style.flexDirection = 'column';
    notesShell.style.flex = '1 1 auto';
    notesShell.style.minHeight = '0';
    if (!notesReactRoot) {
      notesReactRoot = createRoot(notesShell);
    }
    notesReactRoot.render(createElement(NotesApp));
    document.getElementById('btn-view-timeline')!.classList.remove('is-active');
    document.getElementById('btn-view-notes')!.classList.add('is-active');
  }

  function showTimeline() {
    notesShell.style.display = 'none';
    timelineShell.style.display = 'contents';
    // notesReactRoot stays alive so state is preserved between switches
    document.getElementById('btn-view-timeline')!.classList.add('is-active');
    document.getElementById('btn-view-notes')!.classList.remove('is-active');
  }

  document.getElementById('btn-view-notes')!.addEventListener('click', () => {
    history.pushState(null, '', '/notes');
    showNotes();
  });
  window.addEventListener('notes:exit', () => {
    history.pushState(null, '', '/timeline');
    showTimeline();
  });
  window.addEventListener('popstate', () => {
    if (location.pathname.startsWith('/notes')) showNotes();
    else showTimeline();
  });

  const [palette, events, state, tags] = await Promise.all([
    loadPalette(),
    listEvents(),
    getState(),
    getTags(),
  ]);
  void palette;

  const inGameNow = parseISOString(state.in_game_now);
  const inGameNowSeconds = toAbsoluteSeconds(inGameNow);

  const initialFilter = makeInitialFilterState();
  // Rehydrate pinned filters from localStorage, but start them disabled so
  // the default state is "showing all events" as agreed.
  for (const f of loadPinnedFilters()) {
    initialFilter.filters.push({ ...f, enabled: false });
  }

  const appState: AppState = {
    events,
    tags,
    state,
    inGameNowSeconds,
    campaignStart: state.campaign_start,
    inGameNow: state.in_game_now,
    view: {
      centerSeconds: inGameNowSeconds,
      secondsPerPixel: DEFAULT_SECONDS_PER_PIXEL,
    },
    filter: initialFilter,
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
    const sessionBands = computeSessionBands(filtered);
    const sessionConflicts = findSessionConflicts(sessionBands, filtered);
    const overlappingIds = new Set(sessionConflicts.map(c => c.sessionId));
    renderSessionBands(sessionLayer, sessionBands, appState.view, size, overlappingIds);
    renderAxis(axisLayer, appState.view, size);

    const laidOut = layoutCards(filtered, appState.view, size, appState.inGameNowSeconds);
    renderCards(cardsLayer, laidOut, size, cardExpansion);

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
    // Card elements are rebuilt every render, so defer and query after paint.
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

  // Wheel zoom about cursor
  container.addEventListener('wheel', (e) => {
    if ((e.target as HTMLElement).closest('.event-card.is-expanded')) return;
    e.preventDefault();
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
    appState.view = zoomAbout(appState.view, viewportSize(), x, factor);
    renderTimeline();
  }, { passive: false });

  // Click-drag pan
  let dragging = false;
  let dragStartX = 0;
  let dragMoved = false;
  let lastX = 0;
  const DRAG_THRESHOLD_PX = 5;

  // Ctrl+drag state for rescheduling events
  let ctrlDrag: {
    filename: string;
    cardEl: HTMLElement;
    connectorEl: HTMLElement | null;
    dotEl: HTMLElement | null;
    cardWidth: number;
    startMouseX: number;
    originalSecs: number;
    currentSecs: number;
  } | null = null;
  let ctrlDragActivated = false; // suppress post-drag click

  container.addEventListener('mousedown', (e) => {
    if ((e.target as HTMLElement).closest('.event-modal, .modal-overlay, .search-overlay')) return;

    if (e.shiftKey && e.button === 0) {
      const cardEl = (e.target as HTMLElement).closest('.event-card') as HTMLElement | null;
      if (cardEl) {
        const filename = cardEl.dataset.filename;
        if (filename) {
          const ev = appState.events.find(ev => ev.filename === filename);
          if (ev) {
            const originalSecs = toAbsoluteSeconds(parseISOString(ev.date));
            ctrlDrag = {
              filename,
              cardEl,
              connectorEl: cardsLayer.querySelector<HTMLElement>(`.event-card-connector[data-filename="${CSS.escape(filename)}"]`),
              dotEl: cardsLayer.querySelector<HTMLElement>(`.event-card-dot[data-filename="${CSS.escape(filename)}"]`),
              cardWidth: parseInt(cardEl.style.width, 10),
              startMouseX: e.clientX,
              originalSecs,
              currentSecs: originalSecs,
            };
            ctrlDragActivated = true;
            cardEl.classList.add('is-ctrl-dragging');
            container.style.cursor = 'ew-resize';
            return;
          }
        }
      }
    }

    dragging = true;
    dragMoved = false;
    dragStartX = e.clientX;
    lastX = e.clientX;
    container.style.cursor = 'grabbing';
  });
  window.addEventListener('mouseup', async () => {
    if (ctrlDrag) {
      const { filename, originalSecs, currentSecs, cardEl } = ctrlDrag;
      cardEl.classList.remove('is-ctrl-dragging');
      ctrlDragLabel.style.display = 'none';
      ctrlDrag = null;
      container.style.cursor = '';
      if (currentSecs !== originalSecs) {
        try {
          const full = await getEvent(filename);
          const newDate = toISOString(fromAbsoluteSeconds(currentSecs));
          await updateEvent(filename, {
            title: full.title,
            date: newDate,
            ...(full.tags ? { tags: full.tags } : {}),
            ...(full.color ? { color: full.color } : {}),
            ...(full.status ? { status: full.status } : {}),
          }, full.body, full.lastModified);
          await refreshEvents();
        } catch (err) {
          console.error('Reschedule failed', err);
          renderTimeline();
        }
      }
      return;
    }
    dragging = false;
    container.style.cursor = '';
  });
  window.addEventListener('mousemove', (e) => {
    if (ctrlDrag) {
      const size = viewportSize();
      const axisY = Math.floor(container.clientHeight * 0.8);
      const deltaX = e.clientX - ctrlDrag.startMouseX;
      const originalX = secondsToX(ctrlDrag.originalSecs, appState.view, size);
      const rawSecs = xToSeconds(originalX + deltaX, appState.view, size);
      const dragSnapUnit = e.ctrlKey ? SECONDS_PER_DAY : SNAP_SECS;
      const snappedSecs = Math.round(rawSecs / dragSnapUnit) * dragSnapUnit;
      ctrlDrag.currentSecs = snappedSecs;
      const snappedX = secondsToX(snappedSecs, appState.view, size);
      ctrlDrag.cardEl.style.left = `${snappedX - ctrlDrag.cardWidth / 2}px`;
      if (ctrlDrag.connectorEl) ctrlDrag.connectorEl.style.left = `${snappedX}px`;
      if (ctrlDrag.dotEl) ctrlDrag.dotEl.style.left = `${snappedX}px`;
      const date = fromAbsoluteSeconds(snappedSecs);
      ctrlDragLabel.textContent = formatAxisDay(date) + ' ' + formatAxisHour(date);
      ctrlDragLabel.style.left = `${snappedX}px`;
      ctrlDragLabel.style.top = `${axisY + 8}px`;
      ctrlDragLabel.style.display = '';
      return;
    }
    if (!dragging) return;
    if (!dragMoved && Math.abs(e.clientX - dragStartX) >= DRAG_THRESHOLD_PX) {
      dragMoved = true;
    }
    if (!dragMoved) return;
    const delta = e.clientX - lastX;
    lastX = e.clientX;
    appState.view = panByPixels(appState.view, delta);
    renderTimeline();
  });

  // Quick-add indicator — only active below the axis (in the month band zone, ~64px)
  const SNAP_SECS = 900;
  const QUICK_ADD_ZONE_TOP = 4;   // px below axisY to start activating
  const QUICK_ADD_ZONE_BOTTOM = 68; // px below axisY to stop
  let quickAddSeconds: number | null = null;
  let shiftPreviewSeconds: number | null = null;

  const quickAdd = document.createElement('div');
  quickAdd.className = 'quick-add';
  quickAdd.innerHTML = `<div class="quick-add-circle">+</div><div class="quick-add-label"></div>`;
  quickAdd.style.display = 'none';
  container.appendChild(quickAdd);

  const shiftPreview = document.createElement('div');
  shiftPreview.className = 'shift-now-preview';
  shiftPreview.innerHTML = `
    <div class="shift-now-labels">
      <div class="shift-now-hint">set now</div>
      <div class="shift-now-date"></div>
      <div class="shift-now-year"></div>
      <div class="shift-now-time"></div>
    </div>`;
  shiftPreview.style.display = 'none';
  container.appendChild(shiftPreview);

  const ctrlDragLabel = document.createElement('div');
  ctrlDragLabel.className = 'ctrl-drag-label';
  ctrlDragLabel.style.display = 'none';
  container.appendChild(ctrlDragLabel);

  function hideZoneIndicators() {
    quickAdd.style.display = 'none'; quickAddSeconds = null;
    shiftPreview.style.display = 'none'; shiftPreviewSeconds = null;
  }

  container.addEventListener('mousemove', (e) => {
    if (dragging || ctrlDrag) { hideZoneIndicators(); return; }
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const axisY = Math.floor(container.clientHeight * 0.8);

    if (y < axisY + QUICK_ADD_ZONE_TOP || y > axisY + QUICK_ADD_ZONE_BOTTOM) {
      hideZoneIndicators(); return;
    }

    const size = viewportSize();
    const rawSecs = xToSeconds(x, appState.view, size);
    const snapUnit = e.ctrlKey ? SECONDS_PER_DAY : SNAP_SECS;
    const snapped = Math.round(rawSecs / snapUnit) * snapUnit;
    const snappedX = secondsToX(snapped, appState.view, size);
    const date = fromAbsoluteSeconds(snapped);

    if (e.shiftKey) {
      quickAdd.style.display = 'none'; quickAddSeconds = null;
      shiftPreviewSeconds = snapped;
      const [dayMonth, year, time] = formatNowMarker(date);
      shiftPreview.style.left = `${snappedX}px`;
      shiftPreview.style.display = '';
      const labelsEl = shiftPreview.querySelector('.shift-now-labels') as HTMLElement;
      labelsEl.style.top = `${axisY + 66}px`;
      (shiftPreview.querySelector('.shift-now-date') as HTMLElement).textContent = dayMonth;
      (shiftPreview.querySelector('.shift-now-year') as HTMLElement).textContent = year;
      const timeEl = shiftPreview.querySelector('.shift-now-time') as HTMLElement;
      timeEl.textContent = time ?? '';
      timeEl.style.display = time ? '' : 'none';
    } else {
      shiftPreview.style.display = 'none'; shiftPreviewSeconds = null;
      quickAddSeconds = snapped;
      const label = quickAdd.querySelector('.quick-add-label') as HTMLElement;
      label.textContent = e.ctrlKey
        ? formatAxisDay(date)
        : `${formatAxisDay(date)} ${formatAxisHour(date)}`;
      quickAdd.style.left = `${snappedX}px`;
      quickAdd.style.top = `${axisY}px`;
      quickAdd.style.display = '';
    }
  });

  container.addEventListener('mouseleave', hideZoneIndicators);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && ctrlDrag) {
      const size = viewportSize();
      const originalX = secondsToX(ctrlDrag.originalSecs, appState.view, size);
      ctrlDrag.cardEl.style.left = `${originalX - ctrlDrag.cardWidth / 2}px`;
      if (ctrlDrag.connectorEl) ctrlDrag.connectorEl.style.left = `${originalX}px`;
      if (ctrlDrag.dotEl) ctrlDrag.dotEl.style.left = `${originalX}px`;
      ctrlDrag.cardEl.classList.remove('is-ctrl-dragging');
      ctrlDragLabel.style.display = 'none';
      ctrlDrag = null;
      container.style.cursor = '';
      // ctrlDragActivated stays true to suppress the upcoming mouseup→click
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'Shift') { shiftPreview.style.display = 'none'; shiftPreviewSeconds = null; }
  });

  container.addEventListener('click', async (e) => {
    if (dragMoved) return;
    if (ctrlDragActivated) { ctrlDragActivated = false; return; }

    // Shift+click: set in-game now to the previewed time
    if (e.shiftKey && shiftPreviewSeconds !== null) {
      const secs = shiftPreviewSeconds;
      hideZoneIndicators();
      const newNow = toISOString(fromAbsoluteSeconds(secs));
      const newState: State = { ...appState.state, in_game_now: newNow };
      await putState(newState);
      appState.state = newState;
      appState.inGameNow = newNow;
      appState.inGameNowSeconds = toAbsoluteSeconds(parseISOString(newNow));
      renderTimeline();
      return;
    }

    if (quickAddSeconds === null) return;
    if ((e.target as HTMLElement).closest('.event-card')) return;
    const secs = quickAddSeconds;
    quickAdd.style.display = 'none'; quickAddSeconds = null;
    const sessionTag = appState.state.current_session ? `session:${appState.state.current_session}` : undefined;
    const result = await openCreateEditor({
      initialDate: toISOString(fromAbsoluteSeconds(secs)),
      initialTags: sessionTag,
      extraValidate: makeSessionValidator(),
    });
    await handleEditorResult(result);
  });

  function makeSessionValidator(skipFilename?: string): (buf: DraftBuffer) => string | null {
    return (buf: DraftBuffer): string | null => {
      const sessionTag = buf.tagsText.split(',').map(t => t.trim()).find(t => t.startsWith('session:'));
      if (!sessionTag) return null;
      const sessionId = sessionTag.slice('session:'.length);

      let eventSecs: number;
      try { eventSecs = toAbsoluteSeconds(parseISOString(buf.date)); } catch { return null; }

      const otherEvents = appState.events.filter(ev => ev.filename !== skipFilename);
      const bands = computeSessionBands(otherEvents);

      for (const band of bands) {
        if (band.sessionId === sessionId) continue;
        // Strict interior overlap — sharing an endpoint is a valid continuation
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
    if (dragMoved) return;
    if (ctrlDragActivated) { ctrlDragActivated = false; return; }

    // Action buttons inside an expanded card
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

    // Detect double-click by timing two consecutive clicks on the same card
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

    // Single click: toggle expansion
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
    const s = appState.state.current_session;
    sessionBtn.textContent = s ? `Session: ${s}` : 'Session';
    sessionBtn.classList.toggle('is-active', !!s);
  }
  updateSessionBtn();

  sessionBtn.addEventListener('click', async (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    const today = new Date().toISOString().slice(0, 10);
    const formal = await getSessions();
    const knownDates = new Set(formal.map(s => s.real_date));
    const derived = appState.events
      .flatMap(ev => (ev.tags ?? [])
        .filter(t => t.startsWith('session:'))
        .map(t => t.slice('session:'.length)))
      .filter(d => d && !knownDates.has(d))
      .filter((d, i, arr) => arr.indexOf(d) === i)
      .sort()
      .map(d => ({ real_date: d, in_game_start: '', notes: '' }));
    const sessions = [...formal, ...derived];
    openSessionManagerPopover(
      btn,
      appState.state.current_session,
      sessions,
      appState.inGameNow,
      today,
      {
        onActivate: async (realDate) => {
          const newState: State = { ...appState.state, current_session: realDate };
          await putState(newState);
          appState.state = newState;
          updateSessionBtn();
        },
        onNew: async (session, realDate) => {
          await appendSession(session);
          const newState: State = { ...appState.state, current_session: realDate };
          await putState(newState);
          appState.state = newState;
          updateSessionBtn();
        },
      },
    );
  });

  // Global keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    // Ctrl+F / Cmd+F: open search. Works even if another overlay is up.
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      search.open();
      return;
    }

    // Don't intercept other keys when a modal has focus handling
    if (document.querySelector('.modal-overlay') || search.isOpen()) return;

    // Don't intercept keys when user is typing in an input
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) {
      return;
    }

    if (e.key === '+' || e.key === '=') {
      appState.view = zoomAbout(appState.view, viewportSize(), viewportSize().width / 2, 1 / 1.2);
      renderTimeline();
    } else if (e.key === '-') {
      appState.view = zoomAbout(appState.view, viewportSize(), viewportSize().width / 2, 1.2);
      renderTimeline();
    } else if (e.key === 'Home') {
      appState.view.centerSeconds = appState.inGameNowSeconds;
      renderTimeline();
    } else if (e.key === 'ArrowLeft') {
      appState.view = panByPixels(appState.view, 50);
      renderTimeline();
    } else if (e.key === 'ArrowRight') {
      appState.view = panByPixels(appState.view, -50);
      renderTimeline();
    } else if (e.key === 'Escape' && cardExpansion) {
      cardExpansion = undefined;
      renderTimeline();
    }
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

  if (location.pathname.startsWith('/notes')) showNotes();
}

main().catch(err => {
  console.error(err);
  const root = document.getElementById('app')!;
  root.innerHTML = `<div style="padding: 20px; color: #c06040;">
    <h2>Error loading timeline</h2>
    <pre>${String(err?.message ?? err)}</pre>
  </div>`;
});
