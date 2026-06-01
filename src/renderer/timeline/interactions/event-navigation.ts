import { EventListItem } from '../data/types';
import { parseISOString, toAbsoluteSeconds } from '../calendar/golarian';

export interface AdjacentEvent {
  filename: string;
  seconds: number;
}

interface SortedEvent {
  filename: string;
  seconds: number;
}

function toSortedEvents(events: EventListItem[]): SortedEvent[] {
  return events
    .map((e) => ({ filename: e.filename, seconds: toAbsoluteSeconds(parseISOString(e.date)) }))
    .sort((a, b) => {
      if (a.seconds !== b.seconds) return a.seconds - b.seconds;
      return a.filename < b.filename ? -1 : a.filename > b.filename ? 1 : 0;
    });
}

export function findAdjacentEvent(
  events: EventListItem[],
  refSeconds: number,
  focusedFilename: string | null,
  dir: 'prev' | 'next',
): AdjacentEvent | null {
  if (events.length === 0) return null;

  const sorted = toSortedEvents(events);

  if (focusedFilename !== null) {
    const idx = sorted.findIndex((e) => e.filename === focusedFilename);
    if (idx !== -1) {
      const targetIdx = dir === 'next' ? idx + 1 : idx - 1;
      if (targetIdx < 0 || targetIdx >= sorted.length) return null;
      const target = sorted[targetIdx];
      return { filename: target.filename, seconds: target.seconds };
    }
  }

  // No focus or focused filename not found — use refSeconds
  if (dir === 'next') {
    const target = sorted.find((e) => e.seconds > refSeconds);
    return target ? { filename: target.filename, seconds: target.seconds } : null;
  } else {
    let target: SortedEvent | null = null;
    for (const e of sorted) {
      if (e.seconds < refSeconds) target = e;
    }
    return target ? { filename: target.filename, seconds: target.seconds } : null;
  }
}
