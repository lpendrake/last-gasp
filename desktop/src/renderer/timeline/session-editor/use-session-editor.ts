import { useCallback, useState } from 'react';
import type { SessionEditorMode } from './session-domain';

export type { SessionEditorMode };

export interface UseSessionEditorResult {
  mode: SessionEditorMode | null;
  openCreate: (prefill?: { inGameStart: string; inGameEnd: string }) => void;
  openEdit: (sessionId: string) => void;
  close: () => void;
}

export function useSessionEditor(): UseSessionEditorResult {
  const [mode, setMode] = useState<SessionEditorMode | null>(null);

  const openCreate = useCallback((prefill?: { inGameStart: string; inGameEnd: string }) => {
    setMode({ kind: 'create', prefill });
  }, []);

  const openEdit = useCallback((sessionId: string) => {
    setMode({ kind: 'edit', sessionId });
  }, []);

  const close = useCallback(() => {
    setMode(null);
  }, []);

  return { mode, openCreate, openEdit, close };
}
