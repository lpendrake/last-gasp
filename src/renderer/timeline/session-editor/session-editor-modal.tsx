import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import type { Session } from '../data/types';
import {
  SESSION_COLORS,
  type SessionEditorMode,
  type SessionBuffer,
  bufferFromSession,
  emptyBuffer,
  buildSavedSession,
  validateSessionBuffer,
  toDatetimeLocal,
  fromDatetimeLocal,
  recordColorUsed,
} from './session-domain';
import './session-editor-modal.css';

export interface SessionEditorModalProps {
  mode: SessionEditorMode;
  sessions: Session[];
  onClose: () => void;
  onSave: (saved: Session) => Promise<void> | void;
  onDelete: (sessionId: string) => Promise<void> | void;
}

export function SessionEditorModal({
  mode,
  sessions,
  onClose,
  onSave,
  onDelete,
}: SessionEditorModalProps) {
  const isNew = mode.kind === 'create';
  const existingSession =
    mode.kind === 'edit' ? (sessions.find((s) => s.id === mode.sessionId) ?? null) : null;

  const [buffer, setBuffer] = useState<SessionBuffer>(() =>
    existingSession
      ? bufferFromSession(existingSession)
      : emptyBuffer(mode.kind === 'create' ? mode.prefill : undefined),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const updateBuffer = useCallback((patch: Partial<SessionBuffer>) => {
    setBuffer((prev) => ({ ...prev, ...patch }));
    setError(null);
  }, []);

  // Escape closes the modal (capture phase wins over other handlers)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey, { capture: true });
    return () => document.removeEventListener('keydown', onKey, { capture: true });
  }, [onClose]);

  const handleSave = useCallback(async () => {
    const validationError = validateSessionBuffer(buffer, sessions, isNew);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    try {
      const saved = buildSavedSession(buffer, sessions, isNew);
      recordColorUsed(saved.color);
      await onSave(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }, [buffer, sessions, isNew, onSave]);

  const handleDelete = useCallback(async () => {
    if (!existingSession) return;
    const ok = window.confirm(
      `Delete this session (${existingSession.id})? This cannot be undone.`,
    );
    if (!ok) return;
    setSaving(true);
    try {
      await onDelete(existingSession.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }, [existingSession, onDelete]);

  return (
    <div
      className="session-editor-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="session-editor-modal"
        style={{ '--modal-color': buffer.color } as CSSProperties}
      >
        <div className="session-editor-header-bar" />
        <button type="button" className="session-editor-close" aria-label="Close" onClick={onClose}>
          ×
        </button>

        <div className="session-editor-content">
          <h2 className="session-editor-title">{isNew ? 'New Session' : 'Edit Session'}</h2>

          <div className="session-editor-fields">
            <div className="session-editor-field">
              <label className="session-editor-label">Real-world start</label>
              <input
                type="datetime-local"
                className="session-editor-input"
                value={toDatetimeLocal(buffer.realStart)}
                onChange={(e) => updateBuffer({ realStart: fromDatetimeLocal(e.target.value) })}
              />
            </div>

            <div className="session-editor-field">
              <label className="session-editor-label">Real-world end</label>
              <input
                type="datetime-local"
                className="session-editor-input"
                value={toDatetimeLocal(buffer.realEnd)}
                onChange={(e) => updateBuffer({ realEnd: fromDatetimeLocal(e.target.value) })}
              />
            </div>

            <div className="session-editor-field">
              <label className="session-editor-label">
                In-game start
                <span className="session-editor-hint">(Golarian ISO)</span>
              </label>
              <input
                type="text"
                className="session-editor-input"
                value={buffer.inGameStart}
                onChange={(e) => updateBuffer({ inGameStart: e.target.value })}
                placeholder="4726-05-04T13:30"
                autoComplete="off"
              />
            </div>

            <div className="session-editor-field">
              <label className="session-editor-label">
                In-game end
                <span className="session-editor-hint">(Golarian ISO)</span>
              </label>
              <input
                type="text"
                className="session-editor-input"
                value={buffer.inGameEnd}
                onChange={(e) => updateBuffer({ inGameEnd: e.target.value })}
                placeholder="4726-05-04T18:00"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="session-editor-color-row">
            <span className="session-editor-label">Color</span>
            <div className="session-editor-swatches">
              {SESSION_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`session-editor-swatch${buffer.color === color ? ' is-selected' : ''}`}
                  style={{ background: color }}
                  aria-label={color}
                  onClick={() => updateBuffer({ color })}
                />
              ))}
            </div>
          </div>

          {error && <div className="session-editor-error">{error}</div>}

          <div className="session-editor-actions">
            {!isNew && (
              <button
                type="button"
                className="event-editor-btn event-editor-btn--danger"
                onClick={() => void handleDelete()}
                disabled={saving}
              >
                Delete
              </button>
            )}
            <button type="button" className="event-editor-btn" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button
              type="button"
              className="event-editor-btn event-editor-btn--primary"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
