import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock notesData before importing the module under test.
vi.mock('../data', () => ({
  notesData: {
    saveImage: vi.fn(),
  },
}));

import { makeImagePasteConfig, makeDropLinkConfig } from '../editor-bindings';
import { notesData } from '../data';

const DRAG_MIME = 'application/x-last-gasp-note';

// ---------------------------------------------------------------------------
// makeImagePasteConfig
// ---------------------------------------------------------------------------

describe('makeImagePasteConfig', () => {
  beforeEach(() => {
    vi.mocked(notesData.saveImage).mockReset();
  });

  it('builds the correct notes-asset URL on success', async () => {
    vi.mocked(notesData.saveImage).mockResolvedValue(true);
    const config = makeImagePasteConfig('factions', '/campaign');
    const blob = new Blob(['img'], { type: 'image/png' });

    const url = await config.onImagePaste(blob, 'image/png');

    expect(url).toMatch(/^notes-asset:\/\/current\/notes\/factions\/assets\/pasted-\d+\.png$/);
  });

  it('derives extension from mimeType', async () => {
    vi.mocked(notesData.saveImage).mockResolvedValue(true);
    const config = makeImagePasteConfig('maps', '/campaign');
    const blob = new Blob([], { type: 'image/webp' });

    const url = await config.onImagePaste(blob, 'image/webp');

    expect(url).toMatch(/\.webp$/);
  });

  it('falls back to "png" when mimeType has no slash-separated ext', async () => {
    vi.mocked(notesData.saveImage).mockResolvedValue(true);
    const config = makeImagePasteConfig('misc', '/campaign');
    const blob = new Blob([], { type: 'image' });

    const url = await config.onImagePaste(blob, 'image');

    expect(url).toMatch(/\.png$/);
  });

  it('returns null when saveImage fails', async () => {
    vi.mocked(notesData.saveImage).mockResolvedValue(false);
    const config = makeImagePasteConfig('factions', '/campaign');
    const blob = new Blob([], { type: 'image/png' });

    const url = await config.onImagePaste(blob, 'image/png');

    expect(url).toBeNull();
  });

  it('calls saveImage with a path under campaignPath/notes/folder/assets/', async () => {
    vi.mocked(notesData.saveImage).mockResolvedValue(true);
    const config = makeImagePasteConfig('player characters', '/my/campaign');
    const blob = new Blob([], { type: 'image/jpeg' });

    await config.onImagePaste(blob, 'image/jpeg');

    const [savedPath] = vi.mocked(notesData.saveImage).mock.calls[0];
    expect(savedPath).toMatch(
      /^\/my\/campaign\/notes\/player characters\/assets\/pasted-\d+\.jpeg$/,
    );
  });

  it('passes the image buffer to saveImage', async () => {
    vi.mocked(notesData.saveImage).mockResolvedValue(true);
    const config = makeImagePasteConfig('factions', '/campaign');
    const content = new Uint8Array([1, 2, 3]);
    const blob = new Blob([content], { type: 'image/png' });

    await config.onImagePaste(blob, 'image/png');

    const [, buffer] = vi.mocked(notesData.saveImage).mock.calls[0];
    expect(buffer).toBeInstanceOf(Uint8Array);
    expect(Array.from(buffer)).toEqual([1, 2, 3]);
  });
});

// ---------------------------------------------------------------------------
// makeDropLinkConfig
// ---------------------------------------------------------------------------

function makeDropEvent(payload: unknown): DragEvent {
  return {
    dataTransfer: {
      types: [DRAG_MIME],
      getData: vi.fn().mockReturnValue(JSON.stringify(payload)),
    },
    preventDefault: vi.fn(),
  } as unknown as DragEvent;
}

describe('makeDropLinkConfig', () => {
  const config = makeDropLinkConfig();

  it('uses the correct MIME type for dragover gating', () => {
    expect(config.dropMimeType).toBe(DRAG_MIME);
  });

  it('returns null when dataTransfer has no payload', () => {
    const event = {
      dataTransfer: { types: [DRAG_MIME], getData: vi.fn().mockReturnValue('') },
    } as unknown as DragEvent;
    expect(config.decodeDrop(event)).toBeNull();
  });

  it('returns null when payload is malformed JSON', () => {
    const event = {
      dataTransfer: { types: [DRAG_MIME], getData: vi.fn().mockReturnValue('{broken') },
    } as unknown as DragEvent;
    expect(config.decodeDrop(event)).toBeNull();
  });

  it('returns null for directory drops (kind !== "file")', () => {
    const event = makeDropEvent({ kind: 'dir', displayName: 'x', fileKind: 'note' });
    expect(config.decodeDrop(event)).toBeNull();
  });

  it('returns null for topfolder drops', () => {
    const event = makeDropEvent({ kind: 'topfolder', displayName: 'x', fileKind: 'note' });
    expect(config.decodeDrop(event)).toBeNull();
  });

  it('returns null for unsupported fileKind', () => {
    const event = makeDropEvent({ kind: 'file', displayName: 'x', fileKind: 'unsupported' });
    expect(config.decodeDrop(event)).toBeNull();
  });

  it('inserts [[label|id]] for a note drop', () => {
    const event = makeDropEvent({
      kind: 'file',
      fileKind: 'note',
      displayName: 'Faction X',
      id: 'fx01',
    });
    expect(config.decodeDrop(event)).toEqual({ insert: '[[Faction X|fx01]]' });
  });

  it('falls back to displayName as id when id is absent', () => {
    const event = makeDropEvent({
      kind: 'file',
      fileKind: 'note',
      displayName: 'Unnamed',
    });
    expect(config.decodeDrop(event)).toEqual({ insert: '[[Unnamed|Unnamed]]' });
  });

  it('inserts ![label](notes-asset://...) for an asset drop', () => {
    const event = makeDropEvent({
      kind: 'file',
      fileKind: 'asset',
      displayName: 'map.png',
      folder: 'locations',
      path: 'assets/map.png',
    });
    expect(config.decodeDrop(event)).toEqual({
      insert: '![map.png](notes-asset://current/notes/locations/assets/map.png)',
    });
  });
});
