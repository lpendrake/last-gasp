import { useState, useEffect, useCallback, useRef } from 'react';
import { notesData } from '../data';
import { slugify } from '../domain/slugify';
import { splitFrontmatter, joinFrontmatter } from '../../../shared/frontmatter';
import { generateShortId } from '../../../shared/ids';
import { useSaveSync } from './useSaveSync';
import { useFolderTree } from './useFolderTree';
import {
  tabKey,
  isEditableNote,
  type NoteEntry,
  type OpenTab,
  type FileState,
  type Toast,
  type ConfirmState,
} from '../types';
import type { LinkIndexEntry } from '../../../types/global';
import type { ContextMenuTarget } from '../components/note-context-menu';

interface NotesControllerOptions {
  campaignId: string;
  campaignPath: string;
  onOpenEvent?: (filename: string) => void;
}

export function useNotesController({
  campaignId,
  campaignPath,
  onOpenEvent,
}: NotesControllerOptions) {
  // ---- Data ----
  const [folders, setFolders] = useState<string[]>([]);
  const [folderFiles, setFolderFiles] = useState<Record<string, NoteEntry[] | null>>({});
  const [openFiles, setOpenFiles] = useState<Record<string, FileState>>({});
  const [linkIndex, setLinkIndex] = useState<LinkIndexEntry[]>([]);

  // ---- Tabs ----
  const [tabs, setTabs] = useState<OpenTab[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(`${campaignId}:notes:tabs`) ?? '[]');
    } catch {
      return [];
    }
  });
  const [activeTab, setActiveTab] = useState<OpenTab | null>(() => {
    try {
      return JSON.parse(localStorage.getItem(`${campaignId}:notes:active-tab`) ?? 'null');
    } catch {
      return null;
    }
  });

  // ---- Sidebar ----
  const [openFolderPaths, setOpenFolderPaths] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');
  const [creatingIn, setCreatingIn] = useState<{ folder: string; subdir?: string } | null>(null);
  const [creatingDirIn, setCreatingDirIn] = useState<{ folder: string; subdir?: string } | null>(
    null,
  );
  const [newFolderMode, setNewFolderMode] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuTarget | null>(null);
  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<string | null>(null);

  // ---- UI ----
  const [renderMode, setRenderMode] = useState<'live' | 'source'>('live');
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddSeed, setQuickAddSeed] = useState('');
  const [quickAddFolder, setQuickAddFolder] = useState<string | undefined>(undefined);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const pushToast = useCallback((message: string, isError = false) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, isError }]);
    if (!isError) {
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
    }
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const { savingState, setSavingState, savedAt, setSavedAt, saveNow } = useSaveSync({
    openFiles,
    setOpenFiles,
    setFolderFiles,
    pushToast,
    campaignPath,
  });

  const ensureLoaded = useCallback(
    (folder: string, path: string) => {
      const key = `${folder}/${path}`;
      setOpenFiles((prev) => {
        if (prev[key] && (prev[key].content !== null || prev[key].loading)) return prev;

        notesData
          .readNote(`${campaignPath}/notes/${folder}/${path}`)
          .then((raw) => {
            const { frontmatter, body } = splitFrontmatter(raw);
            setOpenFiles((p) => ({
              ...p,
              [key]: { content: body, frontmatter, dirty: false, loading: false },
            }));
          })
          .catch((err) => {
            pushToast(`Failed to load ${key}: ${String(err)}`, true);
            setOpenFiles((p) => ({
              ...p,
              [key]: { content: '', frontmatter: '', dirty: false, loading: false },
            }));
          });
        return { ...prev, [key]: { content: null, frontmatter: '', dirty: false, loading: true } };
      });
    },
    [campaignPath, pushToast],
  );

  const activeTabRef = useRef<OpenTab | null>(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  // ---- Filesystem scanner ----
  // Reads the actual folder contents from disk (not just the index) so that
  // empty directories and unrecognised file types are visible in the sidebar.
  // Dotfiles are excluded — they're tooling artefacts, not user content.
  // Wrapped in useCallback so the bootstrap effect can list it as a stable dep.
  const scanFolderContents = useCallback(
    async (folder: string, index: LinkIndexEntry[]): Promise<NoteEntry[]> => {
      const results: NoteEntry[] = [];

      async function scan(dirPath: string, relPrefix: string): Promise<boolean> {
        let items: { name: string; isDirectory: boolean }[];
        try {
          items = await notesData.listFolder(dirPath);
        } catch {
          return false;
        }

        let hasChildren = false;
        for (const item of items) {
          if (item.name.startsWith('.')) continue; // skip dotfiles
          if (item.isDirectory) {
            const childRel = relPrefix ? `${relPrefix}/${item.name}` : item.name;
            const childHasChildren = await scan(`${dirPath}/${item.name}`, childRel);
            if (!childHasChildren) {
              results.push({ id: '', path: childRel, title: item.name, kind: 'dir' });
            }
            hasChildren = true;
          } else {
            const relPath = relPrefix ? `${relPrefix}/${item.name}` : item.name;
            const indexEntry = index.find((e) => e.path === `notes/${folder}/${relPath}`);
            if (indexEntry) {
              results.push({
                id: indexEntry.id,
                path: relPath,
                title: indexEntry.title,
                kind: indexEntry.type === 'asset' ? 'asset' : 'note',
              });
            } else {
              results.push({ id: '', path: relPath, title: item.name, kind: 'unsupported' });
            }
            hasChildren = true;
          }
        }
        return hasChildren;
      }

      await scan(`${campaignPath}/notes/${folder}`, '');
      return results;
    },
    [campaignPath],
  );

  // ---- Bootstrap ----
  useEffect(() => {
    const bootstrap = async () => {
      try {
        const notesDir = `${campaignPath}/notes`;
        await notesData.ensureNoteDirectories(notesDir);
        const entries = await notesData.listFolder(notesDir);
        const folderNames = entries.filter((e) => e.isDirectory).map((e) => e.name);
        setFolders(folderNames);

        const index = await notesData.getLinkIndex(campaignPath);
        setLinkIndex(index);

        // Scan each folder from the filesystem so empty dirs and unrecognised
        // files appear in the sidebar alongside notes and assets.
        const scanned = await Promise.all(
          folderNames.map(async (f) => [f, await scanFolderContents(f, index)] as const),
        );
        setFolderFiles(Object.fromEntries(scanned));

        // Use the ref so activeTab isn't a dep (adding it would re-bootstrap on every tab switch).
        const tab = activeTabRef.current;
        if (tab && isEditableNote(tab.fileKind)) {
          ensureLoaded(tab.folder, tab.path);
        }
      } catch (err) {
        pushToast(`Failed to bootstrap notes: ${String(err)}`, true);
      }
    };
    bootstrap();
  }, [campaignPath, scanFolderContents, ensureLoaded, pushToast]);

  // ---- A3: Live index delta listener ----
  useEffect(() => {
    const unsub = window.fsApi.onIndexDelta((delta) => {
      if (delta.op === 'add' || delta.op === 'update') {
        const { entry } = delta;
        setLinkIndex((prev) => {
          const filtered = prev.filter((e) => e.id !== entry.id && e.path !== entry.path);
          return [...filtered, entry];
        });
        if (entry.type === 'note' || entry.type === 'asset') {
          const parts = entry.path.split('/'); // 'notes/folder/sub/file.ext'
          if (parts.length >= 3) {
            const folder = parts[1];
            const filePath = parts.slice(2).join('/');
            const kind = entry.type === 'asset' ? ('asset' as const) : ('note' as const);
            setFolderFiles((prev) => {
              if (!(folder in prev)) return prev; // folder not loaded — skip
              const existing = prev[folder] ?? [];
              const withoutOld = existing.filter((e) => e.path !== filePath);
              return {
                ...prev,
                [folder]: [
                  ...withoutOld,
                  { id: entry.id, path: filePath, title: entry.title, kind },
                ],
              };
            });
          }
        }
      } else if (delta.op === 'remove') {
        const relPath = delta.path;
        setLinkIndex((prev) => prev.filter((e) => e.path !== relPath));
        const parts = relPath.split('/');
        if (parts.length >= 3 && parts[0] === 'notes') {
          const folder = parts[1];
          const filePath = parts.slice(2).join('/');
          setFolderFiles((prev) => {
            if (!(folder in prev)) return prev;
            return { ...prev, [folder]: (prev[folder] ?? []).filter((e) => e.path !== filePath) };
          });
          setTabs((prev) => {
            const newTabs = prev.filter((t) => !(t.folder === folder && t.path === filePath));
            setActiveTab((at) => {
              if (at?.folder === folder && at.path === filePath)
                return newTabs[newTabs.length - 1] ?? null;
              return at;
            });
            return newTabs;
          });
        }
      }
    });
    return unsub;
  }, []); // stable subscription — all state updates use functional form

  // Load content whenever the active tab changes to a file not yet fetched.
  useEffect(() => {
    if (!activeTab || activeTab.fileKind === 'asset') return;
    ensureLoaded(activeTab.folder, activeTab.path);
  }, [activeTab, ensureLoaded]);

  // ---- Persist tabs to localStorage ----
  useEffect(() => {
    localStorage.setItem(`${campaignId}:notes:tabs`, JSON.stringify(tabs));
  }, [tabs, campaignId]);
  useEffect(() => {
    localStorage.setItem(`${campaignId}:notes:active-tab`, JSON.stringify(activeTab));
  }, [activeTab, campaignId]);

  // ---- Global hotkeys ----
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        const at = activeTabRef.current;
        if (at) setSavingState((prev) => ({ ...prev, [tabKey(at)]: 'dirty' }));
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setQuickAddSeed('');
        setQuickAddFolder(undefined);
        setQuickAddOpen(true);
        return;
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setSavingState]);

  // ---- Folder operations ----
  async function loadFolder(folder: string) {
    if (folderFiles[folder] !== undefined) return;
    setFolderFiles((prev) => ({ ...prev, [folder]: null }));
    try {
      const entries = await scanFolderContents(folder, linkIndex);
      setFolderFiles((prev) => ({ ...prev, [folder]: entries }));
    } catch (err) {
      pushToast(`Failed to load ${folder}: ${String(err)}`, true);
      setFolderFiles((prev) => ({ ...prev, [folder]: [] }));
    }
  }

  async function toggleFolder(folderPath: string, topLevel: string) {
    const wasOpen = openFolderPaths.has(folderPath);
    setOpenFolderPaths((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) next.delete(folderPath);
      else next.add(folderPath);
      return next;
    });
    if (!wasOpen && topLevel === folderPath) await loadFolder(folderPath);
  }

  async function handleCreateFolder(name: string) {
    setNewFolderMode(false);
    const trimmed = name.trim();
    if (!trimmed) return;
    if (folders.includes(trimmed)) {
      pushToast(`Folder "${trimmed}" already exists`);
      return;
    }
    try {
      const folderPath = `${campaignPath}/notes/${trimmed}`;
      await notesData.mkdir(folderPath);
      setFolders((prev) => [...prev, trimmed].sort());
      setFolderFiles((prev) => ({ ...prev, [trimmed]: [] }));
      setOpenFolderPaths((prev) => new Set([...prev, trimmed]));
    } catch (err) {
      pushToast(`Failed to create folder: ${String(err)}`, true);
    }
  }

  // ---- File operations ----
  async function openFile(
    folder: string,
    path: string,
    fileKind?: 'note' | 'asset' | 'unsupported',
  ) {
    setTabs((prev) =>
      prev.some((t) => t.folder === folder && t.path === path)
        ? prev
        : [...prev, { folder, path, fileKind }],
    );
    setActiveTab({ folder, path, fileKind });
    if (fileKind !== 'asset' && fileKind !== 'unsupported') ensureLoaded(folder, path);
  }

  // Opens a note given its campaign-relative path (e.g. "notes/Lore/places.md").
  // Strips the implicit "notes/" prefix before delegating to openFile.
  async function openNoteByPath(campaignRelativePath: string) {
    const withoutPrefix = campaignRelativePath.startsWith('notes/')
      ? campaignRelativePath.slice('notes/'.length)
      : campaignRelativePath;
    const slashIdx = withoutPrefix.indexOf('/');
    if (slashIdx === -1) return;
    await openFile(withoutPrefix.slice(0, slashIdx), withoutPrefix.slice(slashIdx + 1));
  }

  function handleContentChange(folder: string, path: string, content: string) {
    const key = `${folder}/${path}`;
    setOpenFiles((prev) => ({ ...prev, [key]: { ...prev[key], content, dirty: true } }));
    setSavingState((prev) => ({ ...prev, [key]: 'dirty' }));
  }

  function handleFrontmatterChange(folder: string, path: string, frontmatter: string) {
    const key = `${folder}/${path}`;
    setOpenFiles((prev) => ({ ...prev, [key]: { ...prev[key], frontmatter, dirty: true } }));
    setSavingState((prev) => ({ ...prev, [key]: 'dirty' }));
  }

  function closeTab(tab: OpenTab) {
    const key = tabKey(tab);
    const file = openFiles[key];
    if (file?.dirty) {
      setConfirm({
        title: 'Discard unsaved changes?',
        message: `"${tab.path}" has unsaved changes.`,
        confirmLabel: 'Discard',
        danger: true,
        onConfirm: () => doCloseTab(tab),
      });
    } else {
      doCloseTab(tab);
    }
  }

  function doCloseTab(tab: OpenTab) {
    setTabs((prev) => {
      const newTabs = prev.filter((t) => !(t.folder === tab.folder && t.path === tab.path));
      setActiveTab((at) => {
        if (at?.folder === tab.folder && at.path === tab.path) {
          return newTabs[newTabs.length - 1] ?? null;
        }
        return at;
      });
      return newTabs;
    });
  }

  const handleQuickAddCreate = useCallback(
    async ({ folder, title }: { folder: string; title: string }) => {
      const slug = slugify(title);
      if (!slug) return;
      const filename = `${slug}.md`;
      setQuickAddOpen(false);
      // Write frontmatter from the start so the link-index watcher finds needsWrite:false
      // and does not rewrite the file, which would create a race with our autosave.
      const id = generateShortId();
      const frontmatter = `id: ${id}\ntitle: ${title}`;
      const body = `# ${title}\n\n`;
      try {
        const fullPath = `${campaignPath}/notes/${folder}/${filename}`;
        await notesData.saveNote(fullPath, joinFrontmatter(frontmatter, body));

        setFolderFiles((prev) => {
          const existing = prev[folder] ?? [];
          if (existing.some((e) => e.path === filename)) return prev;
          return { ...prev, [folder]: [...existing, { id, path: filename, title, kind: 'note' }] };
        });
        setFolders((prev) => (prev.includes(folder) ? prev : [...prev, folder].sort()));
        setOpenFolderPaths((prev) => new Set([...prev, folder]));
        setOpenFiles((prev) => ({
          ...prev,
          [`${folder}/${filename}`]: { content: body, frontmatter, dirty: false, loading: false },
        }));
        setTabs((prev) =>
          prev.some((t) => t.folder === folder && t.path === filename)
            ? prev
            : [...prev, { folder, path: filename }],
        );
        setActiveTab({ folder, path: filename });
        pushToast(`Created ${folder}/${filename}`);
      } catch (err) {
        pushToast(`Failed to create note: ${String(err)}`, true);
      }
    },
    [campaignPath, pushToast],
  );

  async function commitNewFileInFolder(ctx: { folder: string; subdir?: string }, name: string) {
    setCreatingIn(null);
    const trimmed = name.trim();
    if (!trimmed) return;
    const slug = slugify(trimmed);
    const base = slug.endsWith('.md') ? slug : `${slug}.md`;
    const filePath = ctx.subdir ? `${ctx.subdir}/${base}` : base;
    try {
      // Write frontmatter from the start so the link-index watcher finds needsWrite:false
      // and does not rewrite the file, which would race with ensureLoaded's disk read.
      const id = generateShortId();
      const frontmatter = `id: ${id}\ntitle: ${trimmed}`;
      const body = `# ${trimmed}\n\n`;
      const fullPath = `${campaignPath}/notes/${ctx.folder}/${filePath}`;
      await notesData.saveNote(fullPath, joinFrontmatter(frontmatter, body));

      setFolderFiles((prev) => {
        const existing = prev[ctx.folder] ?? [];
        return {
          ...prev,
          [ctx.folder]: [...existing, { id, path: filePath, title: trimmed, kind: 'note' }],
        };
      });
      await openFile(ctx.folder, filePath);
    } catch (err) {
      pushToast(`Failed to create: ${String(err)}`, true);
    }
  }

  async function commitNewDirInFolder(ctx: { folder: string; subdir?: string }, dirName: string) {
    setCreatingDirIn(null);
    const trimmed = dirName.trim();
    if (!trimmed) return;
    const slug = slugify(trimmed);
    const subdir = ctx.subdir ? `${ctx.subdir}/${slug}` : slug;

    try {
      const fullDirPath = `${campaignPath}/notes/${ctx.folder}/${subdir}`;
      await notesData.mkdir(fullDirPath);
      // Add the empty directory to the sidebar immediately as a 'dir' entry.
      setFolderFiles((prev) => {
        const existing = prev[ctx.folder] ?? [];
        return {
          ...prev,
          [ctx.folder]: [...existing, { id: '', path: subdir, title: slug, kind: 'dir' as const }],
        };
      });
      setOpenFolderPaths((prev) => {
        const next = new Set(prev);
        next.add(ctx.folder);
        if (ctx.subdir) next.add(`${ctx.folder}/${ctx.subdir}`);
        next.add(`${ctx.folder}/${subdir}`);
        return next;
      });
    } catch (err) {
      pushToast(`Failed to create directory: ${String(err)}`, true);
    }
  }

  async function handleDeleteFile(folder: string, path: string) {
    const fullPath = `${campaignPath}/notes/${folder}/${path}`;
    setConfirm({
      title: 'Delete note?',
      message: `"${path}" will be moved to the trash.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        try {
          await notesData.deleteNote(fullPath);
          setFolderFiles((prev) => {
            const entries = prev[folder] ?? [];
            return { ...prev, [folder]: entries.filter((e) => e.path !== path) };
          });
          setTabs((prev) => {
            const newTabs = prev.filter((t) => !(t.folder === folder && t.path === path));
            setActiveTab((at) => {
              if (!at) return at;
              const removed = at.folder === folder && at.path === path;
              return removed ? (newTabs[newTabs.length - 1] ?? null) : at;
            });
            return newTabs;
          });
          pushToast(`Deleted ${folder}/${path}`);
        } catch (err) {
          pushToast(`Delete failed: ${String(err)}`, true);
        }
      },
    });
  }

  async function handleDeleteFolder(folder: string) {
    const fullPath = `${campaignPath}/notes/${folder}`;
    setConfirm({
      title: 'Delete folder?',
      message: `"${folder}" and all its contents will be moved to the trash.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        try {
          await notesData.deleteNote(fullPath);
          setFolders((prev) => prev.filter((f) => f !== folder));
          setFolderFiles((prev) => {
            const { [folder]: _, ...rest } = prev;
            return rest;
          });
          setTabs((prev) => {
            const newTabs = prev.filter((t) => t.folder !== folder);
            setActiveTab((at) => {
              if (at?.folder === folder) {
                return newTabs[newTabs.length - 1] ?? null;
              }
              return at;
            });
            return newTabs;
          });
          pushToast(`Deleted folder ${folder}`);
        } catch (err) {
          pushToast(`Delete failed: ${String(err)}`, true);
        }
      },
    });
  }

  async function handleRename(folder: string, path: string, newName: string) {
    setRenamingKey(null);
    const trimmed = newName.trim();
    if (!trimmed) return;
    // Directories have no extension in their last path segment; files always do.
    const isDir = !(path.split('/').pop() ?? path).includes('.');
    const slug = slugify(trimmed);
    const newBaseName = isDir ? slug : slug.endsWith('.md') ? slug : `${slug}.md`;
    const parts = path.split('/');
    parts[parts.length - 1] = newBaseName;
    const newPath = parts.join('/');

    if (newPath === path) return;

    try {
      const oldFullPath = `${campaignPath}/notes/${folder}/${path}`;
      const newFullPath = `${campaignPath}/notes/${folder}/${newPath}`;
      await notesData.renameNote(oldFullPath, newFullPath);

      setFolderFiles((prev) => {
        const entries = prev[folder] ?? [];
        return {
          ...prev,
          [folder]: entries.map((e) =>
            e.path === path ? { ...e, path: newPath, title: trimmed } : e,
          ),
        };
      });

      const oldKey = `${folder}/${path}`;
      const newKey = `${folder}/${newPath}`;
      setOpenFiles((prev) => {
        if (!prev[oldKey]) return prev;
        const { [oldKey]: data, ...rest } = prev;
        return { ...rest, [newKey]: data };
      });
      setTabs((prev) =>
        prev.map((t) => (t.folder === folder && t.path === path ? { ...t, path: newPath } : t)),
      );
      setActiveTab((at) =>
        at?.folder === folder && at.path === path ? { ...at, path: newPath } : at,
      );

      pushToast(`Renamed to ${newPath}`);
    } catch (err) {
      pushToast(`Rename failed: ${String(err)}`, true);
    }
  }

  async function handleMove(
    srcFolder: string,
    srcPath: string,
    destFolder: string,
    destSubdir?: string,
  ) {
    const basename = srcPath.split('/').pop() ?? srcPath;
    const newPath = destSubdir ? `${destSubdir}/${basename}` : basename;
    if (srcFolder === destFolder && srcPath === newPath) return;

    try {
      const oldFullPath = `${campaignPath}/notes/${srcFolder}/${srcPath}`;
      const newFullPath = `${campaignPath}/notes/${destFolder}/${newPath}`;
      await notesData.renameNote(oldFullPath, newFullPath);

      pushToast(`Moved to ${destFolder}/${newPath}`);
    } catch (err) {
      pushToast(`Move failed: ${String(err)}`, true);
    }
  }

  function handleOpenLink(id: string) {
    const entry = linkIndex.find((e) => e.id === id);
    if (!entry) {
      pushToast(`Note not found: ${id}`, true);
      return;
    }
    if (entry.type === 'event') {
      if (!onOpenEvent) {
        pushToast('Cannot navigate to event from here', true);
        return;
      }
      // entry.path is 'timeline/filename.md' — strip the leading 'timeline/' segment
      const filename = entry.path.split('/').slice(1).join('/');
      onOpenEvent(filename);
      return;
    }
    const parts = entry.path.split('/');
    const folder = parts[1];
    const path = parts.slice(2).join('/');
    openFile(folder, path).catch(() => pushToast(`Failed to open linked note`, true));
  }

  function openMarkdownLink(rawUrl: string) {
    const target = rawUrl.replace(/^\.?\//, '');
    // TODO: strip ../ segments and resolve relative to the current note's folder
    const match = linkIndex.find((e) => e.path === target || e.path.endsWith('/' + target));
    if (!match) {
      pushToast(`Could not resolve link: ${rawUrl}`, true);
      return;
    }
    handleOpenLink(match.id);
  }

  async function suggestLinks(query: string) {
    const q = query.toLowerCase();
    return linkIndex
      .filter((e) => e.title.toLowerCase().includes(q) || e.id.toLowerCase().includes(q))
      .map((e) =>
        e.type === 'asset'
          ? { id: '', label: e.title, detail: e.path, assetPath: e.path }
          : { id: e.id, label: e.title, detail: e.path },
      );
  }

  async function handleRenameFolder(oldFolderName: string, newName: string) {
    setRenamingKey(null);
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldFolderName) return;

    try {
      const oldPath = `${campaignPath}/notes/${oldFolderName}`;
      const newPath = `${campaignPath}/notes/${trimmed}`;
      await notesData.renameNote(oldPath, newPath);

      setFolders((prev) => prev.map((f) => (f === oldFolderName ? trimmed : f)).sort());
      setFolderFiles((prev) => {
        const { [oldFolderName]: data, ...rest } = prev;
        return { ...rest, [trimmed]: data };
      });
      setTabs((prev) =>
        prev.map((t) => (t.folder === oldFolderName ? { ...t, folder: trimmed } : t)),
      );
      setActiveTab((at) => (at?.folder === oldFolderName ? { ...at, folder: trimmed } : at));
      setOpenFiles((prev) => {
        const next: Record<string, FileState> = {};
        for (const [key, val] of Object.entries(prev)) {
          if (key.startsWith(`${oldFolderName}/`)) {
            next[key.replace(`${oldFolderName}/`, `${trimmed}/`)] = val;
          } else {
            next[key] = val;
          }
        }
        return next;
      });

      pushToast(`Renamed folder to ${trimmed}`);
    } catch (err) {
      pushToast(`Folder rename failed: ${String(err)}`, true);
    }
  }

  // ---- Computed ----
  const folderTrees = useFolderTree(folders, folderFiles);
  const activeFile = activeTab ? openFiles[tabKey(activeTab)] : null;

  async function handleSetRenderMode(mode: 'live' | 'source') {
    if (activeTab) await saveNow(tabKey(activeTab));
    setRenderMode(mode);
  }

  return {
    // Data
    folders,
    folderFiles,
    openFiles,
    linkIndex,
    // Tabs
    tabs,
    activeTab,
    // Sidebar state
    openFolderPaths,
    filter,
    creatingIn,
    creatingDirIn,
    newFolderMode,
    contextMenu,
    renamingKey,
    dragTarget,
    // UI state
    renderMode,
    quickAddOpen,
    quickAddSeed,
    quickAddFolder,
    toasts,
    confirm,
    // Computed
    folderTrees,
    activeFile,
    savingState,
    savedAt,
    // Setters for UI-driven state
    setFilter,
    setCreatingIn,
    setCreatingDirIn,
    setNewFolderMode,
    setContextMenu,
    setRenamingKey,
    setDragTarget,
    setOpenFolderPaths,
    setConfirm,
    setQuickAddSeed,
    setQuickAddFolder,
    setQuickAddOpen,
    setSavingState,
    setSavedAt,
    // Actions
    openFile,
    openNoteByPath,
    closeTab,
    handleContentChange,
    handleFrontmatterChange,
    handleSetRenderMode,
    loadFolder,
    toggleFolder,
    handleCreateFolder,
    commitNewFileInFolder,
    commitNewDirInFolder,
    handleDeleteFile,
    handleDeleteFolder,
    handleRename,
    handleRenameFolder,
    handleMove,
    handleOpenLink,
    openMarkdownLink,
    suggestLinks,
    handleQuickAddCreate,
    pushToast,
    dismissToast,
  };
}
