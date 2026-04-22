import type { EventListItem } from '../data/types.ts';
import { parseISOString, toAbsoluteSeconds } from '../calendar/golarian.ts';
import { formatCompact } from '../calendar/format.ts';
import { weekdayColor } from '../theme.ts';
import { type ViewState, type ViewportSize, secondsToX } from './zoom.ts';

export interface LaidOutCard {
  event: EventListItem;
  x: number;
  seconds: number;
  isFuture: boolean;
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
const CARD_GAP = 6;
const CARD_PADDING_X = 12;

/**
 * Render collapsed cards anchored to their datetime on the axis.
 * Cards that overlap horizontally stack vertically (newest-created on top).
 */
export function renderCards(
  container: HTMLElement,
  laidOut: LaidOutCard[],
  size: ViewportSize,
): void {
  container.innerHTML = '';

  const axisY = Math.floor(size.height * 0.8);

  // Stacking: for each card, find an available row above the axis.
  // "Occupied" means the card's x-range overlaps another card's x-range in the same row.
  const rows: { left: number; right: number }[][] = [];

  // Sort by x so we process left-to-right (simpler stacking)
  const sorted = [...laidOut].sort((a, b) => a.x - b.x);
  const placements = new Map<EventListItem, { row: number; width: number }>();

  for (const card of sorted) {
    // We don't know card width until we measure — use a heuristic: 20px per character of title
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

  for (const card of laidOut) {
    const placement = placements.get(card.event)!;
    const { row, width } = placement;

    const cardEl = document.createElement('div');
    cardEl.className = 'event-card' + (card.isFuture ? ' is-future' : '');
    cardEl.dataset.filename = card.event.filename;
    cardEl.style.left = `${card.x - width / 2}px`;
    cardEl.style.width = `${width}px`;
    cardEl.style.top = `${axisY - CARD_HEIGHT - CARD_GAP - row * (CARD_HEIGHT + CARD_GAP)}px`;
    cardEl.style.setProperty('--weekday-color', weekdayColor(card.event.date));
    if (card.event.color) {
      cardEl.style.setProperty('--weekday-color', card.event.color);
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
    dateChip.textContent = formatCompact(parseISOString(card.event.date));
    body.appendChild(dateChip);

    cardEl.appendChild(body);

    // Connector line from card bottom to axis
    const connector = document.createElement('div');
    connector.className = 'event-card-connector';
    connector.style.left = `${card.x}px`;
    connector.style.top = `${axisY - CARD_GAP - row * (CARD_HEIGHT + CARD_GAP)}px`;
    connector.style.height = `${CARD_GAP + row * (CARD_HEIGHT + CARD_GAP)}px`;
    container.appendChild(connector);

    // Anchor dot on the axis
    const dot = document.createElement('div');
    dot.className = 'event-card-dot';
    dot.style.left = `${card.x}px`;
    dot.style.top = `${axisY}px`;
    container.appendChild(dot);

    container.appendChild(cardEl);
  }
}
