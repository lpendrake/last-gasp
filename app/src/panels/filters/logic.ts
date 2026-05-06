import type { EventListItem } from '../../data/types.ts';
import { parseISOString, toAbsoluteSeconds } from '../../calendar/golarian.ts';
import type {
  DateField, TagFilter, DateFilter, Filter, FilterState,
} from './types.ts';

export function makeInitialFilterState(): FilterState {
  return { filters: [] };
}

// ---- Pure filtering ----

/** Events match iff every enabled filter matches. Empty state matches all. */
export function applyFilters(events: EventListItem[], state: FilterState): EventListItem[] {
  const active = state.filters.filter(f => f.enabled);
  if (active.length === 0) return events.slice();
  return events.filter(ev => active.every(f => matchesFilter(ev, f)));
}

export function matchesFilter(event: EventListItem, filter: Filter): boolean {
  if (filter.type === 'tag') return matchesTagFilter(event, filter);
  return matchesDateFilter(event, filter);
}

function matchesTagFilter(event: EventListItem, filter: TagFilter): boolean {
  if (filter.tags.length === 0) return true; // vacuous — editor should disallow but be safe
  const eventTags = new Set(event.tags ?? []);
  return filter.tags.some(t => eventTags.has(t));
}

function matchesDateFilter(event: EventListItem, filter: DateFilter): boolean {
  if (!filter.from && !filter.to) return true;

  if (filter.field === 'in-game') {
    const sec = toAbsoluteSeconds(parseISOString(event.date));
    const fromSec = filter.from ? toAbsoluteSeconds(parseISOString(filter.from)) : null;
    const toSec = filter.to ? toAbsoluteSeconds(parseISOString(filter.to)) + 86400 : null;
    if (fromSec !== null && sec < fromSec) return false;
    if (toSec !== null && sec >= toSec) return false;
    return true;
  }

  if (filter.field === 'session') {
    // Parse session tags: "session:YYYY-MM-DD" → real-world day string.
    const sessionDates = (event.tags ?? [])
      .filter(t => t.startsWith('session:'))
      .map(t => t.slice('session:'.length));
    if (sessionDates.length === 0) return false;
    return sessionDates.some(d => withinDayRange(d, filter.from, filter.to));
  }

  // creation — real-world mtime
  const mtimeDay = toUTCDateOnly(event.mtime);
  return withinDayRange(mtimeDay, filter.from, filter.to);
}

function withinDayRange(day: string, from: string | null, to: string | null): boolean {
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

function toUTCDateOnly(isoOrRFC: string): string {
  // mtime arrives as RFC2822 (from Last-Modified) or ISO. Both parse via Date.
  const d = new Date(isoOrRFC);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// ---- Summaries ----

export function filterSummary(f: Filter): string {
  if (f.type === 'tag') {
    if (f.tags.length === 0) return '(no tags selected)';
    return 'Tags: ' + f.tags.join(' OR ');
  }
  const label = f.field === 'in-game' ? 'In-game'
             : f.field === 'session' ? 'Session'
             : 'Created';
  if (!f.from && !f.to) return `${label}: (any)`;
  if (f.from && f.to) return `${label}: ${f.from} → ${f.to}`;
  if (f.from) return `${label}: ≥ ${f.from}`;
  return `${label}: ≤ ${f.to}`;
}

// ---- ID helper ----

export function newFilterId(): string {
  return 'f_' + Math.random().toString(36).slice(2, 10);
}

// ---- Tag universe (for fuzzy pick) ----

export function collectAllTags(events: EventListItem[]): string[] {
  const s = new Set<string>();
  for (const ev of events) for (const t of ev.tags ?? []) s.add(t);
  return [...s].sort();
}

/** Returns the default "now" YYYY-MM-DD for a given date-filter field. */
export function nowForField(field: DateField, inGameNow: string, realWorldNow: string): string {
  const source = field === 'in-game' ? inGameNow : realWorldNow;
  return source.slice(0, 10);
}
