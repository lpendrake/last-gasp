import type { EventListItem, Session } from '../data/types';
import { parseISOString, toAbsoluteSeconds } from '../calendar/golarian';
import { sessionTagsForSeconds } from '../render/session-bands';

export function seshTagsMatch(
  existingTags: readonly string[] | undefined,
  computed: readonly string[],
): boolean {
  const existing = (existingTags ?? []).filter((t) => t.startsWith('sesh:'));
  return existing.length === computed.length && computed.every((t) => existing.includes(t));
}

export function mergeSeshTags(
  existingTags: readonly string[] | undefined,
  computed: readonly string[],
): string[] {
  const nonSesh = (existingTags ?? []).filter((t) => !t.startsWith('sesh:'));
  return [...nonSesh, ...computed];
}

export function computeEventsNeedingSeshTagUpdate(
  events: readonly EventListItem[],
  sessions: readonly Session[],
): string[] {
  const toUpdate: string[] = [];
  for (const ev of events) {
    let secs: number;
    try {
      secs = toAbsoluteSeconds(parseISOString(ev.date));
    } catch {
      continue;
    }
    const computed = sessionTagsForSeconds(secs, sessions as Session[]);
    const existing = (ev.tags ?? []).filter((t) => t.startsWith('sesh:'));
    if (seshTagsMatch(ev.tags, computed)) continue;
    if (computed.length > 0 || existing.length > 0) toUpdate.push(ev.filename);
  }
  return toUpdate;
}
