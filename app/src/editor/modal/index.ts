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
import { getEvent } from '../../data/http/events.http.ts';
import {
  loadDraft, writeDraft, clearDraft, draftIsRelevant, debounce,
  bufferFromEvent,
  type DraftBuffer, type DraftKey,
} from '../drafts.ts';
import { attachLinkPicker } from '../link-picker.ts';
import { attachFormatToolbar } from '../format-toolbar.ts';
import { type Mode, editorHtml, promptRestoreDraft } from './view.ts';
import {
  getColor, setColor, readBuffer, updatePreview, updateColorSwatch,
} from './fields.ts';
import {
  type SaveState, type EditorResult, type SaveCtx,
  newCreationStamp, emptyBuffer,
  attemptSave, handleDeleteEvent, tryClose, handleDiscard,
} from './save.ts';

// html: true so <u> underline and other inline HTML render in preview (local single-user app)
const md = new MarkdownIt({ html: true, linkify: true, breaks: false });

export type { EditorResult } from './save.ts';

const DRAFT_DEBOUNCE_MS = 500;

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
  const draftKeyRef: { current: DraftKey } = { current: mode.kind === 'edit'
    ? { kind: 'existing', filename: mode.filename }
    : { kind: 'new', stamp: newCreationStamp() } };

  if (mode.kind === 'edit') {
    // initialDate / initialTags not used in edit mode
    const full = await getEvent(mode.filename);
    baseMtime = full.lastModified;
    initialBuffer = bufferFromEvent(full);
  } else {
    initialBuffer = emptyBuffer(initialDate, initialTags);
  }

  const existingDraft = loadDraft(draftKeyRef.current);
  let restoredFromDraft = false;
  if (existingDraft && draftIsRelevant(existingDraft, baseMtime)) {
    const choice = await promptRestoreDraft(existingDraft.savedAt);
    if (choice === 'restore') {
      initialBuffer = existingDraft.buffer;
      restoredFromDraft = true;
    } else if (choice === 'discard') {
      clearDraft(draftKeyRef.current);
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

  // ---- Mutable refs threaded into the save context ----
  const filenameRef = { current: mode.kind === 'edit' ? mode.filename : null as string | null };
  const mtimeRef = { current: baseMtime as string | null };

  // ---- State ----
  let state: SaveState = restoredFromDraft ? 'dirty' : 'clean';
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

  // ---- Save context (passed to save.ts functions) ----
  const ctx: SaveCtx = {
    mode,
    extraValidate,
    readBuffer: () => readBuffer(titleInput, dateInput, tagsInput, colorPreset, colorCustom, bodyInput),
    setState,
    finish,
    titleInput,
    filenameRef,
    mtimeRef,
    draftKeyRef,
  };

  // ---- Debounced draft autosave ----
  const writeDraftDebounced = debounce(() => {
    if (state === 'clean' || state === 'saved') return;
    writeDraft(draftKeyRef.current, readBuffer(titleInput, dateInput, tagsInput, colorPreset, colorCustom, bodyInput), mtimeRef.current);
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

  // ---- Button wiring ----
  saveBtn.addEventListener('click', () => { void attemptSave(ctx); });
  retryBtn.addEventListener('click', () => { void attemptSave(ctx); });
  if (deleteBtn && mode.kind === 'edit') {
    deleteBtn.addEventListener('click', () => void handleDeleteEvent(ctx));
  }
  discardBtn.addEventListener('click', () => handleDiscard(draftKeyRef, finish));
  closeBtn.addEventListener('click', () => tryClose(state, finish));
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) tryClose(state, finish);
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
      if (!saveBtn.disabled) void attemptSave(ctx);
      return;
    }
    if (e.key === 'Escape') {
      const overlays = document.querySelectorAll('.modal-overlay');
      if (overlays[overlays.length - 1] !== overlay) return;
      e.stopPropagation();
      tryClose(state, finish);
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
