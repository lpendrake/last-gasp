import { parseISOString } from '../calendar/golarian';
import type { Event, EventFrontmatter } from '../data/types';
import { ThemeProvider } from '../../theme';
import {
  extractWikiLinkIds,
  syncEntityTags,
  isSessionTag,
  isValidCustomTag,
  formatEntityTag,
  resolveEntityTagLabel,
} from '../../../shared/entity-tags';

export interface EditorBuffer {
  title: string;
  date: string;
  tagsText: string;
  color: string;
  body: string;
  id?: string;
  tagLabelOverride: string;
  linkLabelOverride: string;
  systemTags: string[];
}

export type EditorMode =
  | { kind: 'create'; initialDate?: string }
  | { kind: 'edit'; filename: string };

export type { ColorPreset } from '../../theme';

export function emptyBuffer(initialDate?: string): EditorBuffer {
  return {
    title: '',
    date: initialDate ?? '',
    tagsText: '',
    color: '',
    body: '',
    tagLabelOverride: '',
    linkLabelOverride: '',
    systemTags: [],
  };
}

export function bufferFromEvent(ev: Event): EditorBuffer {
  return {
    title: ev.title,
    date: ev.date,
    tagsText: (ev.tags ?? []).filter(isValidCustomTag).join(', '),
    color: ev.color ?? '',
    body: ev.body,
    id: ev.id,
    tagLabelOverride: ev.tagLabelOverride ?? '',
    linkLabelOverride: ev.linkLabelOverride ?? '',
    systemTags: (ev.tags ?? []).filter(isSessionTag),
  };
}

export function parseTagsText(tagsText: string): string[] {
  return tagsText
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

export function hasReservedTagPrefix(tagsText: string): boolean {
  return parseTagsText(tagsText).some((t) => !isValidCustomTag(t));
}

export function addTagsToText(currentText: string, input: string): string {
  const existing = new Set(parseTagsText(currentText));
  const toAdd = parseTagsText(input)
    .filter(isValidCustomTag)
    .filter((t) => !existing.has(t));
  if (toAdd.length === 0) return currentText;
  return [...parseTagsText(currentText), ...toAdd].join(', ');
}

export function removeTagFromText(currentText: string, tag: string): string {
  return parseTagsText(currentText)
    .filter((t) => t !== tag)
    .join(', ');
}

export function bufferToFrontmatter(buf: EditorBuffer): EventFrontmatter {
  const tags = parseTagsText(buf.tagsText).filter(isValidCustomTag);
  const linkedIds = extractWikiLinkIds(buf.body);
  const syncedTags = syncEntityTags(tags, linkedIds);
  const allTags = [...syncedTags, ...buf.systemTags];
  const fm: EventFrontmatter = {
    title: buf.title.trim(),
    date: buf.date.trim(),
  };
  if (allTags.length > 0) fm.tags = allTags;
  if (buf.color) fm.color = buf.color;
  if (buf.id) fm.id = buf.id;
  if (buf.tagLabelOverride.trim()) fm.tagLabelOverride = buf.tagLabelOverride.trim();
  if (buf.linkLabelOverride.trim()) fm.linkLabelOverride = buf.linkLabelOverride.trim();
  return fm;
}

export function validateBuffer(buf: EditorBuffer): string | null {
  if (!buf.title.trim()) return 'Title is required.';
  if (!buf.date.trim()) return 'Date is required.';
  try {
    parseISOString(buf.date.trim());
  } catch (err: unknown) {
    return `Date is not a valid Golarian date: ${err instanceof Error ? err.message : String(err)}`;
  }
  return null;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function deriveFilename(buf: EditorBuffer): string {
  const dateOnly = buf.date.trim().slice(0, 10);
  const slug = slugify(buf.title);
  return `${dateOnly}-${slug || 'event'}.md`;
}

/** Returns the <select> value for the color field (or '__custom__' for non-preset hex). */
export function getColorPresetValue(color: string): string {
  if (!color) return '';
  const presets = ThemeProvider.get().timeline.eventColorPresets;
  if (presets.some((p) => p.value === color && p.value !== '__custom__')) return color;
  return '__custom__';
}

export interface TagChip {
  raw: string;
  display: string;
  isEntity: boolean;
}

export function buildTagChips(
  tagsText: string,
  body: string,
  entityTagLabelMap: Map<string, string>,
  systemTags: string[] = [],
): TagChip[] {
  const customChips = parseTagsText(tagsText).map((t) => ({ raw: t, display: t, isEntity: false }));
  const sysChips = systemTags.map((t) => ({ raw: t, display: t, isEntity: false }));
  const entityChips = extractWikiLinkIds(body).map((id) => {
    const raw = formatEntityTag(id);
    const { display } = resolveEntityTagLabel(raw, entityTagLabelMap);
    return { raw, display, isEntity: true };
  });
  return [...customChips, ...sysChips, ...entityChips];
}
