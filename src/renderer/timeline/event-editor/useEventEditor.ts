import { useState, useCallback } from 'react';
import { timelinePort, ConflictError } from '../data/ports';
import type { EventListItem } from '../data/types';
import type { EditorMode } from './domain';
import { emptyBuffer, bufferToFrontmatter, deriveFilename } from './domain';
import { buildNewEventContent, duplicateEventMessage } from './domain/new-event-content';
import { createEventChecked } from './create-event-checked';
import { useConfirm } from '../../shared/confirm-dialog/confirm-provider';

export type { EditorMode };

export interface CardDeleteConflict {
  filename: string;
  title: string;
}

export interface NewEventPromptState {
  initialDate?: string;
  error: string | null;
}

export interface UseEventEditorResult {
  editorMode: EditorMode | null;
  openCreate: (initialDate?: string) => void;
  openEdit: (filename: string, initialCursor?: number) => void;
  closeEditor: () => void;
  handleSaved: (filename: string) => void;
  handleAutosaved: (filename: string) => void;
  handleDeleted: (filename: string) => void;
  requestDeleteFromCard: (item: EventListItem) => Promise<void>;
  cardDeleteConflict: CardDeleteConflict | null;
  resolveCardDeleteConflict: (choice: 'overwrite' | 'cancel') => Promise<void>;
  newEventPrompt: NewEventPromptState | null;
  openNewEventPrompt: (initialDate?: string) => void;
  cancelNewEventPrompt: () => void;
  createAndOpen: (title: string) => Promise<void>;
  createOnly: (title: string) => Promise<void>;
}

export function useEventEditor(
  campaignPath: string,
  onEventsChanged: () => void,
): UseEventEditorResult {
  const { confirm } = useConfirm();
  const [editorMode, setEditorMode] = useState<EditorMode | null>(null);
  const [cardDeleteConflict, setCardDeleteConflict] = useState<CardDeleteConflict | null>(null);
  const [newEventPrompt, setNewEventPrompt] = useState<NewEventPromptState | null>(null);

  const openCreate = useCallback((initialDate?: string) => {
    setEditorMode({ kind: 'create', ...(initialDate ? { initialDate } : {}) });
  }, []);

  const openEdit = useCallback((filename: string, initialCursor?: number) => {
    setEditorMode({
      kind: 'edit',
      filename,
      ...(initialCursor !== undefined ? { initialCursor } : {}),
    });
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
      const ok = await confirm({
        title: 'Move event to trash',
        message: `Move "${displayName}" to trash?\n\nRecoverable via Settings → Trash.`,
        confirmLabel: 'Move to Trash',
        danger: true,
      });
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
    [campaignPath, onEventsChanged, confirm],
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

  const openNewEventPrompt = useCallback((initialDate?: string) => {
    setNewEventPrompt({ initialDate, error: null });
  }, []);

  const cancelNewEventPrompt = useCallback(() => {
    setNewEventPrompt(null);
  }, []);

  const createEvent = useCallback(
    async (title: string) => {
      const buf = { ...emptyBuffer(newEventPrompt?.initialDate), title };
      const template = await timelinePort.readTemplate(campaignPath, 'event');
      const { body, cursorOffset } = buildNewEventContent(title, template);
      const frontmatter = bufferToFrontmatter(buf);
      const filename = deriveFilename(buf);
      const result = await createEventChecked(campaignPath, filename, frontmatter, body);
      if (!result.ok) {
        setNewEventPrompt((p) => (p ? { ...p, error: duplicateEventMessage(title) } : p));
        return null;
      }
      setNewEventPrompt(null);
      onEventsChanged();
      return { result, cursorOffset };
    },
    [campaignPath, newEventPrompt, onEventsChanged],
  );

  const createAndOpen = useCallback(
    async (title: string) => {
      const created = await createEvent(title);
      if (!created) return;
      openEdit(created.result.event.event.filename, created.cursorOffset);
    },
    [createEvent, openEdit],
  );

  const createOnly = useCallback(
    async (title: string) => {
      await createEvent(title);
    },
    [createEvent],
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
    newEventPrompt,
    openNewEventPrompt,
    cancelNewEventPrompt,
    createAndOpen,
    createOnly,
  };
}
