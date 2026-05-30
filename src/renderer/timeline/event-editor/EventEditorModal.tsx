import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { EditorView } from '@codemirror/view';
import { MarkdownEditor, FormatToolbar } from '../../shared/markdown-editor';
import { suggestLinks } from '../../shared/suggest-links';
import { FooterPortal } from '../../components/footer-portal';
import { openFromWikiLink, closeFromWikiLink } from '../../peek/stack';
import { timelinePort, ConflictError, FilenameConflictError } from '../data/ports';
import { notesData } from '../../notes/data';
import {
  emptyBuffer,
  bufferFromEvent,
  bufferToFrontmatter,
  effectiveTitle,
  validateBuffer,
  deriveFilename,
  getColorPresetValue,
  buildTagChips,
  hasReservedTagPrefix,
  addTagsToText,
  removeTagFromText,
  weekdayColorForDateText,
  type EditorBuffer,
  type EditorMode,
} from './domain';
import { resolveInitialCursor } from './domain/initial-cursor';
import { ThemeProvider } from '../../theme';
import { ColorSelect } from './color-select';
import { isValidCustomTag } from '../../../shared/entity-tags';
import {
  buildEntityLabelMap,
  buildEntityTagLabelMap,
  applyEntityDelta,
} from '../../../shared/entity-labels';
import './EventEditorModal.css';

function TagChipList({
  tagsText,
  body,
  systemTags,
  entityTagLabelMap,
  onRemoveCustomTag,
}: {
  tagsText: string;
  body: string;
  systemTags: string[];
  entityTagLabelMap: Map<string, string>;
  onRemoveCustomTag: (tag: string) => void;
}) {
  const chips = buildTagChips(tagsText, body, entityTagLabelMap, systemTags);
  if (chips.length === 0) return null;
  return (
    <div className="event-editor-tag-chips">
      {chips.map(({ raw, display, isEntity }) => (
        <span
          key={raw}
          className={`event-editor-tag-chip${isEntity ? ' entity-tag-chip--resolved' : ''}`}
        >
          {display}
          {isValidCustomTag(raw) && (
            <button
              type="button"
              className="event-editor-tag-chip-remove"
              onClick={() => onRemoveCustomTag(raw)}
              aria-label={`Remove tag ${raw}`}
            >
              ×
            </button>
          )}
        </span>
      ))}
    </div>
  );
}

type SaveState = 'clean' | 'dirty' | 'saving' | 'error' | 'saved';
type LoadState = 'loading' | 'ready' | 'load-error';
type ConflictPending = { kind: 'save' } | { kind: 'delete' };

const SAVED_BANNER_MS = 900;
const AUTOSAVE_DELAY_MS = 500;

export interface EventEditorModalProps {
  campaignPath: string;
  mode: EditorMode;
  onClose: () => void;
  onSaved: (filename: string) => void;
  onDeleted: (filename: string) => void;
  /** Called after a background auto-save; editor stays open. */
  onAutosaved?: (filename: string) => void;
  onOpenById?: (id: string) => void;
}

export function EventEditorModal({
  campaignPath,
  mode,
  onClose,
  onSaved,
  onDeleted,
  onAutosaved,
  onOpenById,
}: EventEditorModalProps) {
  const [loadState, setLoadState] = useState<LoadState>(mode.kind === 'edit' ? 'loading' : 'ready');
  const [buffer, setBuffer] = useState<EditorBuffer>(
    mode.kind === 'create' ? emptyBuffer(mode.initialDate) : emptyBuffer(),
  );
  const [saveState, setSaveState] = useState<SaveState>('clean');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [conflictPending, setConflictPending] = useState<ConflictPending | null>(null);
  const [customMode, setCustomMode] = useState(false);
  const [entityIndex, setEntityIndex] = useState<
    Awaited<ReturnType<typeof notesData.getEntityIndex>>
  >([]);

  useEffect(() => {
    notesData
      .getEntityIndex(campaignPath)
      .then(setEntityIndex)
      .catch(() => {});
  }, [campaignPath]);

  useEffect(() => {
    return window.fsApi.onEntityDelta((delta) => {
      setEntityIndex((prev) => applyEntityDelta(prev, delta));
    });
  }, []);

  const suggestLinksForIndex = useCallback(
    (query: string) => suggestLinks(entityIndex, query),
    [entityIndex],
  );

  const knownIds = useMemo(() => new Set(entityIndex.map((e) => e.id)), [entityIndex]);
  const entityLabelMap = useMemo(() => buildEntityLabelMap(entityIndex), [entityIndex]);
  const entityTagLabelMap = useMemo(() => buildEntityTagLabelMap(entityIndex), [entityIndex]);

  // Refs for stable access inside async callbacks without needing deps
  const lastModifiedRef = useRef<string | null>(null);
  const filenameRef = useRef<string | null>(mode.kind === 'edit' ? mode.filename : null);
  const bufferRef = useRef<EditorBuffer>(buffer);
  bufferRef.current = buffer;
  const savedTimerRef = useRef<number | null>(null);

  const [tagInput, setTagInput] = useState('');

  const viewRef = useRef<EditorView | null>(null);
  const autoSaveTimerRef = useRef<number | null>(null);

  // Clear pending timers if the modal unmounts mid-flight
  useEffect(() => {
    return () => {
      if (savedTimerRef.current !== null) window.clearTimeout(savedTimerRef.current);
      if (autoSaveTimerRef.current !== null) window.clearTimeout(autoSaveTimerRef.current);
    };
  }, []);

  // Capture mount-time values in a ref so the effect can have an empty deps array.
  // The key prop on EventEditorModal ensures a full remount when the target changes,
  // so reading from refs here is always correct.
  const loadTargetRef = useRef(
    mode.kind === 'edit' ? { campaignPath, filename: mode.filename } : null,
  );

  // Load event on mount in edit mode
  useEffect(() => {
    const target = loadTargetRef.current;
    if (!target) return;
    timelinePort
      .getEvent(target.campaignPath, target.filename)
      .then(({ event, lastModified }) => {
        const loaded = bufferFromEvent(event);
        setBuffer(loaded);
        setCustomMode(getColorPresetValue(loaded.color) === '__custom__');
        lastModifiedRef.current = lastModified;
        setLoadState('ready');
      })
      .catch((err) => {
        console.error('[EventEditorModal] failed to load event', err);
        setLoadState('load-error');
      });
  }, []);

  // ---- Save ----

  const doSave = useCallback(
    async (
      opts: {
        /** Ctrl+Enter / Close: close the editor immediately on success (no banner delay). */
        closeAfterSave?: boolean;
        /** Auto-save: skip the error UI on failure; return to clean on success. */
        silent?: boolean;
        overrideMtime?: string;
      } = {},
    ) => {
      const current = bufferRef.current;
      const validationError = validateBuffer(current);
      if (validationError) {
        if (opts.silent) return;
        setErrorMessage(validationError);
        setSaveState('error');
        return;
      }

      // Cancel any pending auto-save when a manual or ctrl-enter save fires.
      if (!opts.silent && autoSaveTimerRef.current !== null) {
        window.clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }

      setSaveState('saving');
      const frontmatter = bufferToFrontmatter(current);
      const mtime = opts.overrideMtime ?? lastModifiedRef.current;

      try {
        let result;
        // After the first auto-save in create mode, filenameRef is set — update from then on.
        if (filenameRef.current !== null) {
          const desiredFilename = deriveFilename(current);
          result = await timelinePort.updateEvent(
            campaignPath,
            filenameRef.current,
            frontmatter,
            current.body,
            mtime!,
            desiredFilename,
          );
          filenameRef.current = result.event.filename;
        } else {
          const filename = deriveFilename(current);
          result = await timelinePort.createEvent(
            campaignPath,
            filename,
            frontmatter,
            current.body,
          );
          filenameRef.current = result.event.filename;
        }
        lastModifiedRef.current = result.lastModified;
        setConflictPending(null);
        setSaveState('saved');

        if (opts.closeAfterSave) {
          // Close immediately (no banner delay).
          onSaved(filenameRef.current!);
        } else if (opts.silent) {
          // Auto-save: show brief banner then return to clean (editor stays open).
          savedTimerRef.current = window.setTimeout(() => {
            setSaveState('clean');
            onAutosaved?.(filenameRef.current!);
          }, SAVED_BANNER_MS);
        } else {
          // Manual save (Ctrl+S): banner then close.
          savedTimerRef.current = window.setTimeout(
            () => onSaved(filenameRef.current!),
            SAVED_BANNER_MS,
          );
        }
      } catch (err) {
        if (err instanceof FilenameConflictError) {
          setSaveState('error');
          setErrorMessage(err.message);
          return;
        }
        if (err instanceof ConflictError) {
          setSaveState('dirty');
          // Auto-save conflict: silently revert so user can resolve manually.
          if (!opts.silent) setConflictPending({ kind: 'save' });
          return;
        }
        if (opts.silent) {
          setSaveState('dirty'); // revert so the dirty indicator stays visible
          return;
        }
        setSaveState('error');
        setErrorMessage(err instanceof Error ? err.message : String(err));
      }
    },
    [campaignPath, onSaved, onAutosaved],
  );

  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current !== null) window.clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = window.setTimeout(() => {
      autoSaveTimerRef.current = null;
      void doSave({ silent: true });
    }, AUTOSAVE_DELAY_MS);
  }, [doSave]);

  const updateBuffer = useCallback(
    (patch: Partial<EditorBuffer>) => {
      setBuffer((prev) => ({ ...prev, ...patch }));
      setSaveState((s) => (s === 'saving' ? s : 'dirty'));
      setErrorMessage(null);
      scheduleAutoSave();
    },
    [scheduleAutoSave],
  );

  /** Flush any pending debounced autosave immediately (used on blur). */
  const flushSave = useCallback(() => {
    if (autoSaveTimerRef.current === null) return;
    window.clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = null;
    void doSave({ silent: true });
  }, [doSave]);

  /** Close the editor, saving first if there are unsaved changes.
   * If the buffer is invalid (can't be saved), discard and close immediately
   * so a leave gesture can never trap the user. */
  const requestClose = useCallback(() => {
    if (saveState === 'saving') return;
    if (saveState === 'dirty' || saveState === 'error') {
      if (validateBuffer(bufferRef.current) !== null) {
        onClose();
      } else {
        void doSave({ closeAfterSave: true });
      }
    } else {
      onClose();
    }
  }, [saveState, doSave, onClose]);

  const handleTagInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const trimmed = tagInput.trim();
      if (!trimmed) return;
      const newText = addTagsToText(bufferRef.current.tagsText, trimmed);
      setTagInput('');
      if (newText === bufferRef.current.tagsText) return;
      // Update ref synchronously so doSave reads the new tags immediately.
      bufferRef.current = { ...bufferRef.current, tagsText: newText };
      setBuffer(bufferRef.current);
      setSaveState((s) => (s === 'saving' ? s : 'dirty'));
      setErrorMessage(null);
      if (autoSaveTimerRef.current !== null) {
        window.clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      void doSave({ silent: true });
    },
    [tagInput, doSave],
  );

  const handleRemoveCustomTag = useCallback(
    (tag: string) => {
      updateBuffer({ tagsText: removeTagFromText(bufferRef.current.tagsText, tag) });
    },
    [updateBuffer],
  );

  // Escape + Ctrl+Enter: capture phase wins over CodeMirror keybindings.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        requestClose();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (saveState === 'saving') return;
        if (saveState === 'dirty' || saveState === 'error') {
          void doSave({ closeAfterSave: true });
        } else if (saveState === 'clean' || saveState === 'saved') {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', onKey, { capture: true });
    return () => document.removeEventListener('keydown', onKey, { capture: true });
  }, [saveState, onClose, doSave, requestClose]);

  // ---- Delete ----

  const doDelete = useCallback(
    async (overrideMtime?: string) => {
      if (mode.kind !== 'edit') return;
      const mtime = overrideMtime ?? lastModifiedRef.current;
      setSaveState('saving');
      try {
        await timelinePort.deleteEvent(campaignPath, filenameRef.current ?? mode.filename, mtime!);
        setConflictPending(null);
        onDeleted(filenameRef.current ?? mode.filename);
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
        await doSave({ overrideMtime: freshMtime });
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
    if (!window.confirm(`Move "${displayName}" to trash?\n\nRecoverable via Settings → Trash.`))
      return;
    void doDelete();
  }, [mode, buffer.title, doDelete]);

  const colorSelectValue = customMode ? '__custom__' : getColorPresetValue(buffer.color);
  const isCustomColor = colorSelectValue === '__custom__';
  const weekdayColorForEvent = weekdayColorForDateText(
    buffer.date,
    ThemeProvider.get().timeline.days,
  );

  const handleColorChange = useCallback(
    (v: string) => {
      if (v === '__custom__') {
        setCustomMode(true);
        // keep current color; user will type a hex
      } else {
        setCustomMode(false);
        // Update ref synchronously so flushSave reads the new colour immediately.
        bufferRef.current = { ...bufferRef.current, color: v };
        setBuffer(bufferRef.current);
        setSaveState((s) => (s === 'saving' ? s : 'dirty'));
        setErrorMessage(null);
        if (autoSaveTimerRef.current !== null) {
          window.clearTimeout(autoSaveTimerRef.current);
          autoSaveTimerRef.current = null;
        }
        void doSave({ silent: true });
      }
    },
    [doSave],
  );

  // Placeholder for the override fields: the live effective title (body H1,
  // falling back to the title field), so it tracks the H1 as the user types.
  const titlePlaceholder = effectiveTitle(buffer) || 'event title';
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
        onClick={requestClose}
        disabled={saveState === 'saving'}
      >
        Close
      </button>
    </div>
  );

  return (
    <>
      <div
        className="event-editor-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget && !isBusy) requestClose();
        }}
      >
        <div className="event-editor-modal">
          {/* Loading / load-error */}
          {loadState === 'loading' && <div className="event-editor-loading">Loading…</div>}
          {loadState === 'load-error' && (
            <div className="event-editor-loading event-editor-loading--error">
              Failed to load event.
            </div>
          )}

          {loadState === 'ready' && (
            <>
              {/* Markdown editor */}
              <div className="event-editor-body">
                <MarkdownEditor
                  content={buffer.body}
                  onChange={(s) => updateBuffer({ body: s })}
                  viewRef={viewRef}
                  initialCursor={resolveInitialCursor(mode, buffer.body.length)}
                  wikiLinks={{
                    suggest: suggestLinksForIndex,
                    onOpen: onOpenById,
                    onHover: openFromWikiLink,
                    onHoverEnd: closeFromWikiLink,
                    knownIds,
                    entityLabels: entityLabelMap,
                  }}
                />
              </div>

              {/* Error banner — sits just above the controls */}
              {saveState === 'error' && errorMessage && (
                <div className="event-editor-error">⚠ {errorMessage}</div>
              )}

              {/* Bottom controls */}
              <div className="event-editor-controls">
                {/* Row 1: colour + tag input + tag chips */}
                <div className="event-editor-row event-editor-row--controls">
                  <div className="event-editor-control-field">
                    <span className="event-editor-field-label">Event Colour</span>
                    <div className="event-editor-color-row event-editor-color-row--inline">
                      <ColorSelect
                        presets={ThemeProvider.get().timeline.eventColorPresets}
                        value={colorSelectValue}
                        weekdayColor={weekdayColorForEvent}
                        customColor={isCustomColor ? buffer.color : undefined}
                        onChange={handleColorChange}
                        ariaLabel="Event colour"
                      />
                      {isCustomColor && (
                        <input
                          type="text"
                          className="event-editor-input event-editor-color-custom"
                          value={buffer.color}
                          onChange={(e) => updateBuffer({ color: e.target.value })}
                          onBlur={flushSave}
                          placeholder="#c43"
                          autoComplete="off"
                        />
                      )}
                      <span
                        className="event-editor-color-swatch"
                        style={{
                          background: buffer.color || weekdayColorForEvent || 'transparent',
                        }}
                        title={buffer.color || weekdayColorForEvent || 'weekday default'}
                      />
                    </div>
                  </div>
                  <div className="event-editor-label-field event-editor-label-field--tags">
                    <span className="event-editor-field-label">Tags</span>
                    <input
                      type="text"
                      className="event-editor-input event-editor-tag-input"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleTagInputKeyDown}
                      placeholder="add tags…"
                      autoComplete="off"
                      aria-label="Add tags (comma-separated, Enter to confirm)"
                    />
                    {hasReservedTagPrefix(tagInput) && (
                      <span className="event-editor-field-warning">
                        {"Tags starting with 'id:' or 'sesh:' are reserved"}
                      </span>
                    )}
                  </div>
                  <TagChipList
                    tagsText={buffer.tagsText}
                    body={buffer.body}
                    systemTags={buffer.systemTags}
                    entityTagLabelMap={entityTagLabelMap}
                    onRemoveCustomTag={handleRemoveCustomTag}
                  />
                </div>

                {/* Row 2: date + Tag Label + Link Label */}
                <div className="event-editor-row event-editor-row--meta">
                  <label className="event-editor-label-field event-editor-label-field--date">
                    <span className="event-editor-field-label">Event Date</span>
                    <input
                      type="text"
                      className="event-editor-input event-editor-date-input"
                      value={buffer.date}
                      onChange={(e) => updateBuffer({ date: e.target.value })}
                      onBlur={flushSave}
                      placeholder="4726-05-04T09:30"
                      autoComplete="off"
                      aria-label="Date (Golarian ISO)"
                    />
                  </label>
                  <label className="event-editor-label-field">
                    <span className="event-editor-field-label">Tag Label</span>
                    <input
                      type="text"
                      className="event-editor-input"
                      value={buffer.tagLabelOverride}
                      onChange={(e) => updateBuffer({ tagLabelOverride: e.target.value })}
                      onBlur={flushSave}
                      placeholder={titlePlaceholder}
                      autoComplete="off"
                    />
                  </label>
                  <label className="event-editor-label-field">
                    <span className="event-editor-field-label">Link Label</span>
                    <input
                      type="text"
                      className="event-editor-input"
                      value={buffer.linkLabelOverride}
                      onChange={(e) => updateBuffer({ linkLabelOverride: e.target.value })}
                      onBlur={flushSave}
                      placeholder={titlePlaceholder}
                      autoComplete="off"
                    />
                  </label>
                </div>
              </div>
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

      <FooterPortal slot="center">
        <FormatToolbar
          viewRef={viewRef}
          isEditable={loadState === 'ready'}
          footerSlot={footerSlot}
        />
      </FooterPortal>
    </>
  );
}
