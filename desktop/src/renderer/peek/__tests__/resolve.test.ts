import { describe, it, expect } from 'vitest';
import { resolvePeekTarget } from '../resolve';
import type { LinkIndexEntry } from '../../../types/global';

const linkIndex: LinkIndexEntry[] = [
  { id: 'bob', path: 'notes/npcs/bob.md', title: 'Bob', type: 'note' },
  { id: 'battle', path: 'timeline/battle.md', title: 'Battle', type: 'event' },
  { id: 'map', path: 'notes/assets/map.png', title: 'Map', type: 'asset' },
];

describe('resolvePeekTarget — plain href', () => {
  it('resolves relative .md from timeline to notes', () => {
    expect(resolvePeekTarget('../notes/npcs/bob.md', 'timeline', [])).toEqual({
      path: 'notes/npcs/bob.md',
    });
  });

  it('resolves relative .md within timeline', () => {
    expect(resolvePeekTarget('./other.md', 'timeline', [])).toEqual({
      path: 'timeline/other.md',
    });
  });

  it('returns null for anchor href', () => {
    expect(resolvePeekTarget('#section', 'timeline', [])).toBeNull();
  });

  it('returns null for external URL', () => {
    expect(resolvePeekTarget('https://example.com/page.md', 'timeline', [])).toBeNull();
  });

  it('returns null for mailto: href', () => {
    expect(resolvePeekTarget('mailto:foo@bar.com', 'timeline', [])).toBeNull();
  });

  it('returns null for non-.md href', () => {
    expect(resolvePeekTarget('image.png', 'timeline', [])).toBeNull();
  });

  it('returns null for empty href', () => {
    expect(resolvePeekTarget('', 'timeline', [])).toBeNull();
  });

  it('resolves deep relative path across folders', () => {
    expect(resolvePeekTarget('../../timeline/event.md', 'notes/npcs', [])).toEqual({
      path: 'timeline/event.md',
    });
  });
});

describe('resolvePeekTarget — wiki-link id', () => {
  it('resolves note id', () => {
    expect(resolvePeekTarget('bob', 'notes', linkIndex)).toEqual({
      path: 'notes/npcs/bob.md',
    });
  });

  it('resolves event id', () => {
    expect(resolvePeekTarget('battle', 'notes', linkIndex)).toEqual({
      path: 'timeline/battle.md',
    });
  });

  it('returns null for unknown id', () => {
    expect(resolvePeekTarget('nonexistent', 'notes', linkIndex)).toBeNull();
  });

  it('returns null for asset id', () => {
    expect(resolvePeekTarget('map', 'notes', linkIndex)).toBeNull();
  });

  it('returns null when index is empty', () => {
    expect(resolvePeekTarget('bob', 'notes', [])).toBeNull();
  });

  it('baseDir does not affect wiki-id resolution', () => {
    expect(resolvePeekTarget('bob', 'timeline', linkIndex)).toEqual({
      path: 'notes/npcs/bob.md',
    });
  });
});
