import { useState, useEffect, useRef, useCallback } from 'react';
import type { EditorView } from '@codemirror/view';
import { MarkdownEditor, FormatToolbar } from '../../shared/markdown-editor';
import { timelinePort, ConflictError } from '../data/ports';
import {
  emptyBuffer,
  bufferFromEvent,
  bufferToFrontmatter,
  validateBuffer,
  deriveFilename,
  getColorPresetValue,
  COLOR_PRESETS,
  type EditorBuffer,
  type EditorMode,
} from './domain';
import './EventEditorModal.css';

type SaveState = 'clean' | 'dirty' | 'saving' | 'error' | 'saved';
type LoadState = 'loading' | 'ready' | 'load-error';
type ConflictPending = { kind: 'save' } | { kind: 'delete' };

const SAVED_BANNER_MS = 900;

export interface EventEditorModalProps {
  campaignPath: string;
  mode: EditorMode;
  onClose: () => void;
  onSaved: (filename: string) => void;
  onDeleted: (filename: string) => void;
}

export function EventEditorModal({
  campaignPath,
  mode,
  onClose,
  onSaved,
  onDeleted,
}: EventEditorModalProps) {
  const [loadState, setLoadState] = useState<LoadState>(
    mode.kind === 'edit' ? 'loading' : 'ready',
  );
  const [buffer, setBuffer] = useState<EditorBuffer>(
    mode.kind === 'create' ? emptyBuffer(mode.initialDate) : emptyBuffer(),
  );
  const [saveState, setSaveState] = useState<SaveState>('clean');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [conflictPending, setConflictPending] = useState<ConflictPending | null>(null);

  // Refs for stable access inside async callbacks without needing deps
  const lastModifiedRef = useRef<string | null>(null);
  const filenameRef = useRef<string | null>(mode.kind === 'edit' ? mode.filename : null);
  const bufferRef = useRef<EditorBuffer>(buffer);
  bufferRef.current = buffer;

  const viewRef = useRef<EditorView | null>(null);

  // Load event on mount in edit mode
  useEffect(() => {
    if (mode.kind !== 'edit') return;
    timelinePort
      .getEvent(campaignPath, mode.filename)
      .then(({ event, lastModified }) => {
        setBuffer(bufferFromEvent(event));
        lastModifiedRef.current = lastModified;
        setLoadState('ready');
      })
      .catch((err) => {
        console.error('[EventEditorModal] failed to load event', err);
        setLoadState('load-error');
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — intentional mount-once

  // Escape: close the modal (capture phase wins over useCardExpansion's handler)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (saveState === 'saving') return;
      if (saveState === 'dirty' || saveState === 'error') {
        if (!window.confirm('You have unsaved changes — close anyway?')) return;
      }
      onClose();
    };
    document.addEventListener('keydown', onKey, { capture: true });
    return () => document.removeEventListener('keydown', onKey, { capture: true });
  }, [saveState, onClose]);

  const updateBuffer = useCallback((patch: Partial<EditorBuffer>) => {
    setBuffer((prev) => ({ ...prev, ...patch }));
    setSaveState((s) => (s === 'saving' ? s : 'dirty'));
    setErrorMessage(null);
  }, []);

  // ---- Save ----

  const doSave = useCallback(
    async (overrideMtime?: string) => {
      const current = bufferRef.current;
      const validationError = validateBuffer(current);
      if (validationError) {
        setErrorMessage(validationError);
        setSaveState('error');
        return;
      }
      setSaveState('saving');
      const frontmatter = bufferToFrontmatter(current);
      const mtime = overrideMtime ?? lastModifiedRef.current;

      try {
        let result;
        if (mode.kind === 'edit') {
          result = await timelinePort.updateEvent(
            campaignPath,
            filenameRef.current!,
            frontmatter,
            current.body,
            mtime!,
          );
        } else {
          const filename = deriveFilename(current);
          result = await timelinePort.createEvent(campaignPath, filename, frontmatter, current.body);
          filenameRef.current = result.event.filename;
        }
        lastModifiedRef.current = result.lastModified;
        setConflictPending(null);
        setSaveState('saved');
        setTimeout(() => onSaved(filenameRef.current!), SAVED_BANNER_MS);
      } catch (err) {
        if (err instanceof ConflictError) {
          setSaveState('dirty');
          setConflictPending({ kind: 'save' });
          return;
        }
        setSaveState('error');
        setErrorMessage(err instanceof Error ? err.message : String(err));
      }
    },
    [campaignPath, mode, onSaved],
  );

  // ---- Delete ----

  const doDelete = useCallback(
    async (overrideMtime?: string) => {
      if (mode.kind !== 'edit') return;
      const mtime = overrideMtime ?? lastModifiedRef.current;
      setSaveState('saving');
      try {
        await timelinePort.deleteEvent(campaignPath, mode.filename, mtime!);
        setConflictPending(null);
        onDeleted(mode.filename);
      } catch (err) {
        if (err instanceof ConflictError) {
          setSaveState('dirty');
          setConflictPending({ kind: 'delete' });
          return;
        }
        setSaveState('error');
        setErrorMessage(err instanceof Error ? err.message : String(err));
      }
    },
    [campaignPath, mode, onDeleted],
  );

  // ---- Conflict overwrite: re-fetch mtime, then retry ----

  const handleOverwrite = useCallback(async () => {
    if (!conflictPending) return;
    const filename = filenameRef.current ?? (mode.kind === 'edit' ? mode.filename : null);
    if (!filename) return;
    try {
      const { lastModified: freshMtime } = await timelinePort.getEvent(campaignPath, filename);
      if (conflictPending.kind === 'save') {
        await doSave(freshMtime);
      } else {
        await doDelete(freshMtime);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setSaveState('error');
      setConflictPending(null);
    }
  }, [conflictPending, campaignPath, mode, doSave, doDelete]);

  // Ctrl/Cmd+S shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (saveState !== 'saving' && saveState !== 'saved') void doSave();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [saveState, doSave]);

  const handleDeleteClick = useCallback(() => {
    if (mode.kind !== 'edit') return;
    const displayName = buffer.title || mode.filename;
    if (!window.confirm(`Move "${displayName}" to trash?\n\nRecoverable via Settings → Trash.`)) return;
    void doDelete();
  }, [mode, buffer.title, doDelete]);

  const colorPresetValue = getColorPresetValue(buffer.color);
  const isEditMode = mode.kind === 'edit';
  const isBusy = saveState === 'saving' || saveState === 'saved';

  const footerSlot = (
    <div className="event-editor-footer-btns">
      {isEditMode && (
        <button
          type="button"
          className="event-editor-btn event-editor-btn--danger"
          onClick={handleDeleteClick}
          disabled={isBusy || loadState !== 'ready'}
        >
          Delete
        </button>
      )}
      <button
        type="button"
        className="event-editor-btn"
        onClick={onClose}
        disabled={saveState === 'saving'}
      >
        Cancel
      </button>
      <button
        type="button"
        className="event-editor-btn event-editor-btn--primary"
        onClick={() => void doSave()}
        disabled={isBusy || saveState === 'clean' || loadState !== 'ready'}
      >
        {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? '✓ Saved' : 'Save'}
      </button>
    </div>
  );

  return (
    <div
      className="event-editor-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isBusy) onClose();
      }}
    >
      <div className="event-editor-modal">
        {/* Header */}
        <div className="event-editor-header">
          <h2 className="event-editor-title">
            {isEditMode ? `Edit: ${mode.filename}` : 'New event'}
          </h2>
          <div className={`event-editor-save-status event-editor-save-status--${saveState}`}>
            {saveState === 'dirty'
              ? '• unsaved'
              : saveState === 'saving'
                ? 'saving…'
                : saveState === 'saved'
                  ? '✓ saved'
                  : ''}
          </div>
          <button
            type="button"
            className="event-editor-close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {/* Error banner */}
        {saveState === 'error' && errorMessage && (
          <div className="event-editor-error">⚠ {errorMessage}</div>
        )}

        {/* Loading / load-error */}
        {loadState === 'loading' && <div className="event-editor-loading">Loading…</div>}
        {loadState === 'load-error' && (
          <div className="event-editor-loading event-editor-loading--error">
            Failed to load event.
          </div>
        )}

        {loadState === 'ready' && (
          <>
            {/* Frontmatter fields */}
            <div className="event-editor-fields">
              <label className="event-editor-field">
                <span className="event-editor-field-label">Title</span>
                <input
                  type="text"
                  className="event-editor-input"
                  value={buffer.title}
                  onChange={(e) => updateBuffer({ title: e.target.value })}
                  autoComplete="off"
                />
              </label>

              <label className="event-editor-field">
                <span className="event-editor-field-label">Date (Golarian ISO)</span>
                <input
                  type="text"
                  className="event-editor-input"
                  value={buffer.date}
                  onChange={(e) => updateBuffer({ date: e.target.value })}
                  placeholder="4726-05-04T09:30"
                  autoComplete="off"
                />
              </label>

              <label className="event-editor-field">
                <span className="event-editor-field-label">Tags (comma-separated)</span>
                <input
                  type="text"
                  className="event-editor-input"
                  value={buffer.tagsText}
                  onChange={(e) => updateBuffer({ tagsText: e.target.value })}
                  placeholder="plot:beast, location:fort"
                  autoComplete="off"
                />
              </label>

              <div className="event-editor-field">
                <span className="event-editor-field-label">Colour</span>
                <div className="event-editor-color-row">
                  <select
                    className="event-editor-input event-editor-color-select"
                    value={colorPresetValue}
                    onChange={(e) => {
                      const val = e.target.value;
                      // Switching to Custom clears color so the user can type; other presets set directly
                      updateBuffer({ color: val === '__custom__' ? '' : val });
                    }}
                  >
                    {COLOR_PRESETS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                  {colorPresetValue === '__custom__' && (
                    <input
                      type="text"
                      className="event-editor-input event-editor-color-custom"
                      value={buffer.color}
                      onChange={(e) => updateBuffer({ color: e.target.value })}
                      placeholder="#c43"
                      autoComplete="off"
                    />
                  )}
                  <span
                    className="event-editor-color-swatch"
                    style={{ background: buffer.color || 'transparent' }}
                    title={buffer.color || 'weekday default'}
                  />
                </div>
              </div>
            </div>

            {/* Markdown editor */}
            <div className="event-editor-body">
              <MarkdownEditor
                content={buffer.body}
                onChange={(s) => updateBuffer({ body: s })}
                viewRef={viewRef}
              />
            </div>

            {/* Toolbar with footer controls in right slot */}
            <FormatToolbar viewRef={viewRef} isEditable footerSlot={footerSlot} />
          </>
        )}

        {/* Conflict overlay */}
        {conflictPending && (
          <div className="event-editor-conflict-overlay">
            <div className="event-editor-conflict-panel">
              <p className="event-editor-conflict-msg">
                This file changed on disk since you opened it. Overwrite the on-disk version
                anyway, or cancel to keep the editor open?
              </p>
              <div className="event-editor-conflict-btns">
                <button
                  type="button"
                  className="event-editor-btn"
                  onClick={() => setConflictPending(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="event-editor-btn event-editor-btn--danger"
                  onClick={() => void handleOverwrite()}
                >
                  Overwrite
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
