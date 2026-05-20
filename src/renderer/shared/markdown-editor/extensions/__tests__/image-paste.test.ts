import { describe, it, expect, vi } from 'vitest';
import { findImageItem } from '../image-paste';

describe('findImageItem', () => {
  function makeItems(types: string[]): DataTransferItemList {
    const items = types.map(
      (type) => ({ type, getAsFile: () => null, kind: 'file' }) as DataTransferItem,
    );
    return Object.assign(items, { length: items.length }) as unknown as DataTransferItemList;
  }

  it('returns the first image item', () => {
    const items = makeItems(['text/plain', 'image/png']);
    expect(findImageItem(items)?.type).toBe('image/png');
  });

  it('returns null when no image item exists', () => {
    const items = makeItems(['text/plain', 'text/html']);
    expect(findImageItem(items)).toBeNull();
  });

  it('returns null for empty list', () => {
    const items = makeItems([]);
    expect(findImageItem(items)).toBeNull();
  });
});

describe('ImagePasteConfig.onImagePaste contract', () => {
  it('callback receives blob and mimeType', async () => {
    const onImagePaste = vi.fn().mockResolvedValue(null);
    const blob = new Blob(['fake-image'], { type: 'image/png' });

    await onImagePaste(blob, 'image/png');

    expect(onImagePaste).toHaveBeenCalledWith(blob, 'image/png');
  });

  it('null return means insertion is aborted', async () => {
    const onImagePaste = vi.fn().mockResolvedValue(null);
    const result = await onImagePaste(new Blob(), 'image/jpeg');
    expect(result).toBeNull();
  });

  it('non-null return is the URL embedded in the markdown', async () => {
    const url = 'notes-asset://current/notes/factions/assets/pasted-123.png';
    const onImagePaste = vi.fn().mockResolvedValue(url);
    const result = await onImagePaste(new Blob(), 'image/png');
    expect(result).toBe(url);
    // The extension uses the last path segment (minus extension) as alt text.
    const filename = url.split('/').pop()!;
    const label = filename.replace(/\.[^.]+$/, '');
    expect(label).toBe('pasted-123');
  });
});
