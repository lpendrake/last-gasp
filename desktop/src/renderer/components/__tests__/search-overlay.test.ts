import { describe, it, expect } from 'vitest';
import { matches, extractSnippet, resolveNoteOpenPath } from '../search-overlay';

describe('matches', () => {
  it('returns false for undefined text', () => {
    expect(matches(undefined, 'hello')).toBe(false);
  });

  it('returns false for empty text', () => {
    expect(matches('', 'hello')).toBe(false);
  });

  it('matches case-insensitively', () => {
    expect(matches('Hello World', 'hello')).toBe(true);
    expect(matches('DRAGON FIGHT', 'dragon')).toBe(true);
    expect(matches('dragon fight', 'DRAGON')).toBe(true);
  });

  it('returns false when text does not contain query', () => {
    expect(matches('Hello World', 'xyz')).toBe(false);
  });

  it('matches substring within text', () => {
    expect(matches('The dragon woke at dawn', 'dragon woke')).toBe(true);
  });
});

describe('extractSnippet', () => {
  it('returns trimmed prefix when query not found', () => {
    const text = 'Some long text that does not contain the search term at all in any way';
    const result = extractSnippet(text, 'xyz');
    expect(result).toBe(text.slice(0, 80).trim());
  });

  it('extracts snippet centred on the match', () => {
    const text = 'Beginning of text. The dragon arrived. End of text.';
    const result = extractSnippet(text, 'dragon');
    expect(result).toContain('dragon');
  });

  it('adds leading ellipsis when match is not near the start', () => {
    const padding = 'a'.repeat(50);
    const text = `${padding} dragon ${padding}`;
    const result = extractSnippet(text, 'dragon');
    expect(result.startsWith('…')).toBe(true);
    expect(result).toContain('dragon');
  });

  it('adds trailing ellipsis when match is not near the end', () => {
    const text = 'dragon ' + 'b'.repeat(100);
    const result = extractSnippet(text, 'dragon');
    expect(result.endsWith('…')).toBe(true);
  });

  it('does not add ellipsis when match is near the start and end', () => {
    const text = 'dragon';
    const result = extractSnippet(text, 'dragon');
    expect(result).toBe('dragon');
    expect(result.startsWith('…')).toBe(false);
    expect(result.endsWith('…')).toBe(false);
  });

  it('is case-insensitive when locating the match', () => {
    const text = 'The DRAGON rose';
    const result = extractSnippet(text, 'dragon');
    expect(result).toContain('DRAGON');
  });
});

describe('resolveNoteOpenPath', () => {
  it('strips "notes/" prefix and splits on first slash', () => {
    const result = resolveNoteOpenPath('notes/Lore/places.md');
    expect(result).toEqual({ folder: 'Lore', filePath: 'places.md' });
  });

  it('works for deeply nested paths', () => {
    const result = resolveNoteOpenPath('notes/NPCs/Villains/boss.md');
    expect(result).toEqual({ folder: 'NPCs', filePath: 'Villains/boss.md' });
  });

  it('returns null for a path with no subfolder (no second slash)', () => {
    // "notes/journal.md" — note directly under notes/ with no folder
    const result = resolveNoteOpenPath('notes/journal.md');
    expect(result).toBeNull();
  });

  it('strips "notes/" even without a leading notes/ prefix (fallback)', () => {
    // If path is already without prefix, still splits on first slash
    const result = resolveNoteOpenPath('Lore/places.md');
    expect(result).toEqual({ folder: 'Lore', filePath: 'places.md' });
  });

  it('returns null when there is no slash after stripping prefix', () => {
    const result = resolveNoteOpenPath('journal.md');
    expect(result).toBeNull();
  });
});
