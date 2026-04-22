/**
 * Client-side draft persistence to localStorage.
 *
 * Contract (from PLAN §4.5.2):
 * - One key per editor target: `draft:<filename>` for existing events,
 *   `draft:new:<creationStamp>` for a fresh buffer that has no filename yet.
 * - Persists full editor buffer (title, date, tags, color, status, body).
 * - Written debounced (~500ms) on every change. No server round-trip.
 * - Restored on reopen if the draft's `savedAt` is newer than the file's
 *   last-known mtime (so a draft left behind before a save-on-disk happened
 *   is suppressed).
 * - Cleared on successful save or explicit discard.
 */
import type { EventFrontmatter } from '../data/types.ts';

export interface DraftBuffer {
  title: string;
  date: string;
  tagsText: string;         // raw textarea string — kept verbatim, parsed on save
  color: string;            // '' means unset
  status: '' | 'happened' | 'planned';
  body: string;
}

export interface DraftRecord {
  buffer: DraftBuffer;
  savedAt: string;          // ISO timestamp of the browser's local save
  /** The file's Last-Modified at the time the editor was opened; used on restore
   *  to decide whether this draft is still relevant. */
  baseMtime: string | null;
}

export type DraftKey = { kind: 'existing'; filename: string } | { kind: 'new'; stamp: string };

const PREFIX = 'draft:';

function storageKey(k: DraftKey): string {
  return k.kind === 'existing' ? `${PREFIX}${k.filename}` : `${PREFIX}new:${k.stamp}`;
}

export function loadDraft(k: DraftKey): DraftRecord | null {
  try {
    const raw = localStorage.getItem(storageKey(k));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftRecord;
    if (!parsed.buffer || typeof parsed.savedAt !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeDraft(k: DraftKey, buffer: DraftBuffer, baseMtime: string | null): void {
  try {
    const rec: DraftRecord = {
      buffer,
      savedAt: new Date().toISOString(),
      baseMtime,
    };
    localStorage.setItem(storageKey(k), JSON.stringify(rec));
  } catch {
    // Quota / private mode — swallow silently; the buffer is still in memory.
  }
}

export function clearDraft(k: DraftKey): void {
  try {
    localStorage.removeItem(storageKey(k));
  } catch {
    // ignore
  }
}

/**
 * Decide whether a draft is relevant to the current file on disk.
 * Returns true if the draft exists and is newer than (or has no known) the
 * file's last-modified mtime captured when the file was opened.
 */
export function draftIsRelevant(draft: DraftRecord, fileLastModified: string | null): boolean {
  if (!fileLastModified) return true;
  const draftMs = Date.parse(draft.savedAt);
  const fileMs = Date.parse(fileLastModified);
  if (Number.isNaN(draftMs) || Number.isNaN(fileMs)) return true;
  return draftMs > fileMs;
}

/** Create a debouncer that batches rapid calls into one trailing invocation. */
export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delayMs: number,
): (...args: Args) => void {
  let handle: ReturnType<typeof setTimeout> | null = null;
  return (...args) => {
    if (handle) clearTimeout(handle);
    handle = setTimeout(() => {
      handle = null;
      fn(...args);
    }, delayMs);
  };
}

/** Format a draft's saved time as "HH:MM" local for the restore prompt. */
export function formatDraftTime(rec: DraftRecord): string {
  const d = new Date(rec.savedAt);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Build a DraftBuffer from existing event frontmatter + body. */
export function bufferFromEvent(ev: {
  title: string;
  date: string;
  tags?: string[];
  color?: string;
  status?: 'happened' | 'planned';
  body: string;
}): DraftBuffer {
  return {
    title: ev.title,
    date: ev.date,
    tagsText: (ev.tags ?? []).join(', '),
    color: ev.color ?? '',
    status: ev.status ?? '',
    body: ev.body,
  };
}

/** Parse the tags textarea into a clean array — splits on commas/newlines,
 *  trims, drops empties and duplicates, preserves insertion order. */
export function parseTagsText(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/[,\n]/)) {
    const t = raw.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** Convert a buffer into a frontmatter object suitable for the API. */
export function bufferToFrontmatter(b: DraftBuffer): EventFrontmatter {
  const fm: EventFrontmatter = { title: b.title.trim(), date: b.date.trim() };
  const tags = parseTagsText(b.tagsText);
  if (tags.length > 0) fm.tags = tags;
  if (b.color.trim()) fm.color = b.color.trim();
  if (b.status) fm.status = b.status;
  return fm;
}
