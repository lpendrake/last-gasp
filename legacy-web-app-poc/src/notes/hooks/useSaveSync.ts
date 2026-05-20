import { type Dispatch, type SetStateAction, useEffect, useState } from 'react';
import { putNote } from '../../data/http/notes.http.ts';
import type { FileState, NoteEntry } from '../types.ts';

export type SaveStatus = 'dirty' | 'saving' | 'saved' | 'clean';

export interface UseSaveSyncDeps {
  openFiles: Record<string, FileState>;
  setOpenFiles: Dispatch<SetStateAction<Record<string, FileState>>>;
  setFolderFiles: Dispatch<SetStateAction<Record<string, NoteEntry[] | null>>>;
  pushToast: (msg: string) => void;
}

export interface UseSaveSyncResult {
  savingState: Record<string, SaveStatus>;
  setSavingState: Dispatch<SetStateAction<Record<string, SaveStatus>>>;
  savedAt: Record<string, string>;
  setSavedAt: Dispatch<SetStateAction<Record<string, string>>>;
}

/** Owns the savingState/savedAt slots and the 2 s debounced auto-save
 * effect. The orchestrator marks files dirty by calling
 * `setSavingState(prev => ({ ...prev, [key]: 'dirty' }))`; this hook
 * notices and writes them via `putNote`, refreshing folder titles
 * and tracking save state per file key (`<folder>/<path>`). */
export function useSaveSync(deps: UseSaveSyncDeps): UseSaveSyncResult {
  const { openFiles, setOpenFiles, setFolderFiles, pushToast } = deps;
  const [savingState, setSavingState] = useState<Record<string, SaveStatus>>({});
  const [savedAt, setSavedAt] = useState<Record<string, string>>({});

  useEffect(() => {
    const dirtyKeys = Object.entries(savingState)
      .filter(([, v]) => v === 'dirty')
      .map(([k]) => k);
    if (dirtyKeys.length === 0) return;
    const id = setTimeout(async () => { // 2s debounce: save 2s after last change
      for (const key of dirtyKeys) {
        const slashIdx = key.indexOf('/');
        const folder = key.slice(0, slashIdx);
        const path = key.slice(slashIdx + 1);
        const file = openFiles[key];
        if (!file || file.content === null) continue;
        setSavingState(prev => ({ ...prev, [key]: 'saving' }));
        try {
          const newMtime = await putNote(folder, path, file.content, file.mtime || undefined);
          setOpenFiles(prev => ({ ...prev, [key]: { ...prev[key], mtime: newMtime, dirty: false } }));
          setSavingState(prev => ({ ...prev, [key]: 'saved' }));
          setSavedAt(prev => ({ ...prev, [key]: new Date().toLocaleTimeString() }));
          setTimeout(() => {
            setSavingState(prev => prev[key] === 'saved' ? { ...prev, [key]: 'clean' } : prev);
          }, 1100);
          // Refresh title in folder index
          const m = /^#\s+(.+)$/m.exec(file.content);
          const title = m ? m[1].trim() : path.replace(/\.md$/, '');
          setFolderFiles(prev => {
            const entries = prev[folder];
            if (!entries) return prev;
            return { ...prev, [folder]: entries.map(e => e.path === path ? { ...e, title } : e) };
          });
        } catch (err) {
          console.error('Save failed', err);
          pushToast(`Failed to save ${key}`);
          setSavingState(prev => ({ ...prev, [key]: 'dirty' }));
        }
      }
    }, 2000);
    return () => clearTimeout(id);
  }, [savingState, openFiles, setOpenFiles, setFolderFiles, pushToast]);

  return { savingState, setSavingState, savedAt, setSavedAt };
}
