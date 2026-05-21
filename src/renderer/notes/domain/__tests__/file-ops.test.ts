import { describe, it, expect } from 'vitest';
import {
  removeFileFromFolderFiles,
  removeFolderFromFolderFiles,
  renameFileInFolderFiles,
  renameFileInOpenFiles,
  renameFolderInFolderFiles,
  renameFolderInOpenFiles,
  computeRenamedPath,
} from '../file-ops';
import type { NoteEntry, FileState } from '../../types';

const note = (path: string, title = path): NoteEntry => ({ id: 'x', path, title, kind: 'note' });
const file = (content = ''): FileState => ({
  content,
  frontmatter: '',
  dirty: false,
  loading: false,
});

describe('removeFileFromFolderFiles', () => {
  it('removes the matching entry', () => {
    const ff = { Lore: [note('bob.md'), note('alice.md')] };
    const result = removeFileFromFolderFiles(ff, 'Lore', 'bob.md');
    expect(result['Lore']).toEqual([note('alice.md')]);
  });

  it('is a no-op when the folder does not exist', () => {
    const ff = { Lore: [note('bob.md')] };
    const result = removeFileFromFolderFiles(ff, 'NPCs', 'bob.md');
    expect(result).toBe(ff);
  });

  it('leaves other folders untouched', () => {
    const ff = { Lore: [note('bob.md')], NPCs: [note('alice.md')] };
    const result = removeFileFromFolderFiles(ff, 'Lore', 'bob.md');
    expect(result['NPCs']).toBe(ff['NPCs']);
  });
});

describe('removeFolderFromFolderFiles', () => {
  it('removes the folder key entirely', () => {
    const ff = { Lore: [note('bob.md')], NPCs: [note('alice.md')] };
    const result = removeFolderFromFolderFiles(ff, 'Lore');
    expect('Lore' in result).toBe(false);
    expect(result['NPCs']).toEqual([note('alice.md')]);
  });
});

describe('renameFileInFolderFiles', () => {
  it('updates path and title on the matching entry', () => {
    const ff = { Lore: [note('bob.md', 'Bob'), note('alice.md', 'Alice')] };
    const result = renameFileInFolderFiles(ff, 'Lore', 'bob.md', 'robert.md', 'Robert');
    expect(result['Lore']?.[0]).toEqual({
      id: 'x',
      path: 'robert.md',
      title: 'Robert',
      kind: 'note',
    });
  });

  it('leaves non-matching entries unchanged (by reference)', () => {
    const alice = note('alice.md', 'Alice');
    const ff = { Lore: [note('bob.md', 'Bob'), alice] };
    const result = renameFileInFolderFiles(ff, 'Lore', 'bob.md', 'robert.md', 'Robert');
    expect(result['Lore']?.[1]).toBe(alice);
  });
});

describe('renameFileInOpenFiles', () => {
  it('moves the entry to the new key', () => {
    const f = file('hello');
    const of_ = { 'Lore/bob.md': f };
    const result = renameFileInOpenFiles(of_, 'Lore', 'bob.md', 'robert.md');
    expect(result['Lore/robert.md']).toBe(f);
    expect('Lore/bob.md' in result).toBe(false);
  });

  it('is a no-op when the old key does not exist', () => {
    const of_ = { 'Lore/alice.md': file() };
    const result = renameFileInOpenFiles(of_, 'Lore', 'ghost.md', 'new.md');
    expect(result).toBe(of_);
  });
});

describe('renameFolderInFolderFiles', () => {
  it('moves the folder entry to the new key', () => {
    const entries = [note('bob.md')];
    const ff = { Lore: entries, NPCs: [] };
    const result = renameFolderInFolderFiles(ff, 'Lore', 'History');
    expect(result['History']).toBe(entries);
    expect('Lore' in result).toBe(false);
    expect('NPCs' in result).toBe(true);
  });
});

describe('renameFolderInOpenFiles', () => {
  it('re-keys all entries whose key starts with the old folder', () => {
    const f1 = file('a');
    const f2 = file('b');
    const of_ = { 'Lore/bob.md': f1, 'Lore/sub/places.md': f2, 'NPCs/alice.md': file() };
    const result = renameFolderInOpenFiles(of_, 'Lore', 'History');
    expect(result['History/bob.md']).toBe(f1);
    expect(result['History/sub/places.md']).toBe(f2);
    expect('Lore/bob.md' in result).toBe(false);
  });

  it('leaves entries from other folders untouched', () => {
    const alice = file('alice');
    const of_ = { 'Lore/bob.md': file(), 'NPCs/alice.md': alice };
    const result = renameFolderInOpenFiles(of_, 'Lore', 'History');
    expect(result['NPCs/alice.md']).toBe(alice);
  });
});

describe('computeRenamedPath', () => {
  it('renames a file at the root of its folder', () => {
    expect(computeRenamedPath('bob.md', 'Robert')).toBe('robert.md');
  });

  it('renames a file in a subdirectory, preserving the directory prefix', () => {
    expect(computeRenamedPath('sub/bob.md', 'Robert')).toBe('sub/robert.md');
  });

  it('appends .md when the new name has no extension', () => {
    expect(computeRenamedPath('bob.md', 'new note')).toBe('new-note.md');
  });

  it('does not double-append .md when slugified name already ends in .md', () => {
    const result = computeRenamedPath('bob.md', 'note.md');
    expect(result?.endsWith('.md')).toBe(true);
    expect(result?.endsWith('.md.md')).toBe(false);
  });

  it('returns null when the trimmed name is empty', () => {
    expect(computeRenamedPath('bob.md', '   ')).toBeNull();
  });

  it('returns null when the new path would be identical to the old path', () => {
    expect(computeRenamedPath('bob.md', 'bob')).toBeNull();
  });

  it('renames a directory (no extension)', () => {
    expect(computeRenamedPath('my-subdir', 'New Dir')).toBe('new-dir');
  });
});
