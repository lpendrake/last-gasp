import { uploadNoteAsset } from '../../data/http/notes.http.ts';

/** Result of uploading a pasted image: the markdown to insert at the
 * caret, and the number of characters the caret should advance to land
 * after the insertion. */
export interface PastedImage {
  markdown: string;
  advance: number;
}

/** If the clipboard payload contains an image, upload it as a note
 * asset under `<folder>/assets/` and return the markdown to insert.
 * Returns null when no image is present (caller should not preventDefault). */
export async function uploadPastedImage(
  clipboardData: DataTransfer,
  currentFolder: string,
): Promise<PastedImage | null> {
  const imageItem = Array.from(clipboardData.items).find(item => item.type.startsWith('image/'));
  if (!imageItem) return null;
  const blob = imageItem.getAsFile();
  if (!blob) return null;
  const ext = imageItem.type === 'image/jpeg' ? 'jpg' : (imageItem.type.split('/')[1] ?? 'png');
  const filename = `pasted-${Date.now()}.${ext}`;
  const relativePath = await uploadNoteAsset(currentFolder, filename, await blob.arrayBuffer(), imageItem.type);
  const markdown = `![](${relativePath})`;
  return { markdown, advance: markdown.length };
}
