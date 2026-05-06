import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  listNoteFolders, createNoteFolder, listNotes,
  getNote, createNote, deleteNote,
  renameNote, renameNoteFolder, deleteNoteFolder,
} from '../data/http/notes.http.ts';
import { getLinkIndex } from '../data/http/links.http.ts';
import type { LinkIndexEntry } from '../data/types.ts';
import { QuickAdd } from './components/QuickAdd.tsx';
import { NoteContextMenu, type ContextMenuTarget } from './components/NoteContextMenu.tsx';
import { EditorTabs } from './components/EditorTabs.tsx';
import { BreadcrumbNav } from './components/BreadcrumbNav.tsx';
import { EditorContent, type RenderMode } from './components/EditorContent.tsx';
import { FolderSidebar } from './components/FolderSidebar.tsx';
import {
  tabKey, slugify, ASSET_EXTS,
  type NoteEntry, type OpenTab, type FileState, type Toast,
  type ConfirmState, folderColor,
} from './types.ts';
import { useSaveSync } from './hooks/useSaveSync.ts';
import { useFolderTree } from './hooks/useFolderTree.ts';

export function NotesApp() {
  // ---- Data ----
  const [folders, setFolders] = useState<string[]>([]);
  const [folderFiles, setFolderFiles] = useState<Record<string, NoteEntry[] | null>>({});
  const [openFiles, setOpenFiles] = useState<Record<string, FileState>>({});
  const [linkIndex, setLinkIndex] = useState<LinkIndexEntry[]>([]);

  // ---- Tabs ----
  const [tabs, setTabs] = useState<OpenTab[]>(() => {
    const stored: OpenTab[] = (() => {
      try { return JSON.parse(localStorage.getItem('last-gasp:notes:tabs') ?? '[]'); } catch { return []; }
    })();
    const m = /^\/notes\/([^/]+)\/(.+)$/.exec(location.pathname);
    if (m) {
      const ext = m[2].split('.').pop()?.toLowerCase() ?? '';
      const tab: OpenTab = { folder: m[1], path: m[2], fileKind: ASSET_EXTS.has(ext) ? 'asset' : 'note' };
      if (!stored.some(t => t.folder === tab.folder && t.path === tab.path)) return [...stored, tab];
    }
    return stored;
  });
  const [activeTab, setActiveTab] = useState<OpenTab | null>(() => {
    const m = /^\/notes\/([^/]+)\/(.+)$/.exec(location.pathname);
    if (m) {
      const ext = m[2].split('.').pop()?.toLowerCase() ?? '';
      return { folder: m[1], path: m[2], fileKind: ASSET_EXTS.has(ext) ? 'asset' : 'note' };
    }
    try { return JSON.parse(localStorage.getItem('last-gasp:notes:active-tab') ?? 'null'); } catch { return null; }
  });

  // ---- Sidebar ----
  const [openFolderPaths, setOpenFolderPaths] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');
  const [creatingIn, setCreatingIn] = useState<{ folder: string; subdir?: string } | null>(null);
  const [creatingDirIn, setCreatingDirIn] = useState<{ folder: string; subdir?: string } | null>(null);
  const [newFolderMode, setNewFolderMode] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuTarget | null>(null);
  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<string | null>(null);

  // ---- UI ----
  const [renderMode, setRenderMode] = useState<RenderMode>('live');
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddSeed, setQuickAddSeed] = useState('');
  const [quickAddFolder, setQuickAddFolder] = useState<string | undefined>(undefined);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const pushToast = useCallback((message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2600);
  }, []);

  const { savingState, setSavingState, savedAt, setSavedAt } = useSaveSync({
    openFiles, setOpenFiles, setFolderFiles, pushToast,
  });

  const activeTabRef = useRef<OpenTab | null>(activeTab);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

  // ---- Bootstrap ----
  useEffect(() => {
    // Load content for any tab that was active when we last left
    if (activeTab && activeTab.fileKind !== 'asset') {
      const key = tabKey(activeTab);
      setOpenFiles(prev => {
        if (prev[key]?.content !== undefined) return prev;
        void getNote(activeTab.folder, activeTab.path).then(({ content, mtime }) => {
          setOpenFiles(p => ({ ...p, [key]: { content, mtime, dirty: false, loading: false } }));
        }).catch(() => {
          setOpenFiles(p => ({ ...p, [key]: { content: '', mtime: '', dirty: false, loading: false } }));
        });
        return { ...prev, [key]: { content: null, mtime: '', dirty: false, loading: true } };
      });
    }
    Promise.all([
      listNoteFolders().then(fs => setFolders(fs.map(f => f.name))),
      getLinkIndex().then(setLinkIndex),
    ]).catch(err => pushToast(`Failed to load: ${String(err)}`));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Persist tabs to localStorage ----
  useEffect(() => {
    localStorage.setItem('last-gasp:notes:tabs', JSON.stringify(tabs));
  }, [tabs]);
  useEffect(() => {
    localStorage.setItem('last-gasp:notes:active-tab', JSON.stringify(activeTab));
    if (!location.pathname.startsWith('/notes')) return;
    history.replaceState(null, '', activeTab ? `/notes/${activeTab.folder}/${activeTab.path}` : '/notes');
  }, [activeTab]);

  // ---- Global hotkeys ----
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        const at = activeTabRef.current;
        if (at) setSavingState(prev => ({ ...prev, [tabKey(at)]: 'dirty' }));
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setQuickAddSeed(''); setQuickAddFolder(undefined); setQuickAddOpen(true);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        setQuickAddSeed(window.getSelection()?.toString() ?? '');
        setQuickAddFolder(undefined); setQuickAddOpen(true);
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ---- Folder operations ----
  async function loadFolder(folder: string) {
    if (folderFiles[folder] !== undefined) return;
    setFolderFiles(prev => ({ ...prev, [folder]: null }));
    try {
      const entries = await listNotes(folder);
      setFolderFiles(prev => ({ ...prev, [folder]: entries }));
    } catch (err) {
      pushToast(`Failed to load ${folder}: ${String(err)}`);
      setFolderFiles(prev => ({ ...prev, [folder]: [] }));
    }
  }

  async function toggleFolder(folderPath: string, topLevel: string) {
    const wasOpen = openFolderPaths.has(folderPath);
    setOpenFolderPaths(prev => {
      const next = new Set(prev);
      if (next.has(folderPath)) next.delete(folderPath); else next.add(folderPath);
      return next;
    });
    if (!wasOpen && topLevel === folderPath) await loadFolder(folderPath);
  }

  async function handleCreateFolder(name: string) {
    setNewFolderMode(false);
    const trimmed = name.trim();
    if (!trimmed) return;
    if (folders.includes(trimmed)) { pushToast(`Folder "${trimmed}" already exists`); return; }
    try {
      await createNoteFolder(trimmed);
      setFolders(prev => [...prev, trimmed].sort());
      setFolderFiles(prev => ({ ...prev, [trimmed]: [] }));
      setOpenFolderPaths(prev => new Set([...prev, trimmed]));
    } catch (err) {
      pushToast(`Failed to create folder: ${String(err)}`);
    }
  }

  // ---- File operations ----
  async function openFile(folder: string, path: string, fileKind?: 'note' | 'asset') {
    const key = `${folder}/${path}`;
    setTabs(prev => prev.some(t => t.folder === folder && t.path === path) ? prev : [...prev, { folder, path, fileKind }]);
    setActiveTab({ folder, path, fileKind });
    if (fileKind === 'asset') return;
    setOpenFiles(prev => {
      if (prev[key] && (prev[key].content !== null || prev[key].loading)) return prev;
      void getNote(folder, path).then(({ content, mtime }) => {
        setOpenFiles(p => ({ ...p, [key]: { content, mtime, dirty: false, loading: false } }));
      }).catch(err => {
        pushToast(`Failed to load ${key}: ${String(err)}`);
        setOpenFiles(p => ({ ...p, [key]: { content: '', mtime: '', dirty: false, loading: false } }));
      });
      return { ...prev, [key]: { content: null, mtime: '', dirty: false, loading: true } };
    });
  }

  function handleContentChange(folder: string, path: string, content: string) {
    const key = `${folder}/${path}`;
    setOpenFiles(prev => ({ ...prev, [key]: { ...prev[key], content, dirty: true } }));
    setSavingState(prev => ({ ...prev, [key]: 'dirty' }));
  }

  function closeTab(tab: OpenTab) {
    const key = tabKey(tab);
    const file = openFiles[key];
    if (file?.dirty) {
      setConfirm({
        title: 'Discard unsaved changes?',
        message: `"${tab.path}" has unsaved changes.`,
        confirmLabel: 'Discard', danger: true,
        onConfirm: () => doCloseTab(tab),
      });
    } else {
      doCloseTab(tab);
    }
  }

  function doCloseTab(tab: OpenTab) {
    setTabs(prev => {
      const newTabs = prev.filter(t => !(t.folder === tab.folder && t.path === tab.path));
      setActiveTab(at => {
        if (at?.folder === tab.folder && at.path === tab.path) {
          return newTabs[newTabs.length - 1] ?? null;
        }
        return at;
      });
      return newTabs;
    });
  }

  const handleQuickAddCreate = useCallback(async ({ folder, title }: { folder: string; title: string }) => {
    const slug = slugify(title);
    if (!slug) return;
    const filename = `${slug}.md`;
    setQuickAddOpen(false);
    const content = `# ${title}\n\n`;
    try {
      await createNote(folder, filename, content);
      setFolderFiles(prev => {
        const existing = prev[folder] ?? [];
        if (existing.some(e => e.path === filename)) return prev;
        return { ...prev, [folder]: [...existing, { path: filename, title, mtime: '' }] };
      });
      setFolders(prev => prev.includes(folder) ? prev : [...prev, folder].sort());
      setOpenFolderPaths(prev => new Set([...prev, folder]));
      setOpenFiles(prev => ({ ...prev, [`${folder}/${filename}`]: { content, mtime: '', dirty: false, loading: false } }));
      setTabs(prev => prev.some(t => t.folder === folder && t.path === filename) ? prev : [...prev, { folder, path: filename }]);
      setActiveTab({ folder, path: filename });
      pushToast(`Created ${folder}/${filename}`);
    } catch (err) {
      pushToast(`Failed to create note: ${String(err)}`);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function commitNewFileInFolder(ctx: { folder: string; subdir?: string }, name: string) {
    setCreatingIn(null);
    const trimmed = name.trim();
    if (!trimmed) return;
    const slug = slugify(trimmed);
    const base = slug.endsWith('.md') ? slug : `${slug}.md`;
    const filePath = ctx.subdir ? `${ctx.subdir}/${base}` : base;
    try {
      const content = `# ${trimmed}\n\n`;
      await createNote(ctx.folder, filePath, content);
      setFolderFiles(prev => ({
        ...prev,
        [ctx.folder]: [...(prev[ctx.folder] ?? []), { path: filePath, title: trimmed, mtime: '' }],
      }));
      await openFile(ctx.folder, filePath);
    } catch (err) {
      pushToast(`Failed to create: ${String(err)}`);
    }
  }

  async function commitNewDirInFolder(ctx: { folder: string; subdir?: string }, dirName: string) {
    setCreatingDirIn(null);
    const trimmed = dirName.trim();
    if (!trimmed) return;
    const slug = slugify(trimmed);
    const subdir = ctx.subdir ? `${ctx.subdir}/${slug}` : slug;
    setCreatingIn({ folder: ctx.folder, subdir });
    setOpenFolderPaths(prev => {
      const next = new Set(prev);
      next.add(ctx.folder);
      if (ctx.subdir) next.add(`${ctx.folder}/${ctx.subdir}`);
      next.add(`${ctx.folder}/${subdir}`);
      return next;
    });
  }

  async function handleDeleteFile(folder: string, path: string) {
    const isActualDir = folderFiles[folder]?.some(e => e.path.startsWith(path + '/'));
    const count = isActualDir
      ? (folderFiles[folder]?.filter(e => e.path.startsWith(path + '/')).length ?? 0)
      : 0;
    const msg = isActualDir && count > 0
      ? `"${path}" and ${count} file${count !== 1 ? 's' : ''} inside it will be moved to the trash.`
      : `"${path}" will be moved to the trash.`;
    setConfirm({
      title: isActualDir ? 'Delete folder?' : 'Delete note?',
      message: msg,
      confirmLabel: 'Delete', danger: true,
      onConfirm: async () => {
        try {
          await deleteNote(folder, path);
          setFolderFiles(prev => {
            const entries = prev[folder] ?? [];
            const filtered = isActualDir
              ? entries.filter(e => e.path !== path && !e.path.startsWith(path + '/'))
              : entries.filter(e => e.path !== path);
            return { ...prev, [folder]: filtered };
          });
          setTabs(prev => {
            const newTabs = isActualDir
              ? prev.filter(t => !(t.folder === folder && (t.path === path || t.path.startsWith(path + '/'))))
              : prev.filter(t => !(t.folder === folder && t.path === path));
            setActiveTab(at => {
              if (!at) return at;
              const removed = at.folder === folder && (at.path === path || (isActualDir && at.path.startsWith(path + '/')));
              return removed ? (newTabs[newTabs.length - 1] ?? null) : at;
            });
            return newTabs;
          });
          pushToast(`Deleted ${folder}/${path}`);
        } catch (err) {
          pushToast(`Delete failed: ${String(err)}`);
        }
      },
    });
  }

  function migrateKey(oldFolder: string, oldPath: string, newFolder: string, newPath: string) {
    const oldKey = `${oldFolder}/${oldPath}`;
    const newKey = `${newFolder}/${newPath}`;
    setOpenFiles(prev => {
      if (!prev[oldKey]) return prev;
      const { [oldKey]: entry, ...rest } = prev;
      return { ...rest, [newKey]: entry };
    });
    setSavingState(prev => {
      if (!prev[oldKey]) return prev;
      const { [oldKey]: s, ...rest } = prev;
      return { ...rest, [newKey]: s };
    });
    setSavedAt(prev => {
      if (!prev[oldKey]) return prev;
      const { [oldKey]: t, ...rest } = prev;
      return { ...rest, [newKey]: t };
    });
    setTabs(prev => prev.map(t =>
      t.folder === oldFolder && t.path === oldPath
        ? { ...t, folder: newFolder, path: newPath }
        : t,
    ));
    setActiveTab(at =>
      at?.folder === oldFolder && at.path === oldPath
        ? { ...at, folder: newFolder, path: newPath }
        : at,
    );
  }

  function migrateDirKeys(oldFolder: string, oldDirPath: string, newFolder: string, newDirPath: string) {
    const oldPrefix = `${oldFolder}/${oldDirPath}/`;
    const newPrefix = `${newFolder}/${newDirPath}/`;
    setOpenFiles(prev => {
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        if (k.startsWith(oldPrefix)) {
          next[newPrefix + k.slice(oldPrefix.length)] = next[k];
          delete next[k];
        }
      }
      return next;
    });
    setSavingState(prev => {
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        if (k.startsWith(oldPrefix)) {
          next[newPrefix + k.slice(oldPrefix.length)] = next[k];
          delete next[k];
        }
      }
      return next;
    });
    setSavedAt(prev => {
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        if (k.startsWith(oldPrefix)) {
          next[newPrefix + k.slice(oldPrefix.length)] = next[k];
          delete next[k];
        }
      }
      return next;
    });
    setTabs(prev => prev.map(t =>
      t.folder === oldFolder && t.path.startsWith(oldDirPath + '/')
        ? { ...t, folder: newFolder, path: newDirPath + '/' + t.path.slice(oldDirPath.length + 1) }
        : t,
    ));
    setActiveTab(at => {
      if (!at) return at;
      if (at.folder === oldFolder && at.path.startsWith(oldDirPath + '/')) {
        return { ...at, folder: newFolder, path: newDirPath + '/' + at.path.slice(oldDirPath.length + 1) };
      }
      return at;
    });
    setOpenFolderPaths(prev => {
      const next = new Set<string>();
      const oldFolderPath = `${oldFolder}/${oldDirPath}`;
      const newFolderPath = `${newFolder}/${newDirPath}`;
      for (const p of prev) {
        if (p === oldFolderPath) next.add(newFolderPath);
        else if (p.startsWith(oldFolderPath + '/')) next.add(newFolderPath + p.slice(oldFolderPath.length));
        else next.add(p);
      }
      return next;
    });
  }

  async function handleRenameFolder(oldName: string, newName: string) {
    setRenamingKey(null);
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    const slug = slugify(trimmed);
    if (slug === oldName) return;
    if (folders.includes(slug)) { pushToast(`Folder "${slug}" already exists`); return; }
    try {
      await renameNoteFolder(oldName, slug);
      setFolders(prev => prev.map(f => f === oldName ? slug : f).sort());
      setFolderFiles(prev => {
        const { [oldName]: files, ...rest } = prev;
        return { ...rest, [slug]: files };
      });
      function remapKeys<T>(obj: Record<string, T>): Record<string, T> {
        const next: Record<string, T> = {};
        for (const [k, v] of Object.entries(obj)) {
          next[k.startsWith(oldName + '/') ? slug + k.slice(oldName.length) : k] = v;
        }
        return next;
      }
      setOpenFiles(prev => remapKeys(prev));
      setSavingState(prev => remapKeys(prev));
      setSavedAt(prev => remapKeys(prev));
      setTabs(prev => prev.map(t => t.folder === oldName ? { ...t, folder: slug } : t));
      setActiveTab(at => at?.folder === oldName ? { ...at, folder: slug } : at);
      setOpenFolderPaths(prev => {
        const next = new Set<string>();
        for (const p of prev) {
          if (p === oldName) next.add(slug);
          else if (p.startsWith(oldName + '/')) next.add(slug + p.slice(oldName.length));
          else next.add(p);
        }
        return next;
      });
      pushToast(`Renamed folder to "${slug}"`);
    } catch (err) {
      pushToast(`Rename failed: ${String(err)}`);
    }
  }

  async function handleRename(folder: string, path: string, newName: string) {
    setRenamingKey(null);
    const trimmed = newName.trim();
    if (!trimmed) return;
    const isDir = !path.endsWith('.md') && !ASSET_EXTS.has(path.split('.').pop()?.toLowerCase() ?? '');
    const slug = slugify(trimmed);
    const newBaseName = isDir ? slug : (slug.endsWith('.md') ? slug : `${slug}.md`);
    const parentDir = path.includes('/') ? path.split('/').slice(0, -1).join('/') : '';
    const newPath = parentDir ? `${parentDir}/${newBaseName}` : newBaseName;
    if (newPath === path) return;
    const key = `${folder}/${path}`;
    if (savingState[key] === 'saving') {
      pushToast('Save in progress — try again in a moment');
      return;
    }
    try {
      await renameNote(folder, path, newPath);
      setFolderFiles(prev => {
        const entries = prev[folder] ?? [];
        if (isDir) {
          const oldPrefix = path + '/';
          const newPrefix = newPath + '/';
          return { ...prev, [folder]: entries.map(e => e.path.startsWith(oldPrefix) ? { ...e, path: newPrefix + e.path.slice(oldPrefix.length) } : e) };
        }
        return { ...prev, [folder]: entries.map(e => e.path === path ? { ...e, path: newPath } : e) };
      });
      if (isDir) migrateDirKeys(folder, path, folder, newPath);
      else migrateKey(folder, path, folder, newPath);
      pushToast(`Renamed to ${newPath}`);
    } catch (err) {
      pushToast(`Rename failed: ${String(err)}`);
    }
  }

  async function handleDeleteFolder(folder: string) {
    const entries = folderFiles[folder] ?? [];
    const count = entries.filter(e => e.kind !== 'asset').length;
    setConfirm({
      title: `Delete folder "${folder}"?`,
      message: `"${folder}" and its ${count} note${count !== 1 ? 's' : ''} will be moved to the trash.`,
      confirmLabel: 'Delete', danger: true,
      onConfirm: async () => {
        try {
          await deleteNoteFolder(folder);
          setFolders(prev => prev.filter(f => f !== folder));
          setFolderFiles(prev => { const next = { ...prev }; delete next[folder]; return next; });
          setTabs(prev => {
            const newTabs = prev.filter(t => t.folder !== folder);
            setActiveTab(at => at?.folder === folder ? (newTabs[newTabs.length - 1] ?? null) : at);
            return newTabs;
          });
          pushToast(`Deleted folder "${folder}"`);
        } catch (err) {
          pushToast(`Delete failed: ${String(err)}`);
        }
      },
    });
  }

  async function handleMove(srcFolder: string, srcPath: string, destFolder: string, destSubdir?: string) {
    const basename = srcPath.split('/').pop() ?? srcPath;
    const newPath = destSubdir ? `${destSubdir}/${basename}` : basename;
    if (srcFolder === destFolder && srcPath === newPath) return;
    const isDir = !srcPath.endsWith('.md') && !ASSET_EXTS.has(srcPath.split('.').pop()?.toLowerCase() ?? '');
    if (isDir && `${destFolder}/${destSubdir ?? ''}`.startsWith(`${srcFolder}/${srcPath}`)) {
      pushToast("Can't move a folder into itself");
      return;
    }
    const srcKey = `${srcFolder}/${srcPath}`;
    if (savingState[srcKey] === 'saving') { pushToast('Save in progress — try again'); return; }
    try {
      await renameNote(srcFolder, srcPath, newPath, destFolder !== srcFolder ? destFolder : undefined);
      const srcEntry = (folderFiles[srcFolder] ?? []).find(e => e.path === srcPath);
      setFolderFiles(prev => {
        const removedSrc = (prev[srcFolder] ?? []).filter(e =>
          isDir ? e.path !== srcPath && !e.path.startsWith(srcPath + '/') : e.path !== srcPath,
        );
        if (isDir) {
          const movedEntries = (prev[srcFolder] ?? []).filter(e => e.path.startsWith(srcPath + '/'))
            .map(e => ({ ...e, path: newPath + e.path.slice(srcPath.length) }));
          const destEntries = [...(prev[destFolder] ?? []), ...movedEntries];
          return { ...prev, [srcFolder]: removedSrc, [destFolder]: destEntries };
        }
        const newEntry = srcEntry ? { ...srcEntry, path: newPath } : null;
        const destEntries = [...(prev[destFolder] ?? []), ...(newEntry ? [newEntry] : [])];
        return { ...prev, [srcFolder]: removedSrc, [destFolder]: destEntries };
      });
      if (isDir) migrateDirKeys(srcFolder, srcPath, destFolder, newPath);
      else migrateKey(srcFolder, srcPath, destFolder, newPath);
      pushToast(`Moved to ${destFolder}/${newPath}`);
    } catch (err) {
      pushToast(`Move failed: ${String(err)}`);
    }
  }

  function handleOpenLink(href: string) {
    if (!activeTab) return;
    let folder = activeTab.folder;
    let path = href;
    const crossFolder = /^\.\.\/([^/]+)\/(.+)$/.exec(href);
    if (crossFolder) { folder = crossFolder[1]; path = crossFolder[2]; }
    else {
      const abs = /^([^/]+)\/(.+)$/.exec(href);
      if (abs) { folder = abs[1]; path = abs[2]; }
    }
    openFile(folder, path).catch(() => pushToast(`Note not found: ${folder}/${path}`));
  }

  // ---- Trees ----
  const folderTrees = useFolderTree(folders, folderFiles);

  const activeFile = activeTab ? openFiles[tabKey(activeTab)] : null;

  return (
    <>
      <div className="notes-shell">
        <FolderSidebar
          folders={folders}
          folderFiles={folderFiles}
          folderTrees={folderTrees}
          openFiles={openFiles}
          activeTab={activeTab}
          filter={filter}
          openFolderPaths={openFolderPaths}
          creatingIn={creatingIn}
          creatingDirIn={creatingDirIn}
          newFolderMode={newFolderMode}
          renamingKey={renamingKey}
          dragTarget={dragTarget}
          setFilter={setFilter}
          setCreatingIn={setCreatingIn}
          setCreatingDirIn={setCreatingDirIn}
          setNewFolderMode={setNewFolderMode}
          setRenamingKey={setRenamingKey}
          setDragTarget={setDragTarget}
          setOpenFolderPaths={setOpenFolderPaths}
          setContextMenu={setContextMenu}
          onToggleFolder={toggleFolder}
          onOpenFile={openFile}
          onMove={handleMove}
          onCreateFolder={handleCreateFolder}
          onRenameFolder={handleRenameFolder}
          onRename={handleRename}
          onCommitNewFileInFolder={commitNewFileInFolder}
          onCommitNewDirInFolder={commitNewDirInFolder}
        />

        {/* Main */}
        <main className="notes-main">
          <EditorTabs
            tabs={tabs}
            activeTab={activeTab}
            openFiles={openFiles}
            onSelect={(tab) => openFile(tab.folder, tab.path)}
            onClose={closeTab}
          />

          {activeTab && (
            <BreadcrumbNav activeTab={activeTab} savingState={savingState} savedAt={savedAt} />
          )}

          <EditorContent
            activeTab={activeTab}
            activeFile={activeFile}
            renderMode={renderMode}
            linkIndex={linkIndex}
            folderFiles={folderFiles}
            onContentChange={handleContentChange}
            onOpenLink={handleOpenLink}
            onTriggerQuickAdd={(sel) => { setQuickAddSeed(sel); setQuickAddFolder(undefined); setQuickAddOpen(true); }}
          />
        </main>
      </div>

      {/* Footer */}
      <footer className="toolbar">
        <div className="toolbar-left">
          <button onClick={() => pushToast('Search — coming soon')}>Search</button>
        </div>
        <div className="toolbar-main" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {([
            { folder: 'npcs',      label: 'NPC' },
            { folder: 'locations', label: 'Location' },
            { folder: 'factions',  label: 'Faction' },
          ] as const).map(({ folder: f, label }) => (
            <button
              key={f}
              className="is-kind"
              style={{ '--kind-color': folderColor(f) } as React.CSSProperties}
              onClick={() => { setQuickAddSeed(''); setQuickAddFolder(f); setQuickAddOpen(true); }}
              title={`New ${label}`}
            >
              <span className="kind-pip" />+ {label}
            </button>
          ))}
          <button
            className="is-primary"
            onClick={() => { setQuickAddSeed(''); setQuickAddFolder(undefined); setQuickAddOpen(true); }}
          >+ Note</button>
        </div>
        <div className="toolbar-right" style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
          <div className="view-switcher" title="Editor mode">
            {(['live', 'source', 'split'] as RenderMode[]).map(mode => (
              <button key={mode} className={renderMode === mode ? 'is-active' : ''} onClick={() => setRenderMode(mode)}>
                {mode[0].toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
          <div className="view-switcher">
            <button onClick={() => window.dispatchEvent(new CustomEvent('notes:exit'))}>Timeline</button>
            <button className="is-active">Notes</button>
          </div>
        </div>
      </footer>

      <QuickAdd
        open={quickAddOpen}
        folders={folders}
        initialText={quickAddSeed}
        initialFolder={quickAddFolder}
        onClose={() => { setQuickAddOpen(false); setQuickAddFolder(undefined); }}
        onCreate={handleQuickAddCreate}
      />

      <div className="notes-toasts">
        {toasts.map(t => <div key={t.id} className="notes-toast">{t.message}</div>)}
      </div>

      {confirm && (
        <div className="confirm-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setConfirm(null); }}>
          <div className="confirm-panel">
            <div className="confirm-title">{confirm.title}</div>
            <div className="confirm-msg">{confirm.message}</div>
            <div className="confirm-actions">
              <button onClick={() => setConfirm(null)}>Cancel</button>
              <button
                className={confirm.danger ? 'is-danger' : 'is-primary'}
                onClick={() => { confirm.onConfirm(); setConfirm(null); }}
              >{confirm.confirmLabel}</button>
            </div>
          </div>
        </div>
      )}

      {contextMenu && (
        <NoteContextMenu
          target={contextMenu}
          onClose={() => setContextMenu(null)}
          onNewFile={(folder, subdir) => {
            setContextMenu(null);
            setCreatingIn({ folder, subdir });
            if (subdir) setOpenFolderPaths(prev => new Set([...prev, folder, `${folder}/${subdir}`]));
            else if (!openFolderPaths.has(folder)) toggleFolder(folder, folder);
          }}
          onNewFolder={(folder, subdir) => {
            setContextMenu(null);
            setCreatingDirIn({ folder, subdir });
            if (subdir) setOpenFolderPaths(prev => new Set([...prev, folder, `${folder}/${subdir}`]));
            else if (!openFolderPaths.has(folder)) toggleFolder(folder, folder);
          }}
          onRename={(folder, path) => {
            setContextMenu(null);
            setRenamingKey(path === '' ? folder : `${folder}/${path}`);
          }}
          onDelete={(folder, path, kind) => {
            setContextMenu(null);
            if (kind === 'topfolder') handleDeleteFolder(folder);
            else handleDeleteFile(folder, path!);
          }}
        />
      )}
    </>
  );
}
