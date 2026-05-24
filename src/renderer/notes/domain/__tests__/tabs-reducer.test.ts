import { describe, it, expect } from 'vitest';
import { tabsReducer, type TabsState } from '../tabs-reducer';
import type { OpenTab } from '../../types';

const t = (folder: string, path: string, fileKind?: OpenTab['fileKind']): OpenTab => ({
  folder,
  path,
  fileKind,
});

const empty: TabsState = { tabs: [], activeTab: null };
const lore = t('Lore', 'bob.md', 'note');
const npcs = t('NPCs', 'alice.md', 'note');
const asset = t('Lore', 'map.png', 'asset');

describe('open', () => {
  it('adds a new tab and sets it active', () => {
    const s = tabsReducer(empty, {
      type: 'open',
      folder: 'Lore',
      path: 'bob.md',
      fileKind: 'note',
    });
    expect(s.tabs).toEqual([lore]);
    expect(s.activeTab).toEqual(lore);
  });

  it('does not duplicate an existing tab but still activates it', () => {
    const state: TabsState = { tabs: [lore, npcs], activeTab: npcs };
    const s = tabsReducer(state, {
      type: 'open',
      folder: 'Lore',
      path: 'bob.md',
      fileKind: 'note',
    });
    expect(s.tabs).toEqual([lore, npcs]);
    expect(s.activeTab).toEqual(lore);
  });

  it('passes fileKind through to the new tab', () => {
    const s = tabsReducer(empty, {
      type: 'open',
      folder: 'Lore',
      path: 'map.png',
      fileKind: 'asset',
    });
    expect(s.activeTab?.fileKind).toBe('asset');
  });
});

describe('close', () => {
  it('removes the specified tab', () => {
    const state: TabsState = { tabs: [lore, npcs], activeTab: npcs };
    const s = tabsReducer(state, { type: 'close', folder: 'Lore', path: 'bob.md' });
    expect(s.tabs).toEqual([npcs]);
  });

  it('leaves activeTab unchanged when closing a background tab', () => {
    const state: TabsState = { tabs: [lore, npcs], activeTab: npcs };
    const s = tabsReducer(state, { type: 'close', folder: 'Lore', path: 'bob.md' });
    expect(s.activeTab).toEqual(npcs);
  });

  it('falls back to the last remaining tab when closing the active tab', () => {
    const state: TabsState = { tabs: [lore, npcs], activeTab: npcs };
    const s = tabsReducer(state, { type: 'close', folder: 'NPCs', path: 'alice.md' });
    expect(s.tabs).toEqual([lore]);
    expect(s.activeTab).toEqual(lore);
  });

  it('sets activeTab to null when closing the only tab', () => {
    const state: TabsState = { tabs: [lore], activeTab: lore };
    const s = tabsReducer(state, { type: 'close', folder: 'Lore', path: 'bob.md' });
    expect(s.tabs).toEqual([]);
    expect(s.activeTab).toBeNull();
  });

  it('is a no-op when the tab does not exist', () => {
    const state: TabsState = { tabs: [lore], activeTab: lore };
    const s = tabsReducer(state, { type: 'close', folder: 'NPCs', path: 'ghost.md' });
    expect(s).toBe(state);
  });
});

describe('close-folder', () => {
  it('removes all tabs in the folder', () => {
    const extra = t('Lore', 'places.md', 'note');
    const state: TabsState = { tabs: [lore, extra, npcs], activeTab: npcs };
    const s = tabsReducer(state, { type: 'close-folder', folder: 'Lore' });
    expect(s.tabs).toEqual([npcs]);
  });

  it('leaves activeTab unchanged when it is not in the closed folder', () => {
    const state: TabsState = { tabs: [lore, npcs], activeTab: npcs };
    const s = tabsReducer(state, { type: 'close-folder', folder: 'Lore' });
    expect(s.activeTab).toEqual(npcs);
  });

  it('falls back to last remaining tab when activeTab was in the closed folder', () => {
    const state: TabsState = { tabs: [npcs, lore], activeTab: lore };
    const s = tabsReducer(state, { type: 'close-folder', folder: 'Lore' });
    expect(s.activeTab).toEqual(npcs);
  });

  it('sets activeTab null when the folder contained all tabs', () => {
    const state: TabsState = { tabs: [lore], activeTab: lore };
    const s = tabsReducer(state, { type: 'close-folder', folder: 'Lore' });
    expect(s.activeTab).toBeNull();
  });
});

describe('rename-file', () => {
  it('updates path on the matching tab', () => {
    const state: TabsState = { tabs: [lore, npcs], activeTab: npcs };
    const s = tabsReducer(state, {
      type: 'rename-file',
      folder: 'Lore',
      oldPath: 'bob.md',
      newPath: 'robert.md',
    });
    expect(s.tabs[0].path).toBe('robert.md');
  });

  it('updates activeTab when the renamed file is active', () => {
    const state: TabsState = { tabs: [lore], activeTab: lore };
    const s = tabsReducer(state, {
      type: 'rename-file',
      folder: 'Lore',
      oldPath: 'bob.md',
      newPath: 'robert.md',
    });
    expect(s.activeTab?.path).toBe('robert.md');
  });

  it('leaves other tabs unchanged', () => {
    const state: TabsState = { tabs: [lore, npcs], activeTab: lore };
    const s = tabsReducer(state, {
      type: 'rename-file',
      folder: 'Lore',
      oldPath: 'bob.md',
      newPath: 'robert.md',
    });
    expect(s.tabs[1]).toBe(npcs);
  });

  it('leaves activeTab unchanged when it was not the renamed file', () => {
    const state: TabsState = { tabs: [lore, npcs], activeTab: npcs };
    const s = tabsReducer(state, {
      type: 'rename-file',
      folder: 'Lore',
      oldPath: 'bob.md',
      newPath: 'robert.md',
    });
    expect(s.activeTab).toBe(npcs);
  });
});

describe('rename-folder', () => {
  it('updates folder on all tabs in the old folder', () => {
    const extra = t('Lore', 'places.md', 'note');
    const state: TabsState = { tabs: [lore, extra, npcs], activeTab: npcs };
    const s = tabsReducer(state, {
      type: 'rename-folder',
      oldFolder: 'Lore',
      newFolder: 'Lore (Renamed)',
    });
    expect(s.tabs[0].folder).toBe('Lore (Renamed)');
    expect(s.tabs[1].folder).toBe('Lore (Renamed)');
    expect(s.tabs[2].folder).toBe('NPCs');
  });

  it('updates activeTab when it is in the renamed folder', () => {
    const state: TabsState = { tabs: [lore], activeTab: lore };
    const s = tabsReducer(state, {
      type: 'rename-folder',
      oldFolder: 'Lore',
      newFolder: 'Lore (Renamed)',
    });
    expect(s.activeTab?.folder).toBe('Lore (Renamed)');
  });

  it('leaves activeTab unchanged when it is in a different folder', () => {
    const state: TabsState = { tabs: [lore, npcs], activeTab: npcs };
    const s = tabsReducer(state, {
      type: 'rename-folder',
      oldFolder: 'Lore',
      newFolder: 'Lore (Renamed)',
    });
    expect(s.activeTab).toBe(npcs);
  });
});

// Ensure asset tabs are handled (fileKind preserved through operations)
it('preserves fileKind through close and open operations', () => {
  const state: TabsState = { tabs: [asset], activeTab: asset };
  const closed = tabsReducer(state, { type: 'close', folder: 'Lore', path: 'map.png' });
  expect(closed.tabs).toEqual([]);
  const reopened = tabsReducer(closed, {
    type: 'open',
    folder: 'Lore',
    path: 'map.png',
    fileKind: 'asset',
  });
  expect(reopened.activeTab?.fileKind).toBe('asset');
});
