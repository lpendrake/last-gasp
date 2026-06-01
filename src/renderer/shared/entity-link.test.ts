import { describe, it, expect } from 'vitest';
import { buildEntityLink, buildAssetLink } from './entity-link';

describe('buildEntityLink', () => {
  it('builds a wiki link for a 4-char entity id', () => {
    expect(buildEntityLink('ab12')).toBe('[[ab12]]');
  });
});

describe('buildAssetLink', () => {
  it('builds an asset embed with label and campaign-relative path', () => {
    expect(buildAssetLink('notes/maps/m.png', 'Map')).toBe(
      '![Map](notes-asset://current/notes/maps/m.png)',
    );
  });

  it('preserves spaces and casing in label and path', () => {
    expect(buildAssetLink('notes/My Folder/A B.png', 'A B')).toBe(
      '![A B](notes-asset://current/notes/My Folder/A B.png)',
    );
  });
});
