import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../data', () => ({
  notesData: { listFolder: vi.fn() },
}));

import { notesData } from '../data';
import { scanFolderContents } from '../scan-folder';
import type { LinkIndexEntry } from '../../../types/global';

const listFolder = notesData.listFolder as ReturnType<typeof vi.fn>;

beforeEach(() => listFolder.mockReset());

const campaignPath = '/campaign';
const folder = 'Lore';
const rootDir = '/campaign/notes/Lore';

describe('scanFolderContents', () => {
  it('returns [] for an empty directory', async () => {
    listFolder.mockResolvedValue([]);
    const result = await scanFolderContents(campaignPath, folder, []);
    expect(result).toEqual([]);
  });

  it('skips dotfiles', async () => {
    listFolder.mockResolvedValue([{ name: '.DS_Store', isDirectory: false }]);
    const result = await scanFolderContents(campaignPath, folder, []);
    expect(result).toEqual([]);
  });

  it('produces a note entry for a file matched in the index', async () => {
    const index: LinkIndexEntry[] = [
      { id: 'n1', path: 'notes/Lore/bob.md', title: 'Bob', type: 'note' },
    ];
    listFolder.mockResolvedValue([{ name: 'bob.md', isDirectory: false }]);
    const result = await scanFolderContents(campaignPath, folder, index);
    expect(result).toEqual([{ id: 'n1', path: 'bob.md', title: 'Bob', kind: 'note' }]);
  });

  it('produces an asset entry for an asset in the index', async () => {
    const index: LinkIndexEntry[] = [
      { id: 's1', path: 'notes/Lore/map.png', title: 'World Map', type: 'asset' },
    ];
    listFolder.mockResolvedValue([{ name: 'map.png', isDirectory: false }]);
    const result = await scanFolderContents(campaignPath, folder, index);
    expect(result).toEqual([{ id: 's1', path: 'map.png', title: 'World Map', kind: 'asset' }]);
  });

  it('produces an unsupported entry for a file not in the index', async () => {
    listFolder.mockResolvedValue([{ name: 'unknown.pdf', isDirectory: false }]);
    const result = await scanFolderContents(campaignPath, folder, []);
    expect(result).toEqual([
      { id: '', path: 'unknown.pdf', title: 'unknown.pdf', kind: 'unsupported' },
    ]);
  });

  it('produces a dir entry for an empty child directory', async () => {
    listFolder
      .mockResolvedValueOnce([{ name: 'subdir', isDirectory: true }]) // root scan
      .mockResolvedValueOnce([]); // subdir scan — empty
    const result = await scanFolderContents(campaignPath, folder, []);
    expect(result).toEqual([{ id: '', path: 'subdir', title: 'subdir', kind: 'dir' }]);
  });

  it('recurses into a non-empty child directory and uses nested relative paths', async () => {
    const index: LinkIndexEntry[] = [
      { id: 'n2', path: 'notes/Lore/sub/child.md', title: 'Child', type: 'note' },
    ];
    listFolder.mockImplementation(async (p: string) => {
      if (p === rootDir) return [{ name: 'sub', isDirectory: true }];
      if (p === `${rootDir}/sub`) return [{ name: 'child.md', isDirectory: false }];
      return [];
    });
    const result = await scanFolderContents(campaignPath, folder, index);
    expect(result).toEqual([{ id: 'n2', path: 'sub/child.md', title: 'Child', kind: 'note' }]);
  });

  it('does not produce a dir entry for a child directory that has contents', async () => {
    const index: LinkIndexEntry[] = [
      { id: 'n3', path: 'notes/Lore/sub/child.md', title: 'Child', type: 'note' },
    ];
    listFolder.mockImplementation(async (p: string) => {
      if (p === rootDir) return [{ name: 'sub', isDirectory: true }];
      if (p === `${rootDir}/sub`) return [{ name: 'child.md', isDirectory: false }];
      return [];
    });
    const result = await scanFolderContents(campaignPath, folder, index);
    const dirEntries = result.filter((e) => e.kind === 'dir');
    expect(dirEntries).toEqual([]);
  });

  it('returns partial results when listFolder throws for a subdirectory', async () => {
    const index: LinkIndexEntry[] = [
      { id: 'n4', path: 'notes/Lore/good.md', title: 'Good', type: 'note' },
    ];
    // First call: root dir listing. Second call: bad subdir throws.
    listFolder
      .mockResolvedValueOnce([
        { name: 'bad', isDirectory: true },
        { name: 'good.md', isDirectory: false },
      ])
      .mockRejectedValueOnce(new Error('permission denied'));
    const result = await scanFolderContents(campaignPath, folder, index);
    expect(result.some((e) => e.path === 'good.md')).toBe(true);
  });

  it('handles folder and file names that contain spaces', async () => {
    const index: LinkIndexEntry[] = [
      {
        id: 'sp1',
        path: 'notes/Lore/Player Characters/bob the brave.md',
        title: 'Bob the Brave',
        type: 'note',
      },
    ];
    listFolder.mockImplementation(async (p: string) => {
      if (p === rootDir) return [{ name: 'Player Characters', isDirectory: true }];
      if (p === `${rootDir}/Player Characters`)
        return [{ name: 'bob the brave.md', isDirectory: false }];
      return [];
    });
    const result = await scanFolderContents(campaignPath, folder, index);
    expect(result).toEqual([
      {
        id: 'sp1',
        path: 'Player Characters/bob the brave.md',
        title: 'Bob the Brave',
        kind: 'note',
      },
    ]);
  });
});
