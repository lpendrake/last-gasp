import type { EventListItem, Palette } from '../data/types';
import type { ViewState, ViewportSize } from '../math/zoom';
import { secondsToX } from '../math/zoom';
import { parseISOString, toAbsoluteSeconds, weekdayIndex } from '../calendar/golarian';

export const CARD_HEIGHT = 64;
export const CARD_GAP = 24;
export const CARD_PADDING_X = 12;

export interface LaidOutCard {
  event: EventListItem;
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

export function weekdayColorFromPalette(isoDate: string, palette: Palette): string {
  const date = parseISOString(isoDate);
  const idx = weekdayIndex(date);
  return palette.weekdays[WEEKDAY_KEYS[idx]];
}

export function layoutCards(
  events: EventListItem[],
  view: ViewState,
  size: ViewportSize,
  inGameNowSeconds: number,
): LaidOutCard[] {
  return events.map((ev) => {
    const seconds = toAbsoluteSeconds(parseISOString(ev.date));
    return {
      event: ev,
      seconds,
      x: secondsToX(seconds, view, size),
      isFuture: seconds > inGameNowSeconds,
    };
  });
}

export function assignRows(laidOut: LaidOutCard[]): Map<string, CardPlacement> {
  const rows: { left: number; right: number }[][] = [];
  const sorted = [...laidOut].sort((a, b) => a.x - b.x);
  const placements = new Map<string, CardPlacement>();

  for (const card of sorted) {
    const estWidth = Math.max(120, Math.min(360, card.event.title.length * 8 + CARD_PADDING_X * 2));
    const left = card.x - estWidth / 2;
    const right = card.x + estWidth / 2;

    let row = 0;
    while (true) {
      if (!rows[row]) rows[row] = [];
      const overlaps = rows[row].some((o) => !(right < o.left || left > o.right));
      if (!overlaps) {
        rows[row].push({ left, right });
        break;
      }
      row++;
    }
    placements.set(card.event.filename, { row, width: estWidth });
  }

  return placements;
}
