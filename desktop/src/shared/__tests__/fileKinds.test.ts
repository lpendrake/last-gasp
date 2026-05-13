import { describe, it, expect } from 'vitest';
import { ASSET_EXTENSIONS, classifyByExt, isEditableNote, isFileKind } from '../fileKinds';

describe('ASSET_EXTENSIONS', () => {
  it('contains dot-prefixed lowercase extensions', () => {
    expect(ASSET_EXTENSIONS.has('.png')).toBe(true);
    expect(ASSET_EXTENSIONS.has('.jpg')).toBe(true);
    expect(ASSET_EXTENSIONS.has('.jpeg')).toBe(true);
    expect(ASSET_EXTENSIONS.has('.gif')).toBe(true);
    expect(ASSET_EXTENSIONS.has('.webp')).toBe(true);
    expect(ASSET_EXTENSIONS.has('.svg')).toBe(true);
  });
  it('does not contain bare extensions (no dot)', () => {
    expect(ASSET_EXTENSIONS.has('png')).toBe(false);
  });
});

describe('classifyByExt', () => {
  it('classifies .md files as notes', () => {
    expect(classifyByExt('character.md')).toBe('note');
    expect(classifyByExt('npcs/bob.md')).toBe('note');
  });
  it('classifies image files as assets', () => {
    expect(classifyByExt('map.png')).toBe('asset');
    expect(classifyByExt('portrait.jpg')).toBe('asset');
    expect(classifyByExt('icon.svg')).toBe('asset');
  });
  it('classifies unknown extensions as unsupported', () => {
    expect(classifyByExt('document.docx')).toBe('unsupported');
    expect(classifyByExt('data.json')).toBe('unsupported');
  });
  it('classifies names with no extension as unsupported', () => {
    expect(classifyByExt('Makefile')).toBe('unsupported');
    expect(classifyByExt('subfolder')).toBe('unsupported');
  });
  it('is case-insensitive', () => {
    expect(classifyByExt('image.PNG')).toBe('asset');
    expect(classifyByExt('note.MD')).toBe('note');
  });
});

describe('isEditableNote', () => {
  it('returns true only for note', () => {
    expect(isEditableNote('note')).toBe(true);
    expect(isEditableNote('asset')).toBe(false);
    expect(isEditableNote('unsupported')).toBe(false);
    expect(isEditableNote('dir')).toBe(false);
    expect(isEditableNote(undefined)).toBe(false);
  });
});

describe('isFileKind', () => {
  it('returns true for real file kinds', () => {
    expect(isFileKind('note')).toBe(true);
    expect(isFileKind('asset')).toBe(true);
    expect(isFileKind('unsupported')).toBe(true);
  });
  it('returns false for virtual kinds', () => {
    expect(isFileKind('dir')).toBe(false);
    expect(isFileKind(undefined)).toBe(false);
  });
});
