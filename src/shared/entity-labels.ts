import type { EntityIndexEntry, EntityIndexDelta } from '../types/global';

export function effectiveTagLabel(entry: EntityIndexEntry): string {
  return entry.tagLabelOverride ?? entry.title;
}

export function effectiveLinkLabel(entry: EntityIndexEntry): string {
  return entry.linkLabelOverride ?? entry.title;
}

export function buildEntityLabelMap(entityIndex: readonly EntityIndexEntry[]): Map<string, string> {
  return new Map(entityIndex.map((e) => [e.id, effectiveLinkLabel(e)]));
}

export function applyEntityDelta(
  index: readonly EntityIndexEntry[],
  delta: EntityIndexDelta,
): EntityIndexEntry[] {
  if (delta.op === 'add' || delta.op === 'update') {
    const { entry } = delta;
    return [...index.filter((e) => e.id !== entry.id && e.path !== entry.path), entry];
  }
  return index.filter((e) => e.path !== delta.path);
}
