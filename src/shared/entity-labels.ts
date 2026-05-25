import type { EntityIndexEntry } from '../types/global';

export function effectiveTagLabel(entry: EntityIndexEntry): string {
  return entry.tagLabelOverride ?? entry.title;
}

export function effectiveLinkLabel(entry: EntityIndexEntry): string {
  return entry.linkLabelOverride ?? entry.title;
}

export function buildEntityLabelMap(entityIndex: readonly EntityIndexEntry[]): Map<string, string> {
  return new Map(entityIndex.map((e) => [e.id, effectiveLinkLabel(e)]));
}
