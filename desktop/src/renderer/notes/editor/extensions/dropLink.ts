import { EditorView, type Extension } from '@codemirror/view';

const DRAG_MIME = 'application/x-last-gasp-note';

interface DropPayload {
  folder: string;
  path: string;
  kind: 'file' | 'dir' | 'topfolder';
  displayName: string;
  id?: string;
  fileKind?: 'note' | 'asset' | 'unsupported';
}

interface DropLinkConfig {
  /** Campaign path, used to build the notes-asset:// URL for images. */
  campaignPath: string;
}

/**
 * CM6 extension that handles drops of sidebar items onto the editor.
 *
 * - Note files  → insert [[displayName|id]]
 * - Asset files → insert ![displayName](notes-asset://current/notes/folder/path)
 * - Dirs / topfolders / unsupported → no-op
 */
export function dropLink({ campaignPath: _campaignPath }: DropLinkConfig): Extension {
  return EditorView.domEventHandlers({
    dragover(event) {
      if (!event.dataTransfer?.types.includes(DRAG_MIME)) return false;
      // Prevent the browser's default "open link" behaviour so the drop fires.
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      return true;
    },

    drop(event, view) {
      const raw = event.dataTransfer?.getData(DRAG_MIME);
      if (!raw) return false;

      let payload: DropPayload;
      try { payload = JSON.parse(raw); } catch { return false; }

      // Only handle file nodes that have an id or are assets.
      if (payload.kind !== 'file') return false;
      if (payload.fileKind !== 'note' && payload.fileKind !== 'asset') return false;

      event.preventDefault();

      // Resolve the document position at the drop coordinates.
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos === null) return false;

      let insert: string;
      if (payload.fileKind === 'asset') {
        insert = `![${payload.displayName}](notes-asset://current/notes/${payload.folder}/${payload.path})`;
      } else {
        // Note — fall back to displayName as id if id is missing (shouldn't happen).
        const id = payload.id || payload.displayName;
        insert = `[[${payload.displayName}|${id}]]`;
      }

      view.dispatch({
        changes: { from: pos, to: pos, insert },
        selection: { anchor: pos + insert.length },
        userEvent: 'input.drop',
      });

      view.focus();
      return true;
    },
  });
}
