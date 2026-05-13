import { EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import { notesData } from '../../data';

export interface ImagePasteConfig {
  folder: string;
  campaignPath: string;
}

/** Builds the campaign-relative asset path and notes-asset URL for a pasted filename. */
export function assetLocation(folder: string, filename: string): { relPath: string; url: string } {
  const relPath = `notes/${folder}/assets/${filename}`;
  return { relPath, url: `notes-asset://current/${relPath}` };
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

        const ext = imageItem.type.split('/')[1] ?? 'png';
        const filename = `pasted-${Date.now()}.${ext}`;
        const { relPath, url } = assetLocation(config.folder, filename);
        const fullPath = `${config.campaignPath}/${relPath}`;

        const buffer = await blob.arrayBuffer();
        await notesData.saveImage(fullPath, new Uint8Array(buffer));

        const label = filename.replace(/\.[^.]+$/, ''); // strip extension for alt text
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
