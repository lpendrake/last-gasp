import MarkdownIt from 'markdown-it';
import type { EventListItem } from '../data/types.ts';
import { parseISOString, toAbsoluteSeconds } from '../calendar/golarian.ts';
import { formatCardFace } from '../calendar/format.ts';
import { weekdayColor } from '../theme.ts';
import { type ViewState, type ViewportSize, secondsToX } from './zoom.ts';

const md = new MarkdownIt({ html: false, linkify: true, breaks: false });

export interface LaidOutCard {
  event: EventListItem;
  x: number;
  seconds: number;
  isFuture: boolean;
}

export interface CardExpansion {
  filename: string;
  body: string | null; // null = still loading
}

/**
 * Compute x-positions for all events within (or slightly outside) the visible range.
 */
export function layoutCards(
  events: EventListItem[],
  view: ViewState,
  size: ViewportSize,
  inGameNowSeconds: number,
): LaidOutCard[] {
  return events.map(ev => {
    const seconds = toAbsoluteSeconds(parseISOString(ev.date));
    return {
      event: ev,
      seconds,
      x: secondsToX(seconds, view, size),
      isFuture: seconds > inGameNowSeconds,
    };
  });
}

const CARD_HEIGHT = 64;
const CARD_GAP = 24;
const CARD_PADDING_X = 12;
const DEFAULT_EXPANDED_WIDTH = 640;
const DEFAULT_EXPANDED_HEIGHT = 480;
const PREVIEW_SIZE_KEY = 'preview-card-size';

interface PreviewSize {
  width: number;
  expandedHeight: number;
}

function loadPreviewSize(): PreviewSize {
  try {
    const raw = localStorage.getItem(PREVIEW_SIZE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.width === 'number' && typeof parsed.expandedHeight === 'number') {
        return parsed;
      }
    }
  } catch {}
  return { width: DEFAULT_EXPANDED_WIDTH, expandedHeight: DEFAULT_EXPANDED_HEIGHT };
}

function savePreviewSize(size: PreviewSize): void {
  try {
    localStorage.setItem(PREVIEW_SIZE_KEY, JSON.stringify(size));
  } catch {}
}

// MIT-licensed Heroicons v1 paths
const ICON_EDIT = `<svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>`;
const ICON_DELETE = `<svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>`;

function attachResizeHandles(
  cardEl: HTMLElement,
  expEl: HTMLElement,
  centerX: number,
  expandsDown: boolean,
) {
  const dirs = expandsDown ? (['sw', 'se'] as const) : (['nw', 'ne'] as const);

  for (const dir of dirs) {
    const handle = document.createElement('div');
    handle.className = `resize-handle resize-handle-${dir}`;
    expEl.appendChild(handle);

    handle.addEventListener('mousedown', (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      const startY = e.clientY;
      const startW = cardEl.offsetWidth;
      const startH = expEl.offsetHeight;
      const startTop = parseFloat(cardEl.style.top);

      const onMove = (me: MouseEvent) => {
        const dx = me.clientX - startX;
        const dy = me.clientY - startY;

        // Symmetric width resize around the timeline anchor point
        const isWest = dir === 'nw' || dir === 'sw';
        const newW = Math.max(200, startW + (isWest ? -dx : dx) * 2);
        cardEl.style.width = `${newW}px`;
        cardEl.style.left = `${centerX - newW / 2}px`;

        if (expandsDown) {
          // Dragging down increases height; card top stays fixed
          const newH = Math.max(100, startH + dy);
          expEl.style.height = `${newH}px`;
        } else {
          // Dragging up increases height; card top moves up
          const newH = Math.max(100, startH - dy);
          const newTop = startTop + (startH - newH);
          if (newTop < 0) {
            // Clamp to viewport top edge
            expEl.style.height = `${Math.max(100, startH + startTop)}px`;
            cardEl.style.top = '0px';
          } else {
            expEl.style.height = `${newH}px`;
            cardEl.style.top = `${newTop}px`;
          }
        }
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        savePreviewSize({ width: cardEl.offsetWidth, expandedHeight: expEl.offsetHeight });
        // Block the click event that fires immediately after mouseup from collapsing the card
        document.addEventListener('click', ev => ev.stopPropagation(), { capture: true, once: true });
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, c =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;'
  );
}

function fixImageUrls(el: HTMLElement, baseDir: string) {
  for (const img of el.querySelectorAll<HTMLImageElement>('img[src]')) {
    const src = img.getAttribute('src') ?? '';
    if (!src.startsWith('http') && !src.startsWith('/') && !src.startsWith('data:')) {
      img.setAttribute('src', `/api/file/${baseDir}/${src}`);
    }
  }
}

/**
 * Render collapsed (and optionally one expanded) card anchored to the axis.
 */
export function renderCards(
  container: HTMLElement,
  laidOut: LaidOutCard[],
  size: ViewportSize,
  expansion?: CardExpansion,
): void {
  container.innerHTML = '';

  const axisY = Math.floor(size.height * 0.8);

  const rows: { left: number; right: number }[][] = [];
  const sorted = [...laidOut].sort((a, b) => a.x - b.x);
  const placements = new Map<EventListItem, { row: number; width: number }>();

  for (const card of sorted) {
    const estWidth = Math.max(120, Math.min(360, card.event.title.length * 8 + CARD_PADDING_X * 2));
    const left = card.x - estWidth / 2;
    const right = card.x + estWidth / 2;

    let row = 0;
    while (true) {
      if (!rows[row]) rows[row] = [];
      const overlaps = rows[row].some(o => !(right < o.left || left > o.right));
      if (!overlaps) {
        rows[row].push({ left, right });
        break;
      }
      row++;
    }
    placements.set(card.event, { row, width: estWidth });
  }

  const previewSize = expansion ? loadPreviewSize() : null;

  for (const card of laidOut) {
    const placement = placements.get(card.event)!;
    const { row } = placement;
    const isExpanded = expansion?.filename === card.event.filename;
    const expandedHeight = isExpanded ? previewSize!.expandedHeight : 0;
    const width = isExpanded ? Math.max(placement.width, previewSize!.width) : placement.width;

    // Determine if the expanded section must open downward to stay on-screen
    const normalTop = axisY - CARD_HEIGHT - CARD_GAP - row * (CARD_HEIGHT + CARD_GAP);
    const expandsDown = isExpanded && normalTop - expandedHeight < 0;
    const cardTop = isExpanded && !expandsDown ? normalTop - expandedHeight : normalTop;

    const cardEl = document.createElement('div');
    cardEl.className = 'event-card'
      + (card.isFuture ? ' is-future' : '')
      + (isExpanded ? ' is-expanded' : '');
    cardEl.dataset.filename = card.event.filename;
    cardEl.style.left = `${card.x - width / 2}px`;
    cardEl.style.width = `${width}px`;
    cardEl.style.top = `${cardTop}px`;
    cardEl.style.setProperty('--weekday-color', weekdayColor(card.event.date));
    if (card.event.color) cardEl.style.setProperty('--weekday-color', card.event.color);

    // Build expanded content section
    let expEl: HTMLElement | null = null;
    if (isExpanded) {
      expEl = document.createElement('div');
      expEl.className = 'event-card-expanded' + (expandsDown ? ' expands-down' : '');
      expEl.style.height = `${expandedHeight}px`;

      const expBody = document.createElement('div');
      expBody.className = 'exp-body markdown-body';
      expBody.dataset.baseDir = 'events';
      if (expansion?.body != null) {
        expBody.innerHTML = md.render(expansion.body);
        fixImageUrls(expBody, 'events');
      } else {
        expBody.innerHTML = '<span class="exp-loading">Loading…</span>';
      }
      expEl.appendChild(expBody);
    }

    // Card face: color bar + body
    const header = document.createElement('div');
    header.className = 'event-card-header';

    const body = document.createElement('div');
    body.className = 'event-card-body';

    // Title row: title text + icon action buttons (buttons hidden when collapsed via CSS)
    const titleRow = document.createElement('div');
    titleRow.className = 'event-card-title-row';

    const title = document.createElement('div');
    title.className = 'event-card-title';
    title.textContent = card.event.title;
    titleRow.appendChild(title);

    const actionsEl = document.createElement('div');
    actionsEl.className = 'event-card-actions';
    actionsEl.innerHTML = `
      <button class="event-card-action-btn event-card-action-btn--danger" data-action="delete" title="Delete">${ICON_DELETE}</button>
      <button class="event-card-action-btn event-card-action-btn--primary" data-action="edit" title="Edit">${ICON_EDIT}</button>
    `;
    titleRow.appendChild(actionsEl);
    body.appendChild(titleRow);

    const dateChip = document.createElement('div');
    dateChip.className = 'event-card-date';
    dateChip.textContent = formatCardFace(parseISOString(card.event.date));
    body.appendChild(dateChip);

    // Tags row: shown only when expanded (CSS hides when collapsed)
    if (card.event.tags && card.event.tags.length > 0) {
      const tagsEl = document.createElement('div');
      tagsEl.className = 'event-card-tags';
      tagsEl.innerHTML = card.event.tags.map(t => `<span class="event-card-tag">${esc(t)}</span>`).join('');
      body.appendChild(tagsEl);
    }

    // Append in correct order depending on expansion direction
    if (isExpanded && expEl && !expandsDown) {
      cardEl.appendChild(expEl);
    }
    cardEl.appendChild(header);
    cardEl.appendChild(body);
    if (isExpanded && expEl && expandsDown) {
      cardEl.appendChild(expEl);
    }

    if (isExpanded && expEl) {
      attachResizeHandles(cardEl, expEl, card.x, expandsDown);
    }

    // Connector line from card bottom to axis
    const connector = document.createElement('div');
    connector.className = 'event-card-connector';
    connector.dataset.filename = card.event.filename;
    connector.style.left = `${card.x}px`;
    connector.style.top = `${axisY - CARD_GAP - row * (CARD_HEIGHT + CARD_GAP)}px`;
    connector.style.height = `${CARD_GAP + row * (CARD_HEIGHT + CARD_GAP)}px`;
    container.appendChild(connector);

    // Anchor dot on the axis
    const dot = document.createElement('div');
    dot.className = 'event-card-dot';
    dot.dataset.filename = card.event.filename;
    dot.style.left = `${card.x}px`;
    dot.style.top = `${axisY}px`;
    container.appendChild(dot);

    container.appendChild(cardEl);
  }
}
