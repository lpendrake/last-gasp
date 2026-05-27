import { describe, it, expect } from 'vitest';
import {
  isEntityTag,
  parseEntityTag,
  formatEntityTag,
  isValidCustomTag,
  resolveEntityTagLabel,
  extractWikiLinkIds,
  syncEntityTags,
} from '../entity-tags';

describe('isEntityTag', () => {
  it('returns true for valid entity tags', () => {
    expect(isEntityTag('id:ab12')).toBe(true);
    expect(isEntityTag('id:0000')).toBe(true);
    expect(isEntityTag('id:zzzz')).toBe(true);
    expect(isEntityTag('id:a1b2')).toBe(true);
  });

  it('returns false when prefix is wrong', () => {
    expect(isEntityTag('ID:ab12')).toBe(false);
    expect(isEntityTag('Id:ab12')).toBe(false);
    expect(isEntityTag('ab12')).toBe(false);
    expect(isEntityTag(':ab12')).toBe(false);
  });

  it('returns false when ID length is not exactly 4', () => {
    expect(isEntityTag('id:abc')).toBe(false);
    expect(isEntityTag('id:abcde')).toBe(false);
    expect(isEntityTag('id:')).toBe(false);
  });

  it('returns false when ID contains invalid characters', () => {
    expect(isEntityTag('id:AB12')).toBe(false);
    expect(isEntityTag('id:ab-2')).toBe(false);
    expect(isEntityTag('id:ab 2')).toBe(false);
    expect(isEntityTag('id:ab_2')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isEntityTag('')).toBe(false);
  });
});

describe('parseEntityTag', () => {
  it('returns the 4-character ID from a valid entity tag', () => {
    expect(parseEntityTag('id:ab12')).toBe('ab12');
    expect(parseEntityTag('id:0000')).toBe('0000');
    expect(parseEntityTag('id:zzzz')).toBe('zzzz');
  });

  it('returns null for invalid entity tags', () => {
    expect(parseEntityTag('ab12')).toBeNull();
    expect(parseEntityTag('id:abc')).toBeNull();
    expect(parseEntityTag('id:ABCD')).toBeNull();
    expect(parseEntityTag('')).toBeNull();
  });
});

describe('formatEntityTag', () => {
  it('prefixes the ID with id:', () => {
    expect(formatEntityTag('ab12')).toBe('id:ab12');
    expect(formatEntityTag('0000')).toBe('id:0000');
  });
});

describe('isValidCustomTag', () => {
  it('returns true for normal custom tags', () => {
    expect(isValidCustomTag('combat')).toBe(true);
    expect(isValidCustomTag('session-1')).toBe(true);
    expect(isValidCustomTag('npc')).toBe(true);
  });

  it('returns false for tags that match entity tag format', () => {
    expect(isValidCustomTag('id:ab12')).toBe(false);
    expect(isValidCustomTag('id:0000')).toBe(false);
  });

  it('returns true for near-misses that do not match entity tag format', () => {
    expect(isValidCustomTag('id:abc')).toBe(true);
    expect(isValidCustomTag('id:ABCD')).toBe(true);
    expect(isValidCustomTag('id:')).toBe(true);
  });
});

describe('extractWikiLinkIds', () => {
  it('returns IDs from bare [[id]] links', () => {
    expect(extractWikiLinkIds('Hello [[ab12]] world')).toEqual(['ab12']);
  });

  it('returns the ID part from [[label|id]] links', () => {
    expect(extractWikiLinkIds('See [[Bob|ab12]] and [[Alice|cd34]]')).toEqual(['ab12', 'cd34']);
  });

  it('deduplicates repeated links to the same ID', () => {
    expect(extractWikiLinkIds('[[ab12]] and [[ab12]] again')).toEqual(['ab12']);
  });

  it('returns empty array when there are no wiki links', () => {
    expect(extractWikiLinkIds('Just plain text')).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(extractWikiLinkIds('')).toEqual([]);
  });

  it('ignores links with empty ID', () => {
    expect(extractWikiLinkIds('[[]] and [[label|]]')).toEqual([]);
  });

  it('ignores links whose ID does not match the 4-char entity format', () => {
    expect(extractWikiLinkIds('[[some-long-slug]] and [[ABC1]] and [[ab1]]')).toEqual([]);
  });

  it('handles mixed bare and labelled links', () => {
    const ids = extractWikiLinkIds('[[ab12]] met [[Bob|cd34]] near [[ef56]]');
    expect(ids).toEqual(['ab12', 'cd34', 'ef56']);
  });

  it('handles multi-line bodies', () => {
    const body = 'Line one [[ab12]]\nLine two [[cd34]]';
    expect(extractWikiLinkIds(body)).toEqual(['ab12', 'cd34']);
  });
});

describe('syncEntityTags', () => {
  it('adds entity tags for each linked ID', () => {
    expect(syncEntityTags([], ['ab12', 'cd34'])).toEqual(['id:ab12', 'id:cd34']);
  });

  it('preserves custom tags untouched', () => {
    expect(syncEntityTags(['combat', 'session-1'], ['ab12'])).toEqual([
      'combat',
      'session-1',
      'id:ab12',
    ]);
  });

  it('removes stale entity tags when their link is gone', () => {
    expect(syncEntityTags(['id:ab12', 'id:cd34'], ['ab12'])).toEqual(['id:ab12']);
  });

  it('does not affect custom tags when entity tags are removed', () => {
    expect(syncEntityTags(['combat', 'id:ab12'], [])).toEqual(['combat']);
  });

  it('returns only custom tags when no linked IDs', () => {
    expect(syncEntityTags(['combat', 'plot'], [])).toEqual(['combat', 'plot']);
  });

  it('returns empty array when no tags and no linked IDs', () => {
    expect(syncEntityTags([], [])).toEqual([]);
  });

  it('does not produce duplicate entity tags for the same ID', () => {
    expect(syncEntityTags(['id:ab12'], ['ab12'])).toEqual(['id:ab12']);
  });
});

describe('resolveEntityTagLabel', () => {
  const map = new Map([['ab12', 'Bob the Wizard']]);

  it('returns resolved label and isEntity=true for a known entity tag', () => {
    expect(resolveEntityTagLabel('id:ab12', map)).toEqual({
      display: 'Bob the Wizard',
      isEntity: true,
    });
  });

  it('returns raw tag and isEntity=false for a custom tag', () => {
    expect(resolveEntityTagLabel('combat', map)).toEqual({ display: 'combat', isEntity: false });
  });

  it('returns raw tag and isEntity=false when entity id is not in the map', () => {
    expect(resolveEntityTagLabel('id:zz99', map)).toEqual({ display: 'id:zz99', isEntity: false });
  });

  it('returns raw tag and isEntity=false when map is undefined', () => {
    expect(resolveEntityTagLabel('id:ab12', undefined)).toEqual({
      display: 'id:ab12',
      isEntity: false,
    });
  });
});
