import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export type ContextMenuTarget =
  | { kind: 'file';      folder: string; path: string; x: number; y: number }
  | { kind: 'dir';       folder: string; path: string; x: number; y: number }
  | { kind: 'topfolder'; folder: string;               x: number; y: number };

interface Props {
  target: ContextMenuTarget;
  onClose(): void;
  onNewFile(folder: string, subdir?: string): void;
  onNewFolder(folder: string, subdir?: string): void;
  onRename(folder: string, path: string): void;
  onDelete(folder: string, path: string | undefined, kind: ContextMenuTarget['kind']): void;
}

export function NoteContextMenu({ target, onClose, onNewFile, onNewFolder, onRename, onDelete }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: target.x, y: target.y });

  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({
      x: Math.min(target.x, window.innerWidth - rect.width - 8),
      y: Math.min(target.y, window.innerHeight - rect.height - 8),
    });
  }, [target.x, target.y]);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onMouseDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [onClose]);

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
            onClick={() => { onNewFile(target.folder, parentDir); onClose(); }}
          >
            New File
          </button>
          <button
            className="context-menu-item"
            onClick={() => { onNewFolder(target.folder, parentDir); onClose(); }}
          >
            New Folder
          </button>
          <div className="context-menu-sep" />
        </>
      )}
      <button
        className="context-menu-item"
        onClick={() => { onRename(target.folder, path ?? ''); onClose(); }}
      >
        Rename
      </button>
      <button
        className="context-menu-item is-danger"
        onClick={() => { onDelete(target.folder, path, target.kind); onClose(); }}
      >
        {target.kind === 'topfolder' ? 'Delete Folder' : 'Delete'}
      </button>
    </div>
  );
}
