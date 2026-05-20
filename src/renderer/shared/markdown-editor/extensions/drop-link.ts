import { EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';

export interface DropInsert {
  /** Markdown text to insert at the drop point. */
  insert: string;
}

export interface DropLinkConfig {
  /**
   * The MIME type used during dragover to decide whether to accept the drop.
   * Checked via dataTransfer.types (available in dragover unlike getData).
   */
  dropMimeType: string;
  /**
   * Called on drop. Inspect the event and return the markdown to insert,
   * or null to ignore the drop.
   */
  decodeDrop: (event: DragEvent) => DropInsert | null;
}

/**
 * CM6 extension that handles drops of items onto the editor.
 *
 * Host-specific payload parsing is delegated to `decodeDrop`. The extension
 * owns the CM6 plumbing: position resolution, dispatch, and focus.
 */
export function dropLink(config: DropLinkConfig): Extension {
  return EditorView.domEventHandlers({
    dragover(event) {
      if (!event.dataTransfer?.types.includes(config.dropMimeType)) return false;
      // Prevent the browser's default "open link" behaviour so the drop fires.
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      return true;
    },

    drop(event, view) {
      const result = config.decodeDrop(event);
      if (!result) return false;

      event.preventDefault();

      // Resolve the document position at the drop coordinates.
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos === null) return false;

      view.dispatch({
        changes: { from: pos, to: pos, insert: result.insert },
        selection: { anchor: pos + result.insert.length },
        userEvent: 'input.drop',
      });

      view.focus();
      return true;
    },
  });
}
