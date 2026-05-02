import MarkdownIt from 'markdown-it';
import type { EventListItem } from '../data/types.ts';
import { parseISOString, toAbsoluteSeconds } from '../calendar/golarian.ts';
import { formatCompactWithTime, formatExpanded } from '../calendar/format.ts';
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

function attachResizeHandles(
  cardEl: HTMLElement,
  expEl: HTMLElement,
  centerX: number,
) {
  for (const dir of ['nw', 'ne'] as const) {
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
        const newW = Math.max(200, startW + (dir === 'ne' ? dx : -dx) * 2);
        // Dragging up (negative dy) increases height
        const newH = Math.max(100, startH - dy);

        expEl.style.height = `${newH}px`;
        cardEl.style.width = `${newW}px`;
        cardEl.style.left = `${centerX - newW / 2}px`;
        cardEl.style.top = `${startTop + (startH - newH)}px`;
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        savePreviewSize({ width: cardEl.offsetWidth, expandedHeight: expEl.offsetHeight });
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
    const extraHeight = expandedHeight;

    const cardEl = document.createElement('div');
    cardEl.className = 'event-card'
      + (card.isFuture ? ' is-future' : '')
      + (isExpanded ? ' is-expanded' : '');
    cardEl.dataset.filename = card.event.filename;
    cardEl.style.left = `${card.x - width / 2}px`;
    cardEl.style.width = `${width}px`;
    cardEl.style.top = `${axisY - CARD_HEIGHT - CARD_GAP - row * (CARD_HEIGHT + CARD_GAP) - extraHeight}px`;
    cardEl.style.setProperty('--weekday-color', weekdayColor(card.event.date));
    if (card.event.color) cardEl.style.setProperty('--weekday-color', card.event.color);

    // Expanded content area (above the normal card face)
    if (isExpanded) {
      const exp = document.createElement('div');
      exp.className = 'event-card-expanded';
      exp.style.height = `${expandedHeight}px`;

      const expBody = document.createElement('div');
      expBody.className = 'exp-body markdown-body';
      expBody.dataset.baseDir = 'events';
      if (expansion?.body != null) {
        expBody.innerHTML = md.render(expansion.body);
        fixImageUrls(expBody, 'events');
      } else {
        expBody.innerHTML = '<span class="exp-loading">Loading…</span>';
      }
      exp.appendChild(expBody);

      // Footer: tags on the left, action buttons on the right
      const expFooter = document.createElement('div');
      expFooter.className = 'exp-footer';

      const expTags = document.createElement('div');
      expTags.className = 'exp-tags';
      if (card.event.tags && card.event.tags.length > 0) {
        expTags.innerHTML = card.event.tags.map(t => `<span class="exp-tag">${esc(t)}</span>`).join('');
      }
      expFooter.appendChild(expTags);

      const expBtns = document.createElement('div');
      expBtns.className = 'exp-btns';
      expBtns.innerHTML = `
        <button class="exp-btn exp-btn-danger" data-action="delete">Delete</button>
        <button class="exp-btn exp-btn-primary" data-action="edit">Edit</button>
      `;
      expFooter.appendChild(expBtns);
      exp.appendChild(expFooter);

      cardEl.appendChild(exp);
      attachResizeHandles(cardEl, exp, card.x);
    }

    const header = document.createElement('div');
    header.className = 'event-card-header';
    cardEl.appendChild(header);

    const body = document.createElement('div');
    body.className = 'event-card-body';

    const title = document.createElement('div');
    title.className = 'event-card-title';
    title.textContent = card.event.title;
    body.appendChild(title);

    const dateChip = document.createElement('div');
    dateChip.className = 'event-card-date';
    dateChip.textContent = formatCompactWithTime(parseISOString(card.event.date));
    body.appendChild(dateChip);

    cardEl.appendChild(body);

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
