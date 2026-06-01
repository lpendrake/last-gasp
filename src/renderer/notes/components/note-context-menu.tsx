import { useContextMenuBehavior } from '../../shared/use-context-menu-behavior';
import '../../shared/context-menu.css';

export type ContextMenuTarget =
  | {
      kind: 'file';
      folder: string;
      path: string;
      id?: string;
      fileKind?: 'note' | 'asset' | 'unsupported';
      x: number;
      y: number;
    }
  | { kind: 'dir'; folder: string; path: string; x: number; y: number }
  | { kind: 'topfolder'; folder: string; x: number; y: number };

interface Props {
  target: ContextMenuTarget;
  onClose(): void;
  onNewFile(folder: string, subdir?: string): void;
  onNewFolder(folder: string, subdir?: string): void;
  onRename(folder: string, path: string): void;
  onDelete(folder: string, path: string | undefined, kind: ContextMenuTarget['kind']): void;
  onEditTagLabel?(folder: string, path: string): void;
  onEditLinkLabel?(folder: string, path: string): void;
  onOpenInExplorer(folder: string, path: string): void;
  onCopyLink(target: ContextMenuTarget): void;
}

export function NoteContextMenu({
  target,
  onClose,
  onNewFile,
  onNewFolder,
  onRename,
  onDelete,
  onEditTagLabel,
  onEditLinkLabel,
  onOpenInExplorer,
  onCopyLink,
}: Props) {
  const { menuRef, pos } = useContextMenuBehavior(target.x, target.y, onClose);

  const path = target.kind !== 'topfolder' ? target.path : undefined;
  const parentDir = target.kind === 'dir' ? target.path : undefined;

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left: pos.x, top: pos.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {target.kind !== 'file' && (
        <>
          <button
            className="context-menu-item"
            onClick={() => {
              onNewFile(target.folder, parentDir);
              onClose();
            }}
          >
            New Note
          </button>
          <button
            className="context-menu-item"
            onClick={() => {
              onNewFolder(target.folder, parentDir);
              onClose();
            }}
          >
            New Folder
          </button>
          <div className="context-menu-sep" />
        </>
      )}
      <button
        className="context-menu-item"
        onClick={() => {
          onRename(target.folder, path ?? '');
          onClose();
        }}
      >
        Rename
      </button>
      <button
        className="context-menu-item is-danger"
        onClick={() => {
          onDelete(target.folder, path, target.kind);
          onClose();
        }}
      >
        {target.kind === 'topfolder' ? 'Delete Folder' : 'Delete'}
      </button>
      {target.kind === 'file' && (
        <>
          <div className="context-menu-sep" />
          <button
            className="context-menu-item"
            onClick={() => {
              onEditTagLabel?.(target.folder, target.path);
              onClose();
            }}
          >
            Edit Tag Label
          </button>
          <button
            className="context-menu-item"
            onClick={() => {
              onEditLinkLabel?.(target.folder, target.path);
              onClose();
            }}
          >
            Edit Link Label
          </button>
          <button
            className="context-menu-item"
            onClick={() => {
              onOpenInExplorer(target.folder, target.path);
              onClose();
            }}
          >
            Open in file explorer
          </button>
          <button
            className="context-menu-item"
            onClick={() => {
              onCopyLink(target);
              onClose();
            }}
          >
            Copy Link
          </button>
        </>
      )}
    </div>
  );
}
