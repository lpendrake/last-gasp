import { describe, it, expect, vi } from 'vitest';

// openNoteByPath strips the "notes/" prefix from a campaign-relative path and
// calls openFile(folder, filePath). Test the path-splitting logic by exercising
// it through a minimal stub.
function simulateOpenNoteByPath(
  campaignRelativePath: string,
  openFile: (folder: string, filePath: string) => void,
) {
  const withoutPrefix = campaignRelativePath.startsWith('notes/')
    ? campaignRelativePath.slice('notes/'.length)
    : campaignRelativePath;
  const slashIdx = withoutPrefix.indexOf('/');
  if (slashIdx === -1) return;
  openFile(withoutPrefix.slice(0, slashIdx), withoutPrefix.slice(slashIdx + 1));
}

describe('openNoteByPath path resolution', () => {
  it('strips "notes/" prefix and passes folder + filePath to openFile', () => {
    const openFile = vi.fn();
    simulateOpenNoteByPath('notes/Lore/places.md', openFile);
    expect(openFile).toHaveBeenCalledWith('Lore', 'places.md');
  });

  it('handles arbitrarily nested paths — folder is only the first segment', () => {
    const openFile = vi.fn();
    simulateOpenNoteByPath('notes/foo/bar/baz/quux/thing.md', openFile);
    expect(openFile).toHaveBeenCalledWith('foo', 'bar/baz/quux/thing.md');
  });

  it('does nothing for a path with no subfolder (no slash after prefix)', () => {
    const openFile = vi.fn();
    simulateOpenNoteByPath('notes/journal.md', openFile);
    expect(openFile).not.toHaveBeenCalled();
  });

  it('falls back gracefully when "notes/" prefix is absent', () => {
    const openFile = vi.fn();
    simulateOpenNoteByPath('Lore/places.md', openFile);
    expect(openFile).toHaveBeenCalledWith('Lore', 'places.md');
  });

  it('does nothing for a bare filename with no slash', () => {
    const openFile = vi.fn();
    simulateOpenNoteByPath('journal.md', openFile);
    expect(openFile).not.toHaveBeenCalled();
  });
});
