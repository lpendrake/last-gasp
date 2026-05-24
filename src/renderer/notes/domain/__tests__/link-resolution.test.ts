import { describe, it, expect } from 'vitest';
import { resolveLinkById, resolveMarkdownHref } from '../link-resolution';
import type { LinkIndexEntry } from '../../../../types/global';

const idx: LinkIndexEntry[] = [
  { id: 'a1', path: 'notes/Lore/bob.md', title: 'Bob the Brave', type: 'note' },
  { id: 'a2', path: 'notes/Lore/places.md', title: 'Places', type: 'note' },
  { id: 'e1', path: 'timeline/sess-01.md', title: 'Session 1', type: 'event' },
  { id: 's3', path: 'notes/assets/map.png', title: 'World Map', type: 'asset' },
];

describe('resolveLinkById', () => {
  it('returns not-found for unknown id', () => {
    expect(resolveLinkById(idx, 'nope')).toEqual({ kind: 'not-found' });
  });

  it('returns the filename without the "timeline/" folder prefix for events', () => {
    // event paths in the index are stored as "timeline/<filename>" — strip the folder
    // so the caller can pass just the filename to onOpenEvent
    expect(resolveLinkById(idx, 'e1')).toEqual({ kind: 'event', filename: 'sess-01.md' });
  });

  it('splits notes path into folder + path (folder = first segment after "notes/")', () => {
    expect(resolveLinkById(idx, 'a1')).toEqual({
      kind: 'note',
      folder: 'Lore',
      path: 'bob.md',
    });
  });
});

describe('resolveMarkdownHref', () => {
  it('resolves against exact path', () => {
    expect(resolveMarkdownHref(idx, 'notes/Lore/bob.md')?.id).toBe('a1');
  });

  it('strips leading "./" before matching', () => {
    expect(resolveMarkdownHref(idx, './notes/Lore/places.md')?.id).toBe('a2');
  });

  it('matches by suffix (endsWith "/" + target)', () => {
    expect(resolveMarkdownHref(idx, 'Lore/bob.md')?.id).toBe('a1');
  });

  it('returns null when nothing matches', () => {
    expect(resolveMarkdownHref(idx, 'nowhere.md')).toBeNull();
  });
});
