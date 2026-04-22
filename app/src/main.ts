import { loadPalette } from './theme.ts';
import { listEvents, getState, getTags, getEvent, deleteEvent, ApiError } from './data/api.ts';
import { parseISOString, toAbsoluteSeconds } from './calendar/golarian.ts';
import {
  type ViewState, type ViewportSize,
  DEFAULT_SECONDS_PER_PIXEL, zoomAbout, panByPixels,
} from './timeline/zoom.ts';
import { renderAxis } from './timeline/axis.ts';
import { layoutCards, renderCards } from './timeline/card.ts';
import { computeSessionBands, renderSessionBands } from './timeline/session-band.ts';
import { openEventModal } from './timeline/event-modal.ts';
import { openCreateEditor, openEditEditor } from './editor/modal.ts';
import {
  type FilterState, makeInitialFilterState, applyFilters, renderFilterSidebar,
  loadPinnedFilters, savePinnedFilters,
} from './panels/filters.ts';
import { createSearchOverlay } from './panels/search.ts';
import type { EventListItem, TagsRegistry } from './data/types.ts';

interface AppState {
  events: EventListItem[];
  tags: TagsRegistry;
  inGameNowSeconds: number;
  campaignStart: string;
  inGameNow: string;
  view: ViewState;
  filter: FilterState;
}

async function main() {
  const root = document.getElementById('app')!;
  root.innerHTML = `
    <header class="toolbar">
      <div class="filter-bar" id="filter-bar"></div>
      <div class="toolbar-buttons">
        <span class="filter-count" id="filter-count"></span>
        <button id="btn-search" title="Search (Ctrl+F)">Search</button>
        <button id="btn-now">Now</button>
        <button id="btn-new-event" class="is-primary" title="New event (N)">+ Event</button>
      </div>
    </header>
    <div class="timeline-container" id="timeline">
      <div class="timeline-session-layer" id="session-layer"></div>
      <div class="timeline-axis-layer" id="axis-layer"></div>
      <div class="timeline-cards-layer" id="cards-layer"></div>
    </div>
  `;

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

  function renderTimeline() {
    const size = viewportSize();
    const filtered = visibleEvents();
    const sessionBands = computeSessionBands(filtered);
    renderSessionBands(sessionLayer, sessionBands, appState.view, size);
    renderAxis(axisLayer, appState.view, size);

    const laidOut = layoutCards(filtered, appState.view, size, appState.inGameNowSeconds);
    renderCards(cardsLayer, laidOut, size);

    const existing = container.querySelector('.now-marker');
    if (existing) existing.remove();
    const nowX = (appState.inGameNowSeconds - appState.view.centerSeconds) / appState.view.secondsPerPixel + size.width / 2;
    if (nowX >= 0 && nowX <= size.width) {
      const marker = document.createElement('div');
      marker.className = 'now-marker';
      marker.style.left = `${nowX}px`;
      const label = document.createElement('div');
      label.className = 'now-marker-label';
      label.textContent = 'Now';
      marker.appendChild(label);
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

  container.addEventListener('mousedown', (e) => {
    if ((e.target as HTMLElement).closest('.event-modal, .modal-overlay, .search-overlay')) return;
    dragging = true;
    dragMoved = false;
    dragStartX = e.clientX;
    lastX = e.clientX;
    container.style.cursor = 'grabbing';
  });
  window.addEventListener('mouseup', () => {
    dragging = false;
    container.style.cursor = '';
  });
  window.addEventListener('mousemove', (e) => {
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

  cardsLayer.addEventListener('click', async (e) => {
    if (dragMoved) return;
    const cardEl = (e.target as HTMLElement).closest('.event-card') as HTMLElement | null;
    if (!cardEl) return;
    const filename = cardEl.dataset.filename;
    if (!filename) return;
    const event = appState.events.find(ev => ev.filename === filename);
    if (!event) return;
    try {
      const action = await openEventModal(event);
      if (action === 'edit') {
        const result = await openEditEditor(filename);
        await handleEditorResult(result);
      } else if (action === 'delete') {
        await softDelete(filename, event.title);
      }
    } catch (err) {
      console.error('Failed to open event modal', err);
    }
  });

  document.getElementById('btn-new-event')!.addEventListener('click', async () => {
    const result = await openCreateEditor({ initialDate: appState.inGameNow });
    await handleEditorResult(result);
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
    }
  });

  document.getElementById('btn-now')!.addEventListener('click', () => {
    appState.view.centerSeconds = appState.inGameNowSeconds;
    renderTimeline();
  });
  document.getElementById('btn-search')!.addEventListener('click', () => search.open());

  window.addEventListener('resize', renderTimeline);

  renderSidebar();
  renderTimeline();
}

main().catch(err => {
  console.error(err);
  const root = document.getElementById('app')!;
  root.innerHTML = `<div style="padding: 20px; color: #c06040;">
    <h2>Error loading timeline</h2>
    <pre>${String(err?.message ?? err)}</pre>
  </div>`;
});
