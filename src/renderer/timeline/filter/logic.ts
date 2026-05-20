import type { EventListItem, Session } from '../data/types';
import { parseISOString, toAbsoluteSeconds } from '../calendar/golarian';
import { computeSessionLabel } from '../render/session-bands';
import type { DateField, TagFilter, DateFilter, Filter, FilterState } from './types';

export function makeInitialFilterState(): FilterState {
  return { filters: [] };
}

export function applyFilters(
  events: EventListItem[],
  state: FilterState,
  sessions: Session[] = [],
): EventListItem[] {
  const active = state.filters.filter((f) => f.enabled);
  if (active.length === 0) return events.slice();
  return events.filter((ev) => active.every((f) => matchesFilter(ev, f, sessions)));
}

export function matchesFilter(
  event: EventListItem,
  filter: Filter,
  sessions: Session[] = [],
): boolean {
  if (filter.type === 'tag') return matchesTagFilter(event, filter);
  return matchesDateFilter(event, filter, sessions);
}

function matchesTagFilter(event: EventListItem, filter: TagFilter): boolean {
  if (filter.tags.length === 0) return true;
  const eventTags = new Set(event.tags ?? []);
  return filter.tags.some((t) => eventTags.has(t));
}

function matchesDateFilter(event: EventListItem, filter: DateFilter, sessions: Session[]): boolean {
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
    const seshTags = new Set((event.tags ?? []).filter((t) => t.startsWith('sesh:')));
    if (seshTags.size === 0) return false;
    for (const session of sessions) {
      const label = computeSessionLabel(session, sessions);
      if (!seshTags.has(`sesh:${label}`)) continue;
      const realDate = session.realStart.slice(0, 10);
      if (withinDayRange(realDate, filter.from, filter.to)) return true;
    }
    return false;
  }

  // creation — real-world mtime
  const mtimeDay = toUTCDateOnly(event.mtime);
  if (!mtimeDay) return false;
  return withinDayRange(mtimeDay, filter.from, filter.to);
}

function withinDayRange(day: string, from: string | null, to: string | null): boolean {
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

function toUTCDateOnly(isoOrRFC: string): string {
  const d = new Date(isoOrRFC);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function filterSummary(f: Filter): string {
  if (f.type === 'tag') {
    if (f.tags.length === 0) return '(no tags selected)';
    return 'Tags: ' + f.tags.join(' OR ');
  }
  const label = f.field === 'in-game' ? 'In-game' : f.field === 'session' ? 'Session' : 'Created';
  if (!f.from && !f.to) return `${label}: (any)`;
  if (f.from && f.to) return `${label}: ${f.from} → ${f.to}`;
  if (f.from) return `${label}: ≥ ${f.from}`;
  return `${label}: ≤ ${f.to}`;
}

export function newFilterId(): string {
  return 'f_' + Math.random().toString(36).slice(2, 10);
}

export function collectAllTags(events: EventListItem[]): string[] {
  const s = new Set<string>();
  for (const ev of events) for (const t of ev.tags ?? []) s.add(t);
  return [...s].sort();
}

export function nowForField(field: DateField, inGameNow: string, realWorldNow: string): string {
  const source = field === 'in-game' ? inGameNow : realWorldNow;
  return source.slice(0, 10);
}
