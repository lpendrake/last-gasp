import { describe, it, expect } from 'vitest';
import { parseNotePath } from '../open-note-by-path';

describe('parseNotePath', () => {
  it('strips "notes/" prefix and splits folder + filePath', () => {
    expect(parseNotePath('notes/Lore/places.md')).toEqual({ folder: 'Lore', path: 'places.md' });
  });

  it('treats only the first segment after "notes/" as the folder', () => {
    expect(parseNotePath('notes/foo/bar/baz/quux/thing.md')).toEqual({
      folder: 'foo',
      path: 'bar/baz/quux/thing.md',
    });
  });

  it('returns null when there is no subfolder after the prefix', () => {
    expect(parseNotePath('notes/journal.md')).toBeNull();
  });

  it('falls back to raw splitting when "notes/" prefix is absent', () => {
    expect(parseNotePath('Lore/places.md')).toEqual({ folder: 'Lore', path: 'places.md' });
  });

  it('returns null for a bare filename with no slash', () => {
    expect(parseNotePath('journal.md')).toBeNull();
  });
});
