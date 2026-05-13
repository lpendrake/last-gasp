import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { notesData } from '../data';
import { joinFrontmatter } from '../../../shared/frontmatter';
import type { FileState, NoteEntry } from '../types.ts';

export type SaveStatus = 'dirty' | 'saving' | 'saved' | 'clean';

export interface UseSaveSyncDeps {
  openFiles: Record<string, FileState>;
  setOpenFiles: Dispatch<SetStateAction<Record<string, FileState>>>;
  setFolderFiles: Dispatch<SetStateAction<Record<string, NoteEntry[] | null>>>;
  pushToast: (msg: string) => void;
  campaignPath: string;
}

export interface UseSaveSyncResult {
  savingState: Record<string, SaveStatus>;
  setSavingState: Dispatch<SetStateAction<Record<string, SaveStatus>>>;
  savedAt: Record<string, string>;
  setSavedAt: Dispatch<SetStateAction<Record<string, string>>>;
  /** Save a specific file immediately, bypassing the 2 s debounce. No-ops if clean. */
  saveNow: (key: string) => Promise<void>;
}

/**
 * Owns the savingState/savedAt slots and the 2 s debounced auto-save
 * effect. Marks files dirty by calling `setSavingState(prev => ({ ...prev, [key]: 'dirty' }))`.
 * Adapted for local filesystem writes without mtime conflict detection.
 */
export function useSaveSync(deps: UseSaveSyncDeps): UseSaveSyncResult {
  const { openFiles, setOpenFiles, setFolderFiles, pushToast, campaignPath } = deps;
  const [savingState, setSavingState] = useState<Record<string, SaveStatus>>({});
  const [savedAt, setSavedAt] = useState<Record<string, string>>({});

  // Keep a ref so persistFile always sees the latest openFiles without
  // needing to be re-created every time openFiles changes.
  const openFilesRef = useRef(openFiles);
  openFilesRef.current = openFiles;

  const persistFile = useCallback(
    async (key: string) => {
      const file = openFilesRef.current[key];
      if (!file || file.content === null || !file.dirty) return;

      const slashIdx = key.indexOf('/');
      const folder = key.slice(0, slashIdx);
      const path = key.slice(slashIdx + 1);

      setSavingState((prev) => ({ ...prev, [key]: 'saving' }));

      try {
        const fullPath = `${campaignPath}/notes/${folder}/${path}`;
        const raw = joinFrontmatter(file.frontmatter ?? '', file.content);
        const success = await notesData.saveNote(fullPath, raw);

        if (!success) throw new Error('Write returned false');

        setOpenFiles((prev) => ({ ...prev, [key]: { ...prev[key], dirty: false } }));
        setSavingState((prev) => ({ ...prev, [key]: 'saved' }));
        setSavedAt((prev) => ({ ...prev, [key]: new Date().toLocaleTimeString() }));
        setTimeout(() => {
          setSavingState((prev) => (prev[key] === 'saved' ? { ...prev, [key]: 'clean' } : prev));
        }, 1100);

        // Refresh title in folder index — body is body-only so H1 is still here
        const m = /^#\s+(.+)$/m.exec(file.content);
        const title = m ? m[1].trim() : path.replace(/\.md$/, '');
        setFolderFiles((prev) => {
          const entries = prev[folder];
          if (!entries) return prev;
          return { ...prev, [folder]: entries.map((e) => (e.path === path ? { ...e, title } : e)) };
        });
      } catch (err) {
        console.error('Save failed', err);
        pushToast(`Failed to save ${key}`);
        setSavingState((prev) => ({ ...prev, [key]: 'dirty' }));
      }
    },
    [campaignPath, setOpenFiles, setFolderFiles, pushToast],
  );

  // 2 s debounced auto-save for any dirty file.
  useEffect(() => {
    const dirtyKeys = Object.entries(savingState)
      .filter(([, v]) => v === 'dirty')
      .map(([k]) => k);

    if (dirtyKeys.length === 0) return;

    const id = setTimeout(() => {
      for (const key of dirtyKeys) persistFile(key);
    }, 2000);

    return () => clearTimeout(id);
  }, [savingState, persistFile]);

  const saveNow = useCallback((key: string) => persistFile(key), [persistFile]);

  return { savingState, setSavingState, savedAt, setSavedAt, saveNow };
}
