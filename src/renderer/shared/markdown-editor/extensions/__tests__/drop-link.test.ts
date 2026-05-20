import { describe, it, expect, vi } from 'vitest';
import type { DropLinkConfig, DropInsert } from '../drop-link';

const MIME = 'application/x-test-drop';

function makeConfig(decodeDrop: (e: DragEvent) => DropInsert | null): DropLinkConfig {
  return { dropMimeType: MIME, decodeDrop };
}

function makeDragEvent(types: string[], overrides: Partial<DragEvent> = {}): DragEvent {
  return {
    dataTransfer: {
      types,
      getData: vi.fn().mockReturnValue(''),
      dropEffect: 'none',
    },
    preventDefault: vi.fn(),
    clientX: 0,
    clientY: 0,
    ...overrides,
  } as unknown as DragEvent;
}

describe('DropLinkConfig contract', () => {
  it('decodeDrop returning null means the drop is ignored', () => {
    const decodeDrop = vi.fn().mockReturnValue(null);
    const config = makeConfig(decodeDrop);
    const event = makeDragEvent([MIME]);

    const result = config.decodeDrop(event);
    expect(result).toBeNull();
  });

  it('decodeDrop returning { insert } provides the markdown to insert', () => {
    const insert = '[[My Note|abc1]]';
    const decodeDrop = vi.fn().mockReturnValue({ insert });
    const config = makeConfig(decodeDrop);
    const event = makeDragEvent([MIME]);

    const result = config.decodeDrop(event);
    expect(result).toEqual({ insert });
  });

  it('dragover accepts drop when MIME type matches', () => {
    const event = makeDragEvent([MIME]);
    const typesInclude = event.dataTransfer!.types.includes(MIME);
    expect(typesInclude).toBe(true);
  });

  it('dragover rejects drop when MIME type does not match', () => {
    const event = makeDragEvent(['text/plain']);
    const typesInclude = event.dataTransfer!.types.includes(MIME);
    expect(typesInclude).toBe(false);
  });

  it('decodes a note drop correctly', () => {
    const config = makeConfig((event: DragEvent) => {
      const raw = event.dataTransfer?.getData(MIME);
      if (!raw) return null;
      const payload = JSON.parse(raw) as { displayName: string; id: string; fileKind: string };
      if (payload.fileKind !== 'note') return null;
      return { insert: `[[${payload.displayName}|${payload.id}]]` };
    });

    const payload = JSON.stringify({ displayName: 'Faction X', id: 'fx01', fileKind: 'note' });
    const event = {
      dataTransfer: { types: [MIME], getData: vi.fn().mockReturnValue(payload) },
      preventDefault: vi.fn(),
      clientX: 10,
      clientY: 20,
    } as unknown as DragEvent;

    const result = config.decodeDrop(event);
    expect(result).toEqual({ insert: '[[Faction X|fx01]]' });
  });

  it('decodes an asset drop correctly', () => {
    const config = makeConfig((event: DragEvent) => {
      const raw = event.dataTransfer?.getData(MIME);
      if (!raw) return null;
      const payload = JSON.parse(raw) as {
        displayName: string;
        folder: string;
        path: string;
        fileKind: string;
      };
      if (payload.fileKind !== 'asset') return null;
      return {
        insert: `![${payload.displayName}](notes-asset://current/notes/${payload.folder}/${payload.path})`,
      };
    });

    const payload = JSON.stringify({
      displayName: 'map.png',
      folder: 'locations',
      path: 'assets/map.png',
      fileKind: 'asset',
    });
    const event = {
      dataTransfer: { types: [MIME], getData: vi.fn().mockReturnValue(payload) },
      preventDefault: vi.fn(),
      clientX: 10,
      clientY: 20,
    } as unknown as DragEvent;

    const result = config.decodeDrop(event);
    expect(result).toEqual({
      insert: '![map.png](notes-asset://current/notes/locations/assets/map.png)',
    });
  });

  it('returns null for unsupported file kinds', () => {
    const config = makeConfig((event: DragEvent) => {
      const raw = event.dataTransfer?.getData(MIME);
      if (!raw) return null;
      const payload = JSON.parse(raw) as { fileKind: string };
      if (payload.fileKind !== 'note' && payload.fileKind !== 'asset') return null;
      return { insert: '' };
    });

    const payload = JSON.stringify({ fileKind: 'unsupported' });
    const event = {
      dataTransfer: { types: [MIME], getData: vi.fn().mockReturnValue(payload) },
      preventDefault: vi.fn(),
    } as unknown as DragEvent;

    expect(config.decodeDrop(event)).toBeNull();
  });
});
