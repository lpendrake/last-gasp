import { useState, useCallback } from 'react';
import { timelinePort, ConflictError } from '../data/ports';
import type { EventListItem } from '../data/types';
import type { EditorMode } from './domain';

export type { EditorMode };

export interface CardDeleteConflict {
  filename: string;
  title: string;
}

export interface UseEventEditorResult {
  editorMode: EditorMode | null;
  openCreate: (initialDate?: string) => void;
  openEdit: (filename: string) => void;
  closeEditor: () => void;
  handleSaved: (filename: string) => void;
  handleAutosaved: (filename: string) => void;
  handleDeleted: (filename: string) => void;
  requestDeleteFromCard: (item: EventListItem) => Promise<void>;
  cardDeleteConflict: CardDeleteConflict | null;
  resolveCardDeleteConflict: (choice: 'overwrite' | 'cancel') => Promise<void>;
}

export function useEventEditor(
  campaignPath: string,
  onEventsChanged: () => void,
): UseEventEditorResult {
  const [editorMode, setEditorMode] = useState<EditorMode | null>(null);
  const [cardDeleteConflict, setCardDeleteConflict] = useState<CardDeleteConflict | null>(null);

  const openCreate = useCallback((initialDate?: string) => {
    setEditorMode({ kind: 'create', ...(initialDate ? { initialDate } : {}) });
  }, []);

  const openEdit = useCallback((filename: string) => {
    setEditorMode({ kind: 'edit', filename });
  }, []);

  const closeEditor = useCallback(() => {
    setEditorMode(null);
  }, []);

  const handleSaved = useCallback(() => {
    setEditorMode(null);
    onEventsChanged();
  }, [onEventsChanged]);

  const handleAutosaved = useCallback(() => {
    onEventsChanged();
  }, [onEventsChanged]);

  const handleDeleted = useCallback(() => {
    setEditorMode(null);
    onEventsChanged();
  }, [onEventsChanged]);

  const requestDeleteFromCard = useCallback(
    async (item: EventListItem) => {
      const displayName = item.title || item.filename;
      const ok = window.confirm(
        `Move "${displayName}" to trash?\n\nRecoverable via Settings → Trash.`,
      );
      if (!ok) return;
      try {
        await timelinePort.deleteEvent(campaignPath, item.filename, item.mtime);
        onEventsChanged();
      } catch (err) {
        if (err instanceof ConflictError) {
          setCardDeleteConflict({ filename: item.filename, title: item.title });
          return;
        }
        console.error('[useEventEditor] delete failed', err);
      }
    },
    [campaignPath, onEventsChanged],
  );

  const resolveCardDeleteConflict = useCallback(
    async (choice: 'overwrite' | 'cancel') => {
      if (choice === 'cancel') {
        setCardDeleteConflict(null);
        return;
      }
      if (!cardDeleteConflict) return;
      try {
        // Re-fetch current mtime so the server accepts the delete
        const { lastModified } = await timelinePort.getEvent(
          campaignPath,
          cardDeleteConflict.filename,
        );
        await timelinePort.deleteEvent(campaignPath, cardDeleteConflict.filename, lastModified);
        setCardDeleteConflict(null);
        onEventsChanged();
      } catch (err) {
        console.error('[useEventEditor] force delete failed', err);
        setCardDeleteConflict(null);
      }
    },
    [campaignPath, cardDeleteConflict, onEventsChanged],
  );

  return {
    editorMode,
    openCreate,
    openEdit,
    closeEditor,
    handleSaved,
    handleAutosaved,
    handleDeleted,
    requestDeleteFromCard,
    cardDeleteConflict,
    resolveCardDeleteConflict,
  };
}
