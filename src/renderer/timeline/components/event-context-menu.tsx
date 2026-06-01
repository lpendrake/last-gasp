import type { EventListItem } from '../data/types';
import { useContextMenuBehavior } from '../../shared/use-context-menu-behavior';
import '../../shared/context-menu.css';

interface Props {
  item: EventListItem;
  x: number;
  y: number;
  onClose(): void;
  onEdit(filename: string): void;
  onDelete(item: EventListItem): void;
  onEditTagLabel(entityId: string): void;
  onEditLinkLabel(entityId: string): void;
  onOpenInExplorer(item: EventListItem): void;
  onCopyLink(item: EventListItem): void;
}

export function EventContextMenu({
  item,
  x,
  y,
  onClose,
  onEdit,
  onDelete,
  onEditTagLabel,
  onEditLinkLabel,
  onOpenInExplorer,
  onCopyLink,
}: Props) {
  const { menuRef, pos } = useContextMenuBehavior(x, y, onClose);

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left: pos.x, top: pos.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <button
        className="context-menu-item"
        onClick={() => {
          onEdit(item.filename);
          onClose();
        }}
      >
        Edit
      </button>
      <button
        className="context-menu-item is-danger"
        onClick={() => {
          onDelete(item);
          onClose();
        }}
      >
        Delete
      </button>
      <div className="context-menu-sep" />
      <button
        className="context-menu-item"
        onClick={() => {
          if (item.id) onEditTagLabel(item.id);
          onClose();
        }}
      >
        Edit Tag Label
      </button>
      <button
        className="context-menu-item"
        onClick={() => {
          if (item.id) onEditLinkLabel(item.id);
          onClose();
        }}
      >
        Edit Link Label
      </button>
      <div className="context-menu-sep" />
      <button
        className="context-menu-item"
        onClick={() => {
          onOpenInExplorer(item);
          onClose();
        }}
      >
        Open in file explorer
      </button>
      <button
        className="context-menu-item"
        onClick={() => {
          onCopyLink(item);
          onClose();
        }}
      >
        Copy Link
      </button>
    </div>
  );
}
