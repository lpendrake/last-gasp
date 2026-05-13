import { describe, it, expect } from 'vitest';
import { assetLocation, findImageItem } from '../image-paste';

describe('assetLocation', () => {
  it('builds the correct relative path and URL', () => {
    const { relPath, url } = assetLocation('factions', 'pasted-123.png');
    expect(relPath).toBe('notes/factions/assets/pasted-123.png');
    expect(url).toBe('notes-asset://current/notes/factions/assets/pasted-123.png');
  });

  it('handles folders with spaces', () => {
    const { relPath } = assetLocation('player characters', 'avatar.webp');
    expect(relPath).toBe('notes/player characters/assets/avatar.webp');
  });
});

describe('findImageItem', () => {
  function makeItems(types: string[]): DataTransferItemList {
    const items = types.map(type => ({ type, getAsFile: () => null, kind: 'file' }) as DataTransferItem);
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
