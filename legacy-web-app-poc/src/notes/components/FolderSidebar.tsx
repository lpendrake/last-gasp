import React from 'react';
import {
  folderColor, type FileState, type NoteEntry, type OpenTab, type TreeNode,
} from '../types.ts';
import type { ContextMenuTarget } from './NoteContextMenu.tsx';

const DRAG_MIME = 'application/x-last-gasp-note';
interface NoteDragPayload { folder: string; path: string; kind: 'file' | 'dir' | 'topfolder'; displayName: string }

interface CreatingCtx { folder: string; subdir?: string }

interface FolderSidebarProps {
  // Data
  folders: string[];
  folderFiles: Record<string, NoteEntry[] | null>;
  folderTrees: Record<string, TreeNode[]>;
  openFiles: Record<string, FileState>;
  activeTab: OpenTab | null;

  // UI state
  filter: string;
  openFolderPaths: Set<string>;
  creatingIn: CreatingCtx | null;
  creatingDirIn: CreatingCtx | null;
  newFolderMode: boolean;
  renamingKey: string | null;
  dragTarget: string | null;

  // Setters
  setFilter: (v: string) => void;
  setCreatingIn: (v: CreatingCtx | null) => void;
  setCreatingDirIn: (v: CreatingCtx | null) => void;
  setNewFolderMode: (v: boolean) => void;
  setRenamingKey: (v: string | null) => void;
  setDragTarget: React.Dispatch<React.SetStateAction<string | null>>;
  setOpenFolderPaths: React.Dispatch<React.SetStateAction<Set<string>>>;
  setContextMenu: (target: ContextMenuTarget | null) => void;

  // Handlers
  onToggleFolder: (folderPath: string, topFolder: string) => Promise<void>;
  onOpenFile: (folder: string, path: string, fileKind?: 'note' | 'asset') => void;
  onMove: (srcFolder: string, srcPath: string, destFolder: string, destSubdir?: string) => void;
  onCreateFolder: (name: string) => Promise<void>;
  onRenameFolder: (oldName: string, newName: string) => Promise<void>;
  onRename: (folder: string, path: string, newName: string) => Promise<void>;
  onCommitNewFileInFolder: (ctx: CreatingCtx, name: string) => Promise<void>;
  onCommitNewDirInFolder: (ctx: CreatingCtx, name: string) => Promise<void>;
}

/** Vault sidebar: filter input + collapsible per-folder tree of notes
 * and assets. All state and handlers come from the parent (Notes); this
 * component is a renderer plus drag-drop wiring. */
export function FolderSidebar(props: FolderSidebarProps) {
  const {
    folders, folderFiles, folderTrees, openFiles, activeTab,
    filter, openFolderPaths, creatingIn, creatingDirIn, newFolderMode, renamingKey, dragTarget,
    setFilter, setCreatingIn, setCreatingDirIn, setNewFolderMode, setRenamingKey, setDragTarget,
    setOpenFolderPaths, setContextMenu,
    onToggleFolder, onOpenFile, onMove, onCreateFolder, onRenameFolder, onRename,
    onCommitNewFileInFolder, onCommitNewDirInFolder,
  } = props;

  function renderTreeNode(node: TreeNode, topFolder: string, depth: number): React.ReactNode {
    const indent = depth * 12;
    if (node.kind === 'file') {
      const isAsset = node.fileKind === 'asset';
      const isActive = activeTab?.folder === topFolder && activeTab.path === node.path;
      const file = openFiles[`${topFolder}/${node.path}`];
      const isRenaming = renamingKey === `${topFolder}/${node.path}`;
      const dragPayload: NoteDragPayload = { folder: topFolder, path: node.path, kind: 'file', displayName: node.name.replace(/\.md$/, '') };
      return (
        <button
          key={node.path}
          className={`file-row${isAsset ? ' is-asset' : ''}${isActive ? ' is-active' : ''}`}
          style={{ '--kind-color': folderColor(topFolder), paddingLeft: 8 + indent } as React.CSSProperties}
          draggable
          onClick={() => onOpenFile(topFolder, node.path, isAsset ? 'asset' : undefined)}
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ kind: 'file', folder: topFolder, path: node.path, x: e.clientX, y: e.clientY }); }}
          onDragStart={(e) => { e.dataTransfer.setData(DRAG_MIME, JSON.stringify(dragPayload)); e.dataTransfer.setData('text/plain', dragPayload.displayName); e.dataTransfer.effectAllowed = 'move'; }}
          onDragEnd={() => setDragTarget(null)}
        >
          <span className={`file-dot${isAsset ? ' is-asset' : ''}`} />
          {isRenaming ? (
            <input
              className="new-file-input"
              autoFocus
              defaultValue={node.name.replace(/\.md$/, '')}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') { e.currentTarget.blur(); return; } if (e.key === 'Escape') { e.currentTarget.dataset.cancelled = '1'; setRenamingKey(null); } }}
              onBlur={(e) => { if (e.currentTarget.dataset.cancelled) return; onRename(topFolder, node.path, e.target.value); }}
            />
          ) : (
            <span className="file-name">{isAsset ? node.name : node.name.replace(/\.md$/, '')}</span>
          )}
          {file?.dirty && !isRenaming && <span className="file-dirty">●</span>}
        </button>
      );
    }
    const dirKey = `${topFolder}/${node.path}`;
    const isOpen = openFolderPaths.has(dirKey);
    const isDragOver = dragTarget === dirKey;
    const isRenaming = renamingKey === dirKey;
    const dragPayload: NoteDragPayload = { folder: topFolder, path: node.path, kind: 'dir', displayName: node.name };
    return (
      <div key={node.path} className="sidebar-folder">
        <button
          className={`folder-row${isOpen ? ' is-open' : ''}${isDragOver ? ' is-drag-over' : ''}`}
          style={{ paddingLeft: 4 + indent } as React.CSSProperties}
          draggable
          onClick={() => { setOpenFolderPaths(prev => { const next = new Set(prev); if (next.has(dirKey)) next.delete(dirKey); else next.add(dirKey); return next; }); }}
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ kind: 'dir', folder: topFolder, path: node.path, x: e.clientX, y: e.clientY }); }}
          onDragStart={(e) => { e.dataTransfer.setData(DRAG_MIME, JSON.stringify(dragPayload)); e.dataTransfer.setData('text/plain', node.name); e.dataTransfer.effectAllowed = 'move'; }}
          onDragEnd={() => setDragTarget(null)}
          onDragOver={(e) => { if (!e.dataTransfer.types.includes(DRAG_MIME)) return; e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; setDragTarget(dirKey); }}
          onDragLeave={() => setDragTarget(prev => prev === dirKey ? null : prev)}
          onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setDragTarget(null); const raw = e.dataTransfer.getData(DRAG_MIME); if (!raw) return; const p: NoteDragPayload = JSON.parse(raw); onMove(p.folder, p.path, topFolder, node.path); }}
        >
          <span className="folder-caret">{isOpen ? '▾' : '▸'}</span>
          {isRenaming ? (
            <input
              className="new-file-input"
              autoFocus
              defaultValue={node.name}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') { e.currentTarget.blur(); return; } if (e.key === 'Escape') { e.currentTarget.dataset.cancelled = '1'; setRenamingKey(null); } }}
              onBlur={(e) => { if (e.currentTarget.dataset.cancelled) return; onRename(topFolder, node.path, e.target.value); }}
            />
          ) : (
            <span className="folder-name">{node.name}/</span>
          )}
        </button>
        {isOpen && (
          <div className="folder-children">
            {node.children.map(child => renderTreeNode(child, topFolder, depth + 1))}
            {creatingDirIn?.folder === topFolder && creatingDirIn.subdir === node.path && (
              <div className="new-file-row" style={{ paddingLeft: 8 + (depth + 1) * 12 } as React.CSSProperties}>
                <span className="folder-caret">▸</span>
                <input
                  className="new-file-input"
                  autoFocus
                  placeholder="folder-name"
                  onKeyDown={(e) => { if (e.key === 'Enter') onCommitNewDirInFolder(creatingDirIn, e.currentTarget.value); if (e.key === 'Escape') setCreatingDirIn(null); }}
                  onBlur={(e) => onCommitNewDirInFolder(creatingDirIn!, e.target.value)}
                />
              </div>
            )}
            {creatingIn?.folder === topFolder && creatingIn.subdir === node.path && (
              <div className="new-file-row" style={{ paddingLeft: 8 + (depth + 1) * 12 } as React.CSSProperties}>
                <span className="file-dot" style={{ '--kind-color': folderColor(topFolder) } as React.CSSProperties} />
                <input
                  className="new-file-input"
                  autoFocus
                  placeholder="new-note-title"
                  onKeyDown={(e) => { if (e.key === 'Enter') onCommitNewFileInFolder(creatingIn, e.currentTarget.value); if (e.key === 'Escape') setCreatingIn(null); }}
                  onBlur={(e) => onCommitNewFileInFolder(creatingIn!, e.target.value)}
                />
              </div>
            )}
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
          const isDragOver = dragTarget === folder;
          const topDragPayload: NoteDragPayload = { folder, path: '', kind: 'topfolder', displayName: folder };
          return (
            <div key={folder} className="sidebar-folder">
              <button
                className={`folder-row${isOpen ? ' is-open' : ''}${isDragOver ? ' is-drag-over' : ''}`}
                style={{ '--kind-color': folderColor(folder) } as React.CSSProperties}
                draggable
                onClick={() => onToggleFolder(folder, folder)}
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ kind: 'topfolder', folder, x: e.clientX, y: e.clientY }); }}
                onDragStart={(e) => { e.dataTransfer.setData(DRAG_MIME, JSON.stringify(topDragPayload)); e.dataTransfer.setData('text/plain', folder); e.dataTransfer.effectAllowed = 'move'; }}
                onDragEnd={() => setDragTarget(null)}
                onDragOver={(e) => { if (!e.dataTransfer.types.includes(DRAG_MIME)) return; e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; setDragTarget(folder); }}
                onDragLeave={() => setDragTarget(prev => prev === folder ? null : prev)}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setDragTarget(null); const raw = e.dataTransfer.getData(DRAG_MIME); if (!raw) return; const p: NoteDragPayload = JSON.parse(raw); if (p.kind !== 'topfolder') onMove(p.folder, p.path, folder); }}
              >
                <span className="folder-caret">{isOpen ? '▾' : '▸'}</span>
                {renamingKey === folder ? (
                  <input
                    className="new-file-input"
                    autoFocus
                    defaultValue={folder}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') { e.currentTarget.blur(); return; } if (e.key === 'Escape') { e.currentTarget.dataset.cancelled = '1'; setRenamingKey(null); } }}
                    onBlur={(e) => { if (e.currentTarget.dataset.cancelled) return; onRenameFolder(folder, e.target.value); }}
                  />
                ) : (
                  <>
                    <span className="folder-name">{folder}/</span>
                    <span className="folder-count">{count}</span>
                  </>
                )}
                <span
                  className="folder-add"
                  title={`New in ${folder}/`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isOpen) {
                      onToggleFolder(folder, folder).then(() => setCreatingIn({ folder }));
                    } else {
                      setCreatingIn({ folder });
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
                  {creatingDirIn?.folder === folder && !creatingDirIn.subdir && (
                    <div className="new-file-row">
                      <span className="folder-caret">▸</span>
                      <input
                        className="new-file-input"
                        autoFocus
                        placeholder="folder-name"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') onCommitNewDirInFolder(creatingDirIn, e.currentTarget.value);
                          if (e.key === 'Escape') setCreatingDirIn(null);
                        }}
                        onBlur={(e) => onCommitNewDirInFolder(creatingDirIn!, e.target.value)}
                      />
                    </div>
                  )}
                  {creatingIn?.folder === folder && (!creatingIn.subdir || !tree.some(n => n.kind === 'dir' && n.path === creatingIn.subdir)) && (
                    <div className="new-file-row">
                      <span className="file-dot" style={{ '--kind-color': folderColor(folder) } as React.CSSProperties} />
                      {creatingIn.subdir && <span style={{ color: 'var(--theme-text-muted)', fontSize: 12 }}>{creatingIn.subdir}/</span>}
                      <input
                        className="new-file-input"
                        autoFocus
                        placeholder="new-note-title"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') onCommitNewFileInFolder(creatingIn, e.currentTarget.value);
                          if (e.key === 'Escape') setCreatingIn(null);
                        }}
                        onBlur={(e) => onCommitNewFileInFolder(creatingIn!, e.target.value)}
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
                if (e.key === 'Enter') onCreateFolder(e.currentTarget.value);
                if (e.key === 'Escape') setNewFolderMode(false);
              }}
              onBlur={(e) => onCreateFolder(e.target.value)}
            />
          </div>
        ) : (
          <button className="new-folder-btn" onClick={() => setNewFolderMode(true)}>+ new folder</button>
        )}
      </div>
    </aside>
  );
}
