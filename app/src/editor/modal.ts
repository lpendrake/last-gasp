/**
 * Event editor modal — create & edit modes.
 *
 * Durability features (PLAN §4.5):
 *   - localStorage draft auto-save on every change, debounced ~500ms.
 *   - Restore prompt when reopening a buffer that's newer than the file on disk.
 *   - Save-state UI (clean / dirty / saving / error / saved).
 *   - 409 conflict modal routed through ./conflict.ts.
 *   - beforeunload guard while dirty.
 *   - Delete = soft-delete (server moves file to .trash/).
 */
import MarkdownIt from 'markdown-it';
import { getEvent, createEvent, updateEvent, deleteEvent } from '../data/http/events.http.ts';
import { ApiError } from '../data/http/client.ts';
import type { EventWithMtime } from '../data/ports.ts';
import {
  loadDraft, writeDraft, clearDraft, draftIsRelevant, debounce,
  bufferFromEvent, bufferToFrontmatter,
  type DraftBuffer, type DraftKey,
} from './drafts.ts';
import { showConflictModal } from './conflict.ts';
import { attachLinkPicker } from './link-picker.ts';
import { attachFormatToolbar } from './format-toolbar.ts';
import { parseISOString } from '../calendar/golarian.ts';
import { type Mode, editorHtml, promptRestoreDraft } from './modal/view.ts';
import {
  getColor, setColor, readBuffer, updatePreview, updateColorSwatch,
} from './modal/fields.ts';

// html: true so <u> underline and other inline HTML render in preview (local single-user app)
const md = new MarkdownIt({ html: true, linkify: true, breaks: false });

export interface EditorResult {
  /** 'saved' when a file was written; 'deleted' when the file moved to trash;
   *  'cancelled' when the user closed without persisting. */
  status: 'saved' | 'deleted' | 'cancelled';
  filename?: string;
}

const DRAFT_DEBOUNCE_MS = 500;
const SAVED_BANNER_MS = 900;

type SaveState = 'clean' | 'dirty' | 'saving' | 'error' | 'saved';

export interface EditorOpts {
  initialDate?: string;
  initialTags?: string;
  /** Called just before every save attempt; return an error string to block. */
  extraValidate?: (buffer: DraftBuffer) => string | null;
}

/** Open the editor in create mode. */
export function openCreateEditor(opts: EditorOpts = {}): Promise<EditorResult> {
  return runEditor({ kind: 'create' }, opts);
}

/** Open the editor in edit mode for an existing event. */
export function openEditEditor(filename: string, opts: EditorOpts = {}): Promise<EditorResult> {
  return runEditor({ kind: 'edit', filename }, opts);
}

async function runEditor(mode: Mode, opts: EditorOpts = {}): Promise<EditorResult> {
  const { initialDate, initialTags, extraValidate } = opts;
  // Deferred-style resolver so the many handlers below can call `finish`
  // without being nested inside a Promise executor.
  let resolveResult!: (r: EditorResult) => void;
  const resultPromise = new Promise<EditorResult>(r => { resolveResult = r; });

  // ---- Resolve draft key + initial buffer + mtime ----
  let baseMtime: string | null = null;
  let initialBuffer: DraftBuffer;
  let draftKey: DraftKey = mode.kind === 'edit'
    ? { kind: 'existing', filename: mode.filename }
    : { kind: 'new', stamp: newCreationStamp() };

  if (mode.kind === 'edit') {
    // initialDate / initialTags not used in edit mode
    const full = await getEvent(mode.filename);
    baseMtime = full.lastModified;
    initialBuffer = bufferFromEvent(full);
  } else {
    initialBuffer = emptyBuffer(initialDate, initialTags);
  }

  const existingDraft = loadDraft(draftKey);
  let restoredFromDraft = false;
  if (existingDraft && draftIsRelevant(existingDraft, baseMtime)) {
    const choice = await promptRestoreDraft(existingDraft.savedAt);
    if (choice === 'restore') {
      initialBuffer = existingDraft.buffer;
      restoredFromDraft = true;
    } else if (choice === 'discard') {
      clearDraft(draftKey);
    }
    // 'cancel' leaves the draft alone and uses the on-disk buffer.
  }

  // ---- Build DOM ----
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay editor-overlay';

  const panel = document.createElement('div');
  panel.className = 'editor-panel';
  panel.innerHTML = editorHtml(mode);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  const q = <T extends HTMLElement>(sel: string) => panel.querySelector(sel) as T;
  const titleInput    = q<HTMLInputElement>('[name=title]');
  const dateInput     = q<HTMLInputElement>('[name=date]');
  const tagsInput     = q<HTMLInputElement>('[name=tags]');
  const colorPreset   = q<HTMLSelectElement>('[name=color-preset]');
  const colorCustom   = q<HTMLInputElement>('[name=color-custom]');
  const colorSwatch   = q<HTMLSpanElement>('.editor-color-swatch');
  const bodyInput     = q<HTMLTextAreaElement>('[name=body]');
  const preview       = q<HTMLDivElement>('.editor-preview');
  const saveBtn       = q<HTMLButtonElement>('.editor-save');
  const discardBtn    = q<HTMLButtonElement>('.editor-discard');
  const deleteBtn     = panel.querySelector('.editor-delete') as HTMLButtonElement | null;
  const closeBtn      = q<HTMLButtonElement>('.editor-close');
  const statusBanner  = q<HTMLDivElement>('.editor-status');
  const errorBanner   = q<HTMLDivElement>('.editor-error');
  const errorMsgEl    = q<HTMLSpanElement>('.editor-error-message');
  const retryBtn      = q<HTMLButtonElement>('.editor-retry');

  preview.dataset.baseDir = 'events';
  const { detach: detachLinkPicker, openForSelection } = attachLinkPicker(bodyInput);
  const detachFormatToolbar = attachFormatToolbar(bodyInput, openForSelection);

  // ---- Apply initial buffer ----
  titleInput.value = initialBuffer.title;
  dateInput.value  = initialBuffer.date;
  tagsInput.value  = initialBuffer.tagsText;
  setColor(colorPreset, colorCustom, initialBuffer.color);
  bodyInput.value  = initialBuffer.body;
  updatePreview(preview, md, bodyInput);
  updateColorSwatch(colorSwatch, dateInput, colorPreset, colorCustom);

  // ---- State ----
  let state: SaveState = restoredFromDraft ? 'dirty' : 'clean';
  let filenameCurrent: string | null = mode.kind === 'edit' ? mode.filename : null;
  let baseMtimeCurrent: string | null = baseMtime;
  renderState();

  function setState(s: SaveState, err?: string) {
    state = s;
    renderState(err);
  }

  function renderState(err?: string) {
    saveBtn.disabled = state === 'clean' || state === 'saving' || state === 'saved';
    statusBanner.className = `editor-status is-${state}`;
    statusBanner.textContent =
      state === 'clean'  ? '' :
      state === 'dirty'  ? '• unsaved' :
      state === 'saving' ? 'saving…' :
      state === 'saved'  ? '✓ saved' :
      '';
    if (state === 'error' && err) {
      errorBanner.hidden = false;
      errorMsgEl.textContent = err;
    } else if (state !== 'error') {
      errorBanner.hidden = true;
    }
  }

  // ---- Debounced draft autosave ----
  const writeDraftDebounced = debounce(() => {
    if (state === 'clean' || state === 'saved') return;
    writeDraft(draftKey, readBuffer(titleInput, dateInput, tagsInput, colorPreset, colorCustom, bodyInput), baseMtimeCurrent);
  }, DRAFT_DEBOUNCE_MS);

  function onInput() {
    if (state !== 'saving') setState('dirty');
    writeDraftDebounced();
  }

  for (const el of [titleInput, dateInput, tagsInput, bodyInput]) {
    el.addEventListener('input', onInput);
  }
  colorPreset.addEventListener('change', () => {
    colorCustom.hidden = colorPreset.value !== '__custom__';
    if (colorPreset.value === '__custom__') colorCustom.focus();
    onInput();
    updateColorSwatch(colorSwatch, dateInput, colorPreset, colorCustom);
  });
  colorCustom.addEventListener('input', () => { onInput(); updateColorSwatch(colorSwatch, dateInput, colorPreset, colorCustom); });
  dateInput.addEventListener('input', () => updateColorSwatch(colorSwatch, dateInput, colorPreset, colorCustom));
  bodyInput.addEventListener('input', () => updatePreview(preview, md, bodyInput));

  // ---- Save flow ----
  async function attemptSave(overwriteConflict = false): Promise<void> {
    const buf = readBuffer(titleInput, dateInput, tagsInput, colorPreset, colorCustom, bodyInput);
    const validationError = validateBuffer(buf) ?? extraValidate?.(buf) ?? null;
    if (validationError) {
      setState('error', validationError);
      return;
    }

    setState('saving');

    try {
      let result: EventWithMtime;
      if (filenameCurrent && mode.kind === 'edit') {
        result = await updateEvent(
          filenameCurrent,
          bufferToFrontmatter(buf),
          buf.body,
          overwriteConflict ? '' : (baseMtimeCurrent ?? ''),
        );
      } else {
        const derived = deriveFilename(buf);
        result = await createEvent(derived, bufferToFrontmatter(buf), buf.body);
        // Migrate draft key: the `new:<stamp>` draft should be cleared,
        // and future auto-saves should target the existing-filename key.
        const oldKey = draftKey;
        clearDraft(oldKey);
        draftKey = { kind: 'existing', filename: result.filename };
        filenameCurrent = result.filename;
      }

      baseMtimeCurrent = result.lastModified;
      clearDraft(draftKey);
      setState('saved');
      setTimeout(() => finish({ status: 'saved', filename: filenameCurrent! }), SAVED_BANNER_MS);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && filenameCurrent) {
        setState('dirty');
        const choice = await showConflictModal(filenameCurrent);
        if (choice === 'overwrite') return attemptSave(true);
        // 'cancel' → stay open, buffer preserved.
        return;
      }
      setState('error', err instanceof Error ? err.message : String(err));
    }
  }

  saveBtn.addEventListener('click', () => { void attemptSave(); });
  retryBtn.addEventListener('click', () => { void attemptSave(); });

  // ---- Delete (edit mode) ----
  if (deleteBtn && mode.kind === 'edit') {
    deleteBtn.addEventListener('click', async () => {
      const ok = window.confirm(`Move "${titleInput.value || mode.filename}" to trash?\n\nRecoverable via Settings → Trash.`);
      if (!ok) return;
      setState('saving');
      try {
        await deleteEvent(mode.filename, baseMtimeCurrent ?? '');
        clearDraft(draftKey);
        finish({ status: 'deleted', filename: mode.filename });
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          setState('dirty');
          const choice = await showConflictModal(mode.filename);
          if (choice === 'overwrite') {
            try {
              await deleteEvent(mode.filename, '');
              clearDraft(draftKey);
              finish({ status: 'deleted', filename: mode.filename });
            } catch (err2) {
              setState('error', err2 instanceof Error ? err2.message : String(err2));
            }
          }
          return;
        }
        setState('error', err instanceof Error ? err.message : String(err));
      }
    });
  }

  // ---- Discard / close ----
  function tryClose() {
    if (state === 'dirty' || state === 'error') {
      const ok = window.confirm('You have unsaved changes — close anyway?\n\n(Your draft stays in the browser; reopening restores it.)');
      if (!ok) return;
    }
    finish({ status: 'cancelled' });
  }

  discardBtn.addEventListener('click', () => {
    const ok = window.confirm('Discard unsaved changes and remove the draft?');
    if (!ok) return;
    clearDraft(draftKey);
    finish({ status: 'cancelled' });
  });
  closeBtn.addEventListener('click', tryClose);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) tryClose();
  });

  // ---- beforeunload guard ----
  const onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (state === 'dirty' || state === 'error') {
      e.preventDefault();
      e.returnValue = '';
    }
  };
  window.addEventListener('beforeunload', onBeforeUnload);

  // ---- Keyboard ----
  const onKey = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 's' || e.key === 'Enter')) {
      e.preventDefault();
      if (!saveBtn.disabled) void attemptSave();
      return;
    }
    if (e.key === 'Escape') {
      const overlays = document.querySelectorAll('.modal-overlay');
      if (overlays[overlays.length - 1] !== overlay) return;
      e.stopPropagation();
      tryClose();
    }
  };
  window.addEventListener('keydown', onKey);

  // Focus: new event → title; edit mode with empty body → body; otherwise title.
  setTimeout(() => {
    if (mode.kind === 'create') titleInput.focus();
    else if (!bodyInput.value) bodyInput.focus();
    else titleInput.focus();
  }, 0);

  return resultPromise;

  function finish(result: EditorResult) {
    detachLinkPicker();
    detachFormatToolbar();
    window.removeEventListener('beforeunload', onBeforeUnload);
    window.removeEventListener('keydown', onKey);
    overlay.remove();
    resolveResult(result);
  }
}

// ---- Helpers ----

function newCreationStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function emptyBuffer(initialDate?: string, initialTags?: string): DraftBuffer {
  return {
    title: '',
    date: initialDate ?? '',
    tagsText: initialTags ?? '',
    color: '',
    status: '',
    body: '',
  };
}

function validateBuffer(b: DraftBuffer): string | null {
  if (!b.title.trim()) return 'Title is required.';
  if (!b.date.trim()) return 'Date is required.';
  try {
    parseISOString(b.date.trim());
  } catch (err: any) {
    return `Date is not a valid Golarian date: ${err?.message ?? err}`;
  }
  return null;
}

function deriveFilename(b: DraftBuffer): string {
  const dateOnly = b.date.trim().slice(0, 10);
  const slug = slugify(b.title);
  return `${dateOnly}-${slug || 'event'}.md`;
}

function slugify(s: string): string {
  return s.toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

