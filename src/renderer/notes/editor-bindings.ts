import type {
  ImagePasteConfig,
  DropLinkConfig,
  DropInsert,
  WikiLinksHostConfig,
} from '../shared/markdown-editor';
import { notesData } from './data';
import { openFromWikiLink, closeFromWikiLink } from '../peek/stack';

interface SidebarDropPayload {
  folder: string;
  path: string;
  kind: 'file' | 'dir' | 'topfolder';
  displayName: string;
  id?: string;
  fileKind?: 'note' | 'asset' | 'unsupported';
}

const DRAG_MIME = 'application/x-last-gasp-note';

export function makeImagePasteConfig(folder: string, campaignPath: string): ImagePasteConfig {
  return {
    onImagePaste: async (blob: Blob, mimeType: string): Promise<string | null> => {
      const ext = mimeType.split('/')[1] ?? 'png';
      const filename = `pasted-${Date.now()}.${ext}`;
      const relPath = `notes/${folder}/assets/${filename}`;
      const fullPath = `${campaignPath}/${relPath}`;
      const buffer = await blob.arrayBuffer();
      const ok = await notesData.saveImage(fullPath, new Uint8Array(buffer));
      return ok ? `notes-asset://current/${relPath}` : null;
    },
  };
}

export function makeDropLinkConfig(): DropLinkConfig {
  return {
    dropMimeType: DRAG_MIME,
    decodeDrop: (event: DragEvent): DropInsert | null => {
      const raw = event.dataTransfer?.getData(DRAG_MIME);
      if (!raw) return null;

      let payload: SidebarDropPayload;
      try {
        payload = JSON.parse(raw);
      } catch {
        return null;
      }

      if (payload.kind !== 'file') return null;

      if (payload.fileKind === 'asset') {
        return {
          insert: `![${payload.displayName}](notes-asset://current/notes/${payload.folder}/${payload.path})`,
        };
      }
      if (payload.fileKind === 'note') {
        const id = payload.id || payload.displayName;
        return { insert: `[[${payload.displayName}|${id}]]` };
      }

      return null;
    },
  };
}

export function makePeekWikiLinksConfig(): Pick<WikiLinksHostConfig, 'onHover' | 'onHoverEnd'> {
  return {
    onHover: openFromWikiLink,
    onHoverEnd: closeFromWikiLink,
  };
}
