import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  listNoteFolders, createNoteFolder, listNotes,
  getNote, createNote, putNote, deleteNote, getLinkIndex,
} from '../data/api.ts';
import type { LinkIndexEntry } from '../data/types.ts';
import { LiveEditor } from './LiveEditor.tsx';
import { QuickAdd } from './QuickAdd.tsx';
import {
  buildTree, folderColor, tabKey, slugify,
  type NoteEntry, type OpenTab, type FileState, type Toast,
  type ConfirmState, type TreeNode,
} from './types.ts';

type RenderMode = 'live' | 'source' | 'split';
type SaveStatus = 'dirty' | 'saving' | 'saved' | 'clean';

export function NotesApp() {
  // ---- Data ----
  const [folders, setFolders] = useState<string[]>([]);
  const [folderFiles, setFolderFiles] = useState<Record<string, NoteEntry[] | null>>({});
  const [openFiles, setOpenFiles] = useState<Record<string, FileState>>({});
  const [linkIndex, setLinkIndex] = useState<LinkIndexEntry[]>([]);

  // ---- Tabs ----
  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [activeTab, setActiveTab] = useState<OpenTab | null>(null);

  // ---- Sidebar ----
  const [openFolderPaths, setOpenFolderPaths] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');
  const [creatingIn, setCreatingIn] = useState<string | null>(null);
  const [newFolderMode, setNewFolderMode] = useState(false);

  // ---- UI ----
  const [renderMode, setRenderMode] = useState<RenderMode>('live');
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddSeed, setQuickAddSeed] = useState('');
  const [quickAddFolder, setQuickAddFolder] = useState<string | undefined>(undefined);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [savingState, setSavingState] = useState<Record<string, SaveStatus>>({});

  // ---- Bootstrap ----
  useEffect(() => {
    Promise.all([
      listNoteFolders().then(fs => setFolders(fs.map(f => f.name))),
      getLinkIndex().then(setLinkIndex),
    ]).catch(err => pushToast(`Failed to load: ${String(err)}`));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Auto-save ----
  useEffect(() => {
    const dirtyKeys = Object.entries(savingState)
      .filter(([, v]) => v === 'dirty')
      .map(([k]) => k);
    if (dirtyKeys.length === 0) return;
    const id = setTimeout(async () => {
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
    }, 500);
    return () => clearTimeout(id);
  }, [savingState, openFiles]);

  // ---- Global hotkeys ----
  useEffect(() => {
    function handler(e: KeyboardEvent) {
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
  async function openFile(folder: string, path: string) {
    const key = `${folder}/${path}`;
    setTabs(prev => prev.some(t => t.folder === folder && t.path === path) ? prev : [...prev, { folder, path }]);
    setActiveTab({ folder, path });
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

  async function commitNewFileInFolder(folderPath: string, name: string) {
    setCreatingIn(null);
    const trimmed = name.trim();
    if (!trimmed) return;
    const slug = slugify(trimmed);
    const filename = slug.endsWith('.md') ? slug : `${slug}.md`;
    try {
      const content = `# ${trimmed}\n\n`;
      await createNote(folderPath, filename, content);
      setFolderFiles(prev => ({
        ...prev,
        [folderPath]: [...(prev[folderPath] ?? []), { path: filename, title: trimmed, mtime: '' }],
      }));
      await openFile(folderPath, filename);
    } catch (err) {
      pushToast(`Failed to create: ${String(err)}`);
    }
  }

  async function handleDeleteFile(folder: string, path: string) {
    setConfirm({
      title: 'Delete note?',
      message: `"${path}" will be moved to the trash.`,
      confirmLabel: 'Delete', danger: true,
      onConfirm: async () => {
        try {
          await deleteNote(folder, path);
          setFolderFiles(prev => ({
            ...prev,
            [folder]: (prev[folder] ?? []).filter(e => e.path !== path),
          }));
          setTabs(prev => {
            const newTabs = prev.filter(t => !(t.folder === folder && t.path === path));
            setActiveTab(at => {
              if (at?.folder === folder && at.path === path) return newTabs[newTabs.length - 1] ?? null;
              return at;
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

  const pushToast = useCallback((message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2600);
  }, []);

  // ---- Trees ----
  const folderTrees = useMemo(() => {
    const out: Record<string, TreeNode[]> = {};
    for (const f of folders) {
      const entries = folderFiles[f];
      out[f] = entries ? buildTree(entries) : [];
    }
    return out;
  }, [folders, folderFiles]);

  const activeFile = activeTab ? openFiles[tabKey(activeTab)] : null;

  function titleForTab(tab: OpenTab): string {
    return tab.path.split('/').pop()?.replace(/\.md$/, '') ?? tab.path;
  }

  // ---- Sidebar tree node renderer ----
  function renderTreeNode(node: TreeNode, topFolder: string, depth: number): React.ReactNode {
    const indent = depth * 12;
    if (node.kind === 'file') {
      const isActive = activeTab?.folder === topFolder && activeTab.path === node.path;
      const file = openFiles[`${topFolder}/${node.path}`];
      return (
        <button
          key={node.path}
          className={`file-row${isActive ? ' is-active' : ''}`}
          style={{ '--kind-color': folderColor(topFolder), paddingLeft: 8 + indent } as React.CSSProperties}
          onClick={() => openFile(topFolder, node.path)}
          onContextMenu={(e) => { e.preventDefault(); handleDeleteFile(topFolder, node.path); }}
        >
          <span className="file-dot" />
          <span className="file-name">{node.name.replace(/\.md$/, '')}</span>
          {file?.dirty && <span className="file-dirty">●</span>}
        </button>
      );
    }
    const dirKey = `${topFolder}/${node.path}`;
    const isOpen = openFolderPaths.has(dirKey);
    return (
      <div key={node.path} className="sidebar-folder">
        <button
          className={`folder-row${isOpen ? ' is-open' : ''}`}
          style={{ paddingLeft: 4 + indent } as React.CSSProperties}
          onClick={() => {
            setOpenFolderPaths(prev => {
              const next = new Set(prev);
              if (next.has(dirKey)) next.delete(dirKey); else next.add(dirKey);
              return next;
            });
          }}
        >
          <span className="folder-caret">{isOpen ? '▾' : '▸'}</span>
          <span className="folder-name">{node.name}/</span>
        </button>
        {isOpen && (
          <div className="folder-children">
            {node.children.map(child => renderTreeNode(child, topFolder, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  function filterMatchesNode(node: TreeNode, q: string): boolean {
    if (node.kind === 'file') return node.title.toLowerCase().includes(q) || node.path.toLowerCase().includes(q);
    return node.children.some(child => filterMatchesNode(child, q));
  }

  function renderFilteredNodes(nodes: TreeNode[], topFolder: string, q: string, depth: number): React.ReactNode[] {
    const result: React.ReactNode[] = [];
    for (const node of nodes) {
      if (!filterMatchesNode(node, q)) continue;
      if (node.kind === 'file') {
        result.push(renderTreeNode(node, topFolder, depth));
      } else {
        const children = renderFilteredNodes(node.children, topFolder, q, depth + 1);
        if (children.length > 0) {
          const indent = depth * 12;
          result.push(
            <div key={node.path}>
              <div className="folder-row is-open" style={{ paddingLeft: 4 + indent } as React.CSSProperties}>
                <span className="folder-caret">▾</span>
                <span className="folder-name">{node.name}/</span>
              </div>
              <div className="folder-children">{children}</div>
            </div>,
          );
        }
      }
    }
    return result;
  }

  const q = filter.toLowerCase().trim();

  return (
    <>
      <div className="notes-shell">
        {/* Sidebar */}
        <aside className="notes-sidebar">
          <div className="sidebar-header">
            <div className="sidebar-title">VAULT · last-gasp</div>
            <input
              className="sidebar-filter"
              placeholder="filter notes…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <div className="sidebar-tree">
            {folders.map(folder => {
              const isOpen = openFolderPaths.has(folder);
              const entries = folderFiles[folder];
              const count = entries?.length ?? '…';
              const tree = folderTrees[folder] ?? [];
              return (
                <div key={folder} className="sidebar-folder">
                  <button
                    className={`folder-row${isOpen ? ' is-open' : ''}`}
                    style={{ '--kind-color': folderColor(folder) } as React.CSSProperties}
                    onClick={() => toggleFolder(folder, folder)}
                  >
                    <span className="folder-caret">{isOpen ? '▾' : '▸'}</span>
                    <span className="folder-name">{folder}/</span>
                    <span className="folder-count">{count}</span>
                    <span
                      className="folder-add"
                      title={`New in ${folder}/`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isOpen) {
                          toggleFolder(folder, folder).then(() => setCreatingIn(folder));
                        } else {
                          setCreatingIn(folder);
                        }
                      }}
                    >+</span>
                  </button>
                  {isOpen && (
                    <div className="folder-children">
                      {entries === null ? (
                        <div className="file-row" style={{ color: 'var(--theme-text-muted)', fontStyle: 'italic', cursor: 'default' }}>loading…</div>
                      ) : q ? (
                        renderFilteredNodes(tree, folder, q, 0)
                      ) : (
                        tree.map(node => renderTreeNode(node, folder, 0))
                      )}
                      {creatingIn === folder && (
                        <div className="new-file-row">
                          <span className="file-dot" style={{ '--kind-color': folderColor(folder) } as React.CSSProperties} />
                          <input
                            className="new-file-input"
                            autoFocus
                            placeholder="new-note-title"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitNewFileInFolder(folder, e.currentTarget.value);
                              if (e.key === 'Escape') setCreatingIn(null);
                            }}
                            onBlur={(e) => commitNewFileInFolder(folder, e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {newFolderMode ? (
              <div className="new-folder-row">
                <input
                  className="new-folder-input"
                  autoFocus
                  placeholder="folder-name"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateFolder(e.currentTarget.value);
                    if (e.key === 'Escape') setNewFolderMode(false);
                  }}
                  onBlur={(e) => handleCreateFolder(e.target.value)}
                />
              </div>
            ) : (
              <button className="new-folder-btn" onClick={() => setNewFolderMode(true)}>+ new folder</button>
            )}
          </div>
        </aside>

        {/* Main */}
        <main className="notes-main">
          {tabs.length > 0 && (
            <div className="tabs-bar">
              {tabs.map(tab => {
                const isActive = activeTab?.folder === tab.folder && activeTab.path === tab.path;
                const file = openFiles[tabKey(tab)];
                return (
                  <div
                    key={tabKey(tab)}
                    className={`tab${isActive ? ' is-active' : ''}`}
                    style={{ '--kind-color': folderColor(tab.folder) } as React.CSSProperties}
                    onClick={() => openFile(tab.folder, tab.path)}
                    onMouseDown={(e) => { if (e.button === 1) { e.preventDefault(); closeTab(tab); } }}
                  >
                    <span className="tab-dot" />
                    <span className="tab-label">{titleForTab(tab)}</span>
                    {file?.dirty && <span className="tab-dirty">●</span>}
                    <button className="tab-close" onClick={(e) => { e.stopPropagation(); closeTab(tab); }} title="Close">×</button>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab && (() => {
            const key = tabKey(activeTab);
            const status: SaveStatus = savingState[key] ?? 'clean';
            const statusText: Record<SaveStatus, string> = {
              clean: 'saved', dirty: 'unsaved', saving: 'saving…', saved: 'saved ✓',
            };
            const pathParts = activeTab.path.split('/');
            return (
              <div className="breadcrumbs">
                <span>vault</span>
                <span className="breadcrumb-sep">/</span>
                <span>{activeTab.folder}</span>
                {pathParts.slice(0, -1).map((part, i) => (
                  <React.Fragment key={i}>
                    <span className="breadcrumb-sep">/</span>
                    <span>{part}</span>
                  </React.Fragment>
                ))}
                <span className="breadcrumb-sep">/</span>
                <span className="breadcrumb-leaf">{pathParts[pathParts.length - 1]}</span>
                <span className={`breadcrumb-status is-${status}`}>{statusText[status]}</span>
              </div>
            );
          })()}

          {!activeTab ? (
            <div className="empty-pane">
              <div className="empty-pane-mark">∅</div>
              <div>No note open</div>
              <div className="empty-pane-hint">
                Pick a note from the sidebar, or press <kbd>Ctrl+K</kbd> to create one.
              </div>
            </div>
          ) : !activeFile || activeFile.loading || activeFile.content === null ? (
            <div className="loading-pane">loading…</div>
          ) : renderMode === 'source' ? (
            <div className="editor-surface mode-source">
              <div className="editor-pane">
                <textarea
                  className="source-editor"
                  value={activeFile.content}
                  onChange={(e) => handleContentChange(activeTab.folder, activeTab.path, e.target.value)}
                  spellCheck={false}
                />
              </div>
            </div>
          ) : renderMode === 'split' ? (
            <div className="editor-surface mode-split">
              <div className="editor-pane">
                <textarea
                  className="source-editor"
                  value={activeFile.content}
                  onChange={(e) => handleContentChange(activeTab.folder, activeTab.path, e.target.value)}
                  spellCheck={false}
                />
              </div>
              <div className="editor-pane">
                <LiveEditor
                  key={tabKey(activeTab) + ':split'}
                  value={activeFile.content}
                  onChange={(v) => handleContentChange(activeTab.folder, activeTab.path, v)}
                  currentFolder={activeTab.folder}
                  linkIndex={linkIndex}
                  onOpenLink={handleOpenLink}
                  onTriggerQuickAdd={(sel) => { setQuickAddSeed(sel); setQuickAddFolder(undefined); setQuickAddOpen(true); }}
                />
              </div>
            </div>
          ) : (
            <div className="editor-surface mode-live">
              <div className="editor-pane">
                <LiveEditor
                  key={tabKey(activeTab) + ':live'}
                  value={activeFile.content}
                  onChange={(v) => handleContentChange(activeTab.folder, activeTab.path, v)}
                  currentFolder={activeTab.folder}
                  linkIndex={linkIndex}
                  onOpenLink={handleOpenLink}
                  onTriggerQuickAdd={(sel) => { setQuickAddSeed(sel); setQuickAddFolder(undefined); setQuickAddOpen(true); }}
                />
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="toolbar">
        <div className="toolbar-left">
          <button onClick={() => pushToast('Search — coming soon')}>Search</button>
        </div>
        <div className="toolbar-main" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {folders.slice(0, 3).map(f => (
            <button
              key={f}
              className="is-kind"
              style={{ '--kind-color': folderColor(f) } as React.CSSProperties}
              onClick={() => { setQuickAddSeed(''); setQuickAddFolder(f); setQuickAddOpen(true); }}
              title={`New note in ${f}/`}
            >
              <span className="kind-pip" style={{ background: folderColor(f) }} />+ {f}
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
    </>
  );
}
