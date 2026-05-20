import { EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';

export interface ImagePasteConfig {
  /**
   * Persist the pasted image and return a markdown image src URL
   * (e.g. "notes-asset://current/notes/foo/assets/pasted-123.png").
   * Return null to abort the paste insertion.
   */
  onImagePaste: (blob: Blob, mimeType: string) => Promise<string | null>;
}

/** Extracts the first image item from a DataTransferItemList, or null. */
export function findImageItem(items: DataTransferItemList): DataTransferItem | null {
  return Array.from(items).find((item) => item.type.startsWith('image/')) ?? null;
}

export function imagePaste(config: ImagePasteConfig): Extension {
  return EditorView.domEventHandlers({
    paste(event, view) {
      const items = event.clipboardData?.items;
      if (!items) return false;

      const imageItem = findImageItem(items);
      if (!imageItem) return false;

      // Claim the event synchronously before any async work
      event.preventDefault();

      void (async () => {
        const blob = imageItem.getAsFile();
        if (!blob) return;

        const mimeType = imageItem.type;
        const url = await config.onImagePaste(blob, mimeType);
        if (!url) return;

        // Derive alt text from the last path segment of the URL, minus extension
        const filename = url.split('/').pop() ?? 'image';
        const label = filename.replace(/\.[^.]+$/, '');
        const markdown = `![${label}](${url})`;
        const { from, to } = view.state.selection.main;
        view.dispatch({
          changes: { from, to, insert: markdown },
          selection: { anchor: from + markdown.length },
        });
      })();

      return true;
    },
  });
}
