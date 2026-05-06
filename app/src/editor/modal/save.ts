import { createEvent, updateEvent, deleteEvent } from '../../data/http/events.http.ts';
import { ApiError } from '../../data/http/client.ts';
import type { EventWithMtime } from '../../data/ports.ts';
import { clearDraft, bufferToFrontmatter, type DraftBuffer, type DraftKey } from '../drafts.ts';
import { showConflictModal } from '../conflict.ts';
import { parseISOString } from '../../calendar/golarian.ts';
import type { Mode } from './view.ts';

export type SaveState = 'clean' | 'dirty' | 'saving' | 'error' | 'saved';

export interface EditorResult {
  /** 'saved' when a file was written; 'deleted' when the file moved to trash;
   *  'cancelled' when the user closed without persisting. */
  status: 'saved' | 'deleted' | 'cancelled';
  filename?: string;
}

export const SAVED_BANNER_MS = 900;

/** Context bundle threaded through all save-flow operations. */
export interface SaveCtx {
  mode: Mode;
  extraValidate?: (b: DraftBuffer) => string | null;
  readBuffer: () => DraftBuffer;
  setState: (s: SaveState, err?: string) => void;
  finish: (r: EditorResult) => void;
  titleInput: HTMLInputElement;
  filenameRef: { current: string | null };
  mtimeRef: { current: string | null };
  draftKeyRef: { current: DraftKey };
}

export function validateBuffer(b: DraftBuffer): string | null {
  if (!b.title.trim()) return 'Title is required.';
  if (!b.date.trim()) return 'Date is required.';
  try {
    parseISOString(b.date.trim());
  } catch (err: any) {
    return `Date is not a valid Golarian date: ${err?.message ?? err}`;
  }
  return null;
}

export function deriveFilename(b: DraftBuffer): string {
  const dateOnly = b.date.trim().slice(0, 10);
  const slug = slugify(b.title);
  return `${dateOnly}-${slug || 'event'}.md`;
}

function slugify(s: string): string {
  return s.toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function newCreationStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

export function emptyBuffer(initialDate?: string, initialTags?: string): DraftBuffer {
  return {
    title: '',
    date: initialDate ?? '',
    tagsText: initialTags ?? '',
    color: '',
    status: '',
    body: '',
  };
}

export async function attemptSave(ctx: SaveCtx, overwriteConflict = false): Promise<void> {
  const buf = ctx.readBuffer();
  const validationError = validateBuffer(buf) ?? ctx.extraValidate?.(buf) ?? null;
  if (validationError) {
    ctx.setState('error', validationError);
    return;
  }

  ctx.setState('saving');

  try {
    let result: EventWithMtime;
    if (ctx.filenameRef.current && ctx.mode.kind === 'edit') {
      result = await updateEvent(
        ctx.filenameRef.current,
        bufferToFrontmatter(buf),
        buf.body,
        overwriteConflict ? '' : (ctx.mtimeRef.current ?? ''),
      );
    } else {
      const derived = deriveFilename(buf);
      result = await createEvent(derived, bufferToFrontmatter(buf), buf.body);
      // Migrate draft key: the `new:<stamp>` draft should be cleared,
      // and future auto-saves should target the existing-filename key.
      const oldKey = ctx.draftKeyRef.current;
      clearDraft(oldKey);
      ctx.draftKeyRef.current = { kind: 'existing', filename: result.filename };
      ctx.filenameRef.current = result.filename;
    }

    ctx.mtimeRef.current = result.lastModified;
    clearDraft(ctx.draftKeyRef.current);
    ctx.setState('saved');
    setTimeout(() => ctx.finish({ status: 'saved', filename: ctx.filenameRef.current! }), SAVED_BANNER_MS);
  } catch (err) {
    if (err instanceof ApiError && err.status === 409 && ctx.filenameRef.current) {
      ctx.setState('dirty');
      const choice = await showConflictModal(ctx.filenameRef.current);
      if (choice === 'overwrite') return attemptSave(ctx, true);
      // 'cancel' → stay open, buffer preserved.
      return;
    }
    ctx.setState('error', err instanceof Error ? err.message : String(err));
  }
}

export async function handleDeleteEvent(ctx: SaveCtx): Promise<void> {
  if (ctx.mode.kind !== 'edit') return;
  const filename = ctx.mode.filename;
  const ok = window.confirm(`Move "${ctx.titleInput.value || filename}" to trash?\n\nRecoverable via Settings → Trash.`);
  if (!ok) return;
  ctx.setState('saving');
  try {
    await deleteEvent(filename, ctx.mtimeRef.current ?? '');
    clearDraft(ctx.draftKeyRef.current);
    ctx.finish({ status: 'deleted', filename });
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      ctx.setState('dirty');
      const choice = await showConflictModal(filename);
      if (choice === 'overwrite') {
        try {
          await deleteEvent(filename, '');
          clearDraft(ctx.draftKeyRef.current);
          ctx.finish({ status: 'deleted', filename });
        } catch (err2) {
          ctx.setState('error', err2 instanceof Error ? err2.message : String(err2));
        }
      }
      return;
    }
    ctx.setState('error', err instanceof Error ? err.message : String(err));
  }
}

export function tryClose(state: SaveState, finish: (r: EditorResult) => void): void {
  if (state === 'dirty' || state === 'error') {
    const ok = window.confirm('You have unsaved changes — close anyway?\n\n(Your draft stays in the browser; reopening restores it.)');
    if (!ok) return;
  }
  finish({ status: 'cancelled' });
}

export function handleDiscard(draftKeyRef: { current: DraftKey }, finish: (r: EditorResult) => void): void {
  const ok = window.confirm('Discard unsaved changes and remove the draft?');
  if (!ok) return;
  clearDraft(draftKeyRef.current);
  finish({ status: 'cancelled' });
}
