import { describe, it, expect } from 'vitest';
import { slugify } from '../slugify';

describe('slugify', () => {
  it('lowercases and trims', () => {
    expect(slugify('  Hello World  ')).toBe('hello-world');
  });

  it('converts spaces to hyphens', () => {
    expect(slugify('my note title')).toBe('my-note-title');
  });

  it('collapses multiple spaces and hyphens', () => {
    expect(slugify('two  spaces')).toBe('two-spaces');
    expect(slugify('a--b')).toBe('a-b');
  });

  it('removes disallowed characters', () => {
    expect(slugify('hello! world?')).toBe('hello-world');
    expect(slugify('café')).toBe('caf');
  });

  it('preserves allowed characters: hyphens, underscores, slashes', () => {
    expect(slugify('sub/folder_name')).toBe('sub/folder_name');
  });

  it('strips leading and trailing hyphens', () => {
    expect(slugify('!hello!')).toBe('hello');
  });

  it('handles empty string', () => {
    expect(slugify('')).toBe('');
  });
});
