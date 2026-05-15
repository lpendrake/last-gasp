import type { EventListItem, Palette } from '../data/types';
import type { ViewState, ViewportSize } from '../math/zoom';
import { secondsToX } from '../math/zoom';
import {
  type GolarianDate,
  toAbsoluteSeconds,
  tryParseDate,
  weekdayIndex,
} from '../calendar/golarian';

export const CARD_HEIGHT = 64;
export const CARD_GAP = 24;
export const CARD_PADDING_X = 12;
// Cards beyond this row are hidden rather than stacking off-screen.
// At typical zoom a day spans ~200px; 8 rows already exceeds viewport height.
export const MAX_ROWS = 8;

export interface LaidOutCard {
  event: EventListItem;
  parsedDate: GolarianDate;
  x: number;
  seconds: number;
  isFuture: boolean;
}

export interface CardPlacement {
  row: number;
  width: number;
}

const WEEKDAY_KEYS: (keyof Palette['weekdays'])[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export function weekdayColorFromPalette(date: GolarianDate, palette: Palette): string {
  const idx = weekdayIndex(date);
  return palette.weekdays[WEEKDAY_KEYS[idx]];
}

export function layoutCards(
  events: EventListItem[],
  view: ViewState,
  size: ViewportSize,
  inGameNowSeconds: number,
): LaidOutCard[] {
  return events.flatMap((ev) => {
    const parsedDate = tryParseDate(ev.date);
    if (!parsedDate) return [];
    const seconds = toAbsoluteSeconds(parsedDate);
    return [
      {
        event: ev,
        parsedDate,
        seconds,
        x: secondsToX(seconds, view, size),
        isFuture: seconds > inGameNowSeconds,
      },
    ];
  });
}

export interface ExpansionLayout {
  expandsDown: boolean;
  cardTop: number;
  cardWidth: number;
}

/**
 * Compute geometry for an expanded card.
 *
 * Returns whether the expanded section opens downward (to stay on-screen),
 * the adjusted top of the card element, and the card width (at least previewWidth).
 */
export function computeExpansionLayout(
  normalTop: number,
  expandedHeight: number,
  normalWidth: number,
  previewWidth: number,
): ExpansionLayout {
  const expandsDown = normalTop - expandedHeight < 0;
  const cardTop = expandsDown ? normalTop : normalTop - expandedHeight;
  const cardWidth = Math.max(normalWidth, previewWidth);
  return { expandsDown, cardTop, cardWidth };
}

export function assignRows(laidOut: LaidOutCard[]): Map<string, CardPlacement> {
  const rows: { left: number; right: number }[][] = [];
  const sorted = [...laidOut].sort((a, b) => a.x - b.x);
  const placements = new Map<string, CardPlacement>();

  for (const card of sorted) {
    // 8px/char is a font-agnostic estimate for 15px/500-weight text. CSS
    // text-overflow:ellipsis handles the rare case where a title overflows.
    const estWidth = Math.max(120, Math.min(360, card.event.title.length * 8 + CARD_PADDING_X * 2));
    const left = card.x - estWidth / 2;
    const right = card.x + estWidth / 2;

    // O(n²) worst case — acceptable for typical campaign sizes (<200 events).
    let row = 0;
    while (row < MAX_ROWS) {
      if (!rows[row]) rows[row] = [];
      const overlaps = rows[row].some((o) => !(right < o.left || left > o.right));
      if (!overlaps) {
        rows[row].push({ left, right });
        break;
      }
      row++;
    }
    if (row < MAX_ROWS) {
      placements.set(card.event.filename, { row, width: estWidth });
    }
  }

  return placements;
}
