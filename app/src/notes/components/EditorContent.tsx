import React from 'react';
import type { LinkIndexEntry } from '../../data/types.ts';
import { tabKey, type FileState, type NoteEntry, type OpenTab } from '../types.ts';
import { LiveEditor } from '../editor/LiveEditor.tsx';

export type RenderMode = 'live' | 'source' | 'split';

interface EditorContentProps {
  activeTab: OpenTab | null;
  activeFile: FileState | null;
  renderMode: RenderMode;
  linkIndex: LinkIndexEntry[];
  folderFiles: Record<string, NoteEntry[] | null>;
  onContentChange: (folder: string, path: string, content: string) => void;
  onOpenLink: (href: string) => void;
  onTriggerQuickAdd: (sel: string) => void;
}

/** The editor pane: dispatches between empty / asset / loading /
 * source / split / live based on the active tab and the chosen mode. */
export function EditorContent({
  activeTab, activeFile, renderMode, linkIndex, folderFiles,
  onContentChange, onOpenLink, onTriggerQuickAdd,
}: EditorContentProps) {
  if (!activeTab) {
    return (
      <div className="empty-pane">
        <div className="empty-pane-mark">∅</div>
        <div>No note open</div>
        <div className="empty-pane-hint">
          Pick a note from the sidebar, or press <kbd>Ctrl+K</kbd> to create one.
        </div>
      </div>
    );
  }

  if (activeTab.fileKind === 'asset') {
    return (
      <div className="image-pane">
        <img
          src={`/api/notes/${encodeURIComponent(activeTab.folder)}/${activeTab.path}`}
          alt={activeTab.path.split('/').pop()}
        />
      </div>
    );
  }

  if (!activeFile || activeFile.loading || activeFile.content === null) {
    return <div className="loading-pane">loading…</div>;
  }

  const folderAssets = (folderFiles[activeTab.folder] ?? [])
    .filter(e => e.kind === 'asset')
    .map(e => ({ path: `${activeTab.folder}/${e.path}`, title: e.path.split('/').pop()! }));

  const liveEditor = (suffix: string) => (
    <LiveEditor
      key={tabKey(activeTab) + suffix}
      value={activeFile.content!}
      onChange={(v) => onContentChange(activeTab.folder, activeTab.path, v)}
      currentFolder={activeTab.folder}
      linkIndex={linkIndex}
      currentFolderAssets={folderAssets}
      onOpenLink={onOpenLink}
      onTriggerQuickAdd={onTriggerQuickAdd}
    />
  );

  const sourceTextarea = (
    <textarea
      className="source-editor"
      value={activeFile.content}
      onChange={(e) => onContentChange(activeTab.folder, activeTab.path, e.target.value)}
      spellCheck={false}
    />
  );

  if (renderMode === 'source') {
    return (
      <div className="editor-surface mode-source">
        <div className="editor-pane">{sourceTextarea}</div>
      </div>
    );
  }

  if (renderMode === 'split') {
    return (
      <div className="editor-surface mode-split">
        <div className="editor-pane">{sourceTextarea}</div>
        <div className="editor-pane">{liveEditor(':split')}</div>
      </div>
    );
  }

  return (
    <div className="editor-surface mode-live">
      <div className="editor-pane">{liveEditor(':live')}</div>
    </div>
  );
}
