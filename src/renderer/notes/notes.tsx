import { useEffect, useMemo, useRef, useState } from 'react';
import { EditorView } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';
import { useNotesController } from './hooks/useNotesController';
import { MarkdownEditor, FormatToolbar, type SavedEditorInstance } from '../shared/markdown-editor';
import {
  makeImagePasteConfig,
  makeDropLinkConfig,
  makePeekWikiLinksConfig,
} from './editor-bindings';
import { QuickAdd } from './components/quick-add.tsx';
import { NoteContextMenu } from './components/note-context-menu.tsx';
import { EditorTabs } from './components/editor-tabs.tsx';
import { BreadcrumbNav } from './components/breadcrumb-nav.tsx';
import { FolderSidebar } from './components/folder-sidebar.tsx';
import { MetaPanel } from './components/meta-panel.tsx';
import { FooterPortal } from '../components/footer-portal.tsx';

import './styles/index.css';
import './styles/sidebar.css';
import './styles/tabs.css';
import './styles/editor-surface.css';
import './styles/markdown.css';
import './styles/quick-add.css';
import './styles/toast.css';
import './styles/confirm.css';
import './styles/context-menu.css';

interface NotesAppProps {
  campaignId: string;
  campaignPath: string;
  pendingOpenNotePath?: string | null;
  onNoteOpenHandled?: () => void;
  pendingNoteMatchOffset?: number | null;
  onNoteMatchOffsetHandled?: () => void;
  onOpenEvent?: (filename: string) => void;
}

export function NotesApp({
  campaignId,
  campaignPath,
  pendingOpenNotePath,
  onNoteOpenHandled,
  pendingNoteMatchOffset,
  onNoteMatchOffsetHandled,
  onOpenEvent,
}: NotesAppProps) {
  const ctrl = useNotesController({ campaignId, campaignPath, onOpenEvent });
  const knownIds = useMemo(() => new Set(ctrl.linkIndex.map((e) => e.id)), [ctrl.linkIndex]);

  const editorStateCache = useRef(new Map<string, SavedEditorInstance>());
  const editorViewRef = useRef<EditorView | null>(null);

  const [metaOpen, setMetaOpen] = useState(false);

  const activeTabKey = ctrl.activeTab ? `${ctrl.activeTab.folder}/${ctrl.activeTab.path}` : null;
  const isEditableNote =
    ctrl.activeTab?.fileKind !== 'asset' && ctrl.activeTab?.fileKind !== 'unsupported';

  const imagePasteConfig = useMemo(
    () => (ctrl.activeTab ? makeImagePasteConfig(ctrl.activeTab.folder, campaignPath) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctrl.activeTab?.folder, campaignPath],
  );
  const dropLinkConfig = useMemo(() => makeDropLinkConfig(), []);
  const peekWikiLinksConfig = useMemo(() => makePeekWikiLinksConfig(), []);

  // Open a note from the search overlay, then scroll to the match position.
  // Both steps are sequenced here so the scroll happens only after the note's
  // content is loaded and React has committed the editor to the DOM.
  useEffect(() => {
    if (!pendingOpenNotePath) return;
    let cancelled = false;
    const matchOffset = pendingNoteMatchOffset;

    async function run() {
      await ctrl.openNoteByPath(pendingOpenNotePath!);
      if (cancelled) return;

      if (matchOffset != null) {
        // React's re-render is queued as a MessageChannel macro-task; rAF fires
        // in the rendering-update step between tasks, before React commits.
        // Poll until editorViewRef is populated (normally 1-2 frames).
        let view: EditorView | null = null;
        for (let attempt = 0; attempt < 20 && !cancelled; attempt++) {
          await new Promise<void>((r) => requestAnimationFrame(r));
          view = editorViewRef.current;
          if (view) break;
        }
        if (!cancelled && view) {
          const offset = Math.min(matchOffset, view.state.doc.length);
          view.dispatch({
            selection: EditorSelection.cursor(offset),
            effects: EditorView.scrollIntoView(offset, { y: 'center' }),
          });
          view.focus();
          // CM6 uses estimated line heights for content it hasn't rendered yet.
          // A second pass one frame later corrects positions near the end of
          // long files where the first estimate is slightly short.
          await new Promise<void>((r) => requestAnimationFrame(r));
          if (!cancelled) {
            view.dispatch({ effects: EditorView.scrollIntoView(offset, { y: 'center' }) });
          }
        }
      }

      onNoteMatchOffsetHandled?.();
      onNoteOpenHandled?.();
    }

    run().catch(console.error);
    return () => {
      cancelled = true;
    };
    // ctrl.openNoteByPath and handlers are stable; matchOffset is captured on entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingOpenNotePath]);

  function handleFrontmatterChange(value: string) {
    if (!ctrl.activeTab) return;
    ctrl.handleFrontmatterChange(ctrl.activeTab.folder, ctrl.activeTab.path, value);
  }

  return (
    <>
      <div className="notes-shell">
        <FolderSidebar
          folders={ctrl.folders}
          folderFiles={ctrl.folderFiles}
          folderTrees={ctrl.folderTrees}
          openFiles={ctrl.openFiles}
          activeTab={ctrl.activeTab}
          filter={ctrl.filter}
          openFolderPaths={ctrl.openFolderPaths}
          creatingIn={ctrl.creatingIn}
          creatingDirIn={ctrl.creatingDirIn}
          newFolderMode={ctrl.newFolderMode}
          renamingKey={ctrl.renamingKey}
          dragTarget={ctrl.dragTarget}
          setFilter={ctrl.setFilter}
          setCreatingIn={ctrl.setCreatingIn}
          setCreatingDirIn={ctrl.setCreatingDirIn}
          setNewFolderMode={ctrl.setNewFolderMode}
          setRenamingKey={ctrl.setRenamingKey}
          setDragTarget={ctrl.setDragTarget}
          setOpenFolderPaths={ctrl.setOpenFolderPaths}
          setContextMenu={ctrl.setContextMenu}
          onToggleFolder={ctrl.toggleFolder}
          onOpenFile={ctrl.openFile}
          onMove={ctrl.handleMove}
          onCreateFolder={ctrl.handleCreateFolder}
          onRenameFolder={ctrl.handleRenameFolder}
          onRename={ctrl.handleRename}
          onCommitNewFileInFolder={ctrl.commitNewFileInFolder}
          onCommitNewDirInFolder={ctrl.commitNewDirInFolder}
        />

        <main className="notes-main">
          <EditorTabs
            tabs={ctrl.tabs}
            activeTab={ctrl.activeTab}
            openFiles={ctrl.openFiles}
            onSelect={(tab) => ctrl.openFile(tab.folder, tab.path)}
            onClose={ctrl.closeTab}
          />

          {ctrl.activeTab && (
            <BreadcrumbNav
              activeTab={ctrl.activeTab}
              savingState={ctrl.savingState}
              savedAt={ctrl.savedAt}
            />
          )}

          <div className="editor-surface">
            {metaOpen && isEditableNote && ctrl.activeFile && (
              <MetaPanel
                frontmatter={ctrl.activeFile.frontmatter}
                onChange={handleFrontmatterChange}
              />
            )}
            {activeTabKey && ctrl.activeTab?.fileKind === 'unsupported' ? (
              <div className="editor-placeholder">File type not supported</div>
            ) : activeTabKey && ctrl.activeFile && ctrl.activeFile.content !== null ? (
              <MarkdownEditor
                key={activeTabKey}
                content={ctrl.activeFile.content}
                onChange={(val) =>
                  ctrl.handleContentChange(ctrl.activeTab!.folder, ctrl.activeTab!.path, val)
                }
                isSourceMode={ctrl.renderMode === 'source'}
                savedInstance={editorStateCache.current.get(activeTabKey)}
                onSaveInstance={(inst) => editorStateCache.current.set(activeTabKey, inst)}
                viewRef={editorViewRef}
                wikiLinks={{
                  suggest: ctrl.suggestLinks,
                  onOpen: ctrl.handleOpenLink,
                  ...peekWikiLinksConfig,
                  knownIds,
                }}
                mdLinks={{ onOpenInternal: ctrl.openMarkdownLink }}
                imagePaste={imagePasteConfig}
                dropLink={dropLinkConfig}
              />
            ) : ctrl.activeTab ? (
              <div className="editor-placeholder">Loading...</div>
            ) : (
              <div className="editor-placeholder">Select a note to start writing</div>
            )}
          </div>
        </main>
      </div>

      <FooterPortal slot="center">
        <FormatToolbar
          viewRef={editorViewRef}
          isEditable={!!isEditableNote && !!ctrl.activeTab}
          footerSlot={
            <>
              {isEditableNote && (
                <button
                  className={`ftb-btn${metaOpen ? ' is-active' : ''}`}
                  title="Toggle metadata panel"
                  onClick={() => setMetaOpen((v) => !v)}
                >
                  Meta
                </button>
              )}
              <div className="view-switcher">
                <button
                  className={ctrl.renderMode === 'source' ? 'is-active' : ''}
                  title="Toggle editor mode"
                  onClick={() =>
                    ctrl.handleSetRenderMode(ctrl.renderMode === 'live' ? 'source' : 'live')
                  }
                >
                  {ctrl.renderMode === 'live' ? 'Live' : 'Source'}
                </button>
              </div>
            </>
          }
        />
      </FooterPortal>

      <QuickAdd
        open={ctrl.quickAddOpen}
        folders={ctrl.folders}
        initialText={ctrl.quickAddSeed}
        initialFolder={ctrl.quickAddFolder}
        onClose={() => {
          ctrl.setQuickAddOpen(false);
          ctrl.setQuickAddFolder(undefined);
        }}
        onCreate={ctrl.handleQuickAddCreate}
      />

      <div className="notes-toasts">
        {ctrl.toasts.map((t) => (
          <div key={t.id} className={`notes-toast${t.isError ? ' is-error' : ''}`}>
            {t.message}
            {t.isError && (
              <button className="toast-dismiss" onClick={() => ctrl.dismissToast(t.id)}>
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      {ctrl.confirm && (
        <div
          className="confirm-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) ctrl.setConfirm(null);
          }}
        >
          <div className="confirm-panel">
            <div className="confirm-title">{ctrl.confirm.title}</div>
            <div className="confirm-msg">{ctrl.confirm.message}</div>
            <div className="confirm-actions">
              <button onClick={() => ctrl.setConfirm(null)}>Cancel</button>
              <button
                className={ctrl.confirm.danger ? 'is-danger' : 'is-primary'}
                onClick={() => {
                  ctrl.confirm!.onConfirm();
                  ctrl.setConfirm(null);
                }}
              >
                {ctrl.confirm.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {ctrl.contextMenu && (
        <NoteContextMenu
          target={ctrl.contextMenu}
          onClose={() => ctrl.setContextMenu(null)}
          onNewFile={(folder, subdir) => {
            ctrl.setContextMenu(null);
            ctrl.setCreatingIn({ folder, subdir });
            if (subdir)
              ctrl.setOpenFolderPaths((prev) => new Set([...prev, folder, `${folder}/${subdir}`]));
            else if (!ctrl.openFolderPaths.has(folder)) ctrl.toggleFolder(folder, folder);
          }}
          onNewFolder={(folder, subdir) => {
            ctrl.setContextMenu(null);
            ctrl.setCreatingDirIn({ folder, subdir });
            if (subdir)
              ctrl.setOpenFolderPaths((prev) => new Set([...prev, folder, `${folder}/${subdir}`]));
            else if (!ctrl.openFolderPaths.has(folder)) ctrl.toggleFolder(folder, folder);
          }}
          onRename={(folder, path) => {
            ctrl.setContextMenu(null);
            ctrl.setRenamingKey(path === '' ? folder : `${folder}/${path}`);
          }}
          onDelete={(folder, path, kind) => {
            ctrl.setContextMenu(null);
            if (kind === 'topfolder') ctrl.handleDeleteFolder(folder);
            else ctrl.handleDeleteFile(folder, path!);
          }}
        />
      )}
    </>
  );
}
