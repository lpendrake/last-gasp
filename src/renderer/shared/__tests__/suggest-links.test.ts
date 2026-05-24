import { describe, it, expect } from 'vitest';
import { suggestLinks } from '../suggest-links';
import type { LinkIndexEntry } from '../../../types/global';

const idx: LinkIndexEntry[] = [
  { id: 'a1', path: 'notes/Lore/bob.md', title: 'Bob the Brave', type: 'note' },
  { id: 'a2', path: 'notes/Lore/places.md', title: 'Places', type: 'note' },
  { id: 'e1', path: 'timeline/sess-01.md', title: 'Session 1', type: 'event' },
  { id: 's3', path: 'notes/assets/map.png', title: 'World Map', type: 'asset' },
];

describe('suggestLinks', () => {
  it('matches by title substring case-insensitively', () => {
    expect(suggestLinks(idx, 'bob')).toEqual([
      { id: 'a1', label: 'Bob the Brave', detail: 'notes/Lore/bob.md' },
    ]);
  });

  it('matches by id', () => {
    const result = suggestLinks(idx, 'e1');
    expect(result[0].id).toBe('e1');
  });

  it('asset entries carry assetPath and a blank id', () => {
    const result = suggestLinks(idx, 'map');
    expect(result[0]).toMatchObject({
      id: '',
      label: 'World Map',
      assetPath: 'notes/assets/map.png',
    });
  });

  it('returns [] when nothing matches', () => {
    expect(suggestLinks(idx, 'xyzzy')).toEqual([]);
  });
});
