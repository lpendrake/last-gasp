import { describe, it, expect } from 'vitest';
import {
  isEntityTag,
  parseEntityTag,
  formatEntityTag,
  isValidCustomTag,
  resolveEntityTagLabel,
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
