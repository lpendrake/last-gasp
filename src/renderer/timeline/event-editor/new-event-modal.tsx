import { useEffect, useRef, useState } from 'react';
import './new-event-modal.css';

export interface NewEventModalProps {
  initialTitle?: string;
  error?: string | null;
  onCreate: (title: string) => void;
  onCancel: () => void;
}

export function NewEventModal({ initialTitle, error, onCreate, onCancel }: NewEventModalProps) {
  const [title, setTitle] = useState(initialTitle ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  // Autofocus the input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Escape key dismisses the modal (capture phase wins over other handlers)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel();
      }
    };
    document.addEventListener('keydown', onKey, { capture: true });
    return () => document.removeEventListener('keydown', onKey, { capture: true });
  }, [onCancel]);

  const trimmed = title.trim();
  const canCreate = trimmed.length > 0;

  function handleCreate() {
    if (!canCreate) return;
    onCreate(trimmed);
  }

  return (
    <div
      className="new-event-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="new-event-modal">
        <h2 className="new-event-modal__title">New Event</h2>

        <label className="new-event-modal__label">
          Title
          <input
            ref={inputRef}
            className="new-event-modal__input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
            }}
            autoComplete="off"
          />
        </label>

        {error ? <div className="new-event-modal__error">{error}</div> : null}

        <div className="new-event-modal__actions">
          <button type="button" className="event-editor-btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="event-editor-btn event-editor-btn--primary"
            onClick={handleCreate}
            disabled={!canCreate}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
