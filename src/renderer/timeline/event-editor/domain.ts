import { parseISOString } from '../calendar/golarian';
import type { Event, EventFrontmatter } from '../data/types';

export interface EditorBuffer {
  title: string;
  date: string;
  tagsText: string;
  color: string;
  body: string;
  id?: string;
}

export type EditorMode =
  | { kind: 'create'; initialDate?: string }
  | { kind: 'edit'; filename: string };

export interface ColorPreset {
  label: string;
  value: string;
}

export const COLOR_PRESETS: ColorPreset[] = [
  { label: 'Default (weekday)', value: '' },
  { label: '■ Crimson', value: '#a83030' },
  { label: '■ Amber', value: '#b87030' },
  { label: '■ Gold', value: '#c09820' },
  { label: '■ Forest', value: '#3d7a38' },
  { label: '■ Teal', value: '#287868' },
  { label: '■ Blue', value: '#2858a0' },
  { label: '■ Indigo', value: '#483898' },
  { label: '■ Violet', value: '#783888' },
  { label: '■ Rose', value: '#a03068' },
  { label: '■ Slate', value: '#505870' },
  { label: 'Custom…', value: '__custom__' },
];

export function emptyBuffer(initialDate?: string): EditorBuffer {
  return { title: '', date: initialDate ?? '', tagsText: '', color: '', body: '' };
}

export function bufferFromEvent(ev: Event): EditorBuffer {
  return {
    title: ev.title,
    date: ev.date,
    tagsText: (ev.tags ?? []).join(', '),
    color: ev.color ?? '',
    body: ev.body,
    id: ev.id,
  };
}

export function bufferToFrontmatter(buf: EditorBuffer): EventFrontmatter {
  const tags = buf.tagsText
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  const fm: EventFrontmatter = {
    title: buf.title.trim(),
    date: buf.date.trim(),
  };
  if (tags.length > 0) fm.tags = tags;
  if (buf.color) fm.color = buf.color;
  if (buf.id) fm.id = buf.id;
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
  if (COLOR_PRESETS.some((p) => p.value === color && p.value !== '__custom__')) return color;
  return '__custom__';
}
