import Fuse from 'fuse.js';
import type { Event, EventListItem } from '../data/types.ts';
import { getEvent } from '../data/api.ts';
import { parseISOString } from '../calendar/golarian.ts';
import { formatCompact } from '../calendar/format.ts';

export interface SearchableEvent extends EventListItem {
  body?: string;
}

export interface SearchCallbacks {
  /** Called when user activates a result. Should scroll timeline to the event. */
  onJump: (ev: EventListItem) => void;
}

const FUSE_OPTIONS = {
  keys: [
    { name: 'title', weight: 0.5 },
    { name: 'tags', weight: 0.2 },
    { name: 'date', weight: 0.2 },
    { name: 'body', weight: 0.1 },
  ],
  threshold: 0.4,
  ignoreLocation: true,
  includeMatches: true,
};

/** Returns a function that opens the overlay against a given event list. */
export function createSearchOverlay(
  root: HTMLElement,
  getEvents: () => EventListItem[],
  callbacks: SearchCallbacks,
) {
  let overlay: HTMLElement | null = null;
  let bodiesCache: Map<string, string> | null = null;

  async function open() {
    if (overlay) return;

    overlay = document.createElement('div');
    overlay.className = 'search-overlay';
    overlay.innerHTML = `
      <div class="search-panel">
        <input type="text" class="search-input" placeholder="Search events by title, tag, date, body..." autofocus>
        <div class="search-loading" hidden>Indexing bodies...</div>
        <ul class="search-results"></ul>
        <div class="search-hint">Enter to jump · Esc to close</div>
      </div>
    `;
    root.appendChild(overlay);

    const input = overlay.querySelector('.search-input') as HTMLInputElement;
    const results = overlay.querySelector('.search-results') as HTMLUListElement;
    const loading = overlay.querySelector('.search-loading') as HTMLElement;

    input.focus();

    const events = getEvents();
    let fuse = new Fuse<SearchableEvent>(events.map(e => ({ ...e })), FUSE_OPTIONS);
    let highlightIdx = 0;
    let lastMatches: { ev: EventListItem; snippet: string }[] = [];

    function renderResults(query: string) {
      results.innerHTML = '';
      if (!query.trim()) {
        highlightIdx = 0;
        lastMatches = [];
        return;
      }
      const hits = fuse.search(query, { limit: 30 });
      lastMatches = hits.map(h => ({
        ev: h.item,
        snippet: firstMatchSnippet(h, query),
      }));
      highlightIdx = Math.min(highlightIdx, lastMatches.length - 1);
      if (highlightIdx < 0) highlightIdx = 0;

      for (let i = 0; i < lastMatches.length; i++) {
        const { ev, snippet } = lastMatches[i];
        const li = document.createElement('li');
        li.className = 'search-result' + (i === highlightIdx ? ' is-active' : '');
        li.innerHTML = `
          <span class="search-result-title"></span>
          <span class="search-result-date"></span>
          <span class="search-result-snippet"></span>
        `;
        (li.querySelector('.search-result-title') as HTMLElement).textContent = ev.title;
        (li.querySelector('.search-result-date') as HTMLElement).textContent =
          formatCompact(parseISOString(ev.date));
        (li.querySelector('.search-result-snippet') as HTMLElement).textContent = snippet;
        li.addEventListener('click', () => {
          callbacks.onJump(ev);
          close();
        });
        results.appendChild(li);
      }
    }

    input.addEventListener('input', () => {
      renderResults(input.value);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (lastMatches[highlightIdx]) {
          callbacks.onJump(lastMatches[highlightIdx].ev);
          close();
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        highlightIdx = Math.min(highlightIdx + 1, lastMatches.length - 1);
        renderResults(input.value);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        highlightIdx = Math.max(highlightIdx - 1, 0);
        renderResults(input.value);
      }
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    // Lazy-load bodies in the background so body text becomes searchable
    // without making the first keystroke wait.
    if (!bodiesCache) {
      bodiesCache = new Map();
      loading.hidden = false;
      (async () => {
        for (const e of events) {
          if (!bodiesCache!.has(e.filename)) {
            try {
              const full: Event = await getEvent(e.filename);
              bodiesCache!.set(e.filename, full.body);
            } catch {
              bodiesCache!.set(e.filename, '');
            }
          }
        }
        if (overlay) {
          loading.hidden = true;
          const withBodies = events.map(e => ({ ...e, body: bodiesCache!.get(e.filename) ?? '' }));
          fuse = new Fuse<SearchableEvent>(withBodies, FUSE_OPTIONS);
          renderResults(input.value);
        }
      })();
    } else {
      const withBodies = events.map(e => ({ ...e, body: bodiesCache!.get(e.filename) ?? '' }));
      fuse = new Fuse<SearchableEvent>(withBodies, FUSE_OPTIONS);
    }
  }

  function close() {
    if (overlay) {
      overlay.remove();
      overlay = null;
    }
  }

  return { open, close, isOpen: () => overlay !== null };
}

function firstMatchSnippet(
  hit: { item: SearchableEvent; matches?: readonly { key?: string; value?: string; indices: readonly [number, number][] }[] },
  fallbackQuery: string,
): string {
  const matches = hit.matches ?? [];
  // Prefer a body match for context if one exists.
  const bodyMatch = matches.find(m => m.key === 'body');
  const anyMatch = bodyMatch ?? matches[0];
  if (anyMatch?.value && anyMatch.indices.length > 0) {
    const [start, end] = anyMatch.indices[0];
    const value = anyMatch.value;
    const from = Math.max(0, start - 30);
    const to = Math.min(value.length, end + 60);
    let snippet = value.slice(from, to).replace(/\s+/g, ' ').trim();
    if (from > 0) snippet = '…' + snippet;
    if (to < value.length) snippet = snippet + '…';
    return snippet;
  }
  return fallbackQuery;
}
