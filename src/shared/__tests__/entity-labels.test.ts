import { describe, it, expect } from 'vitest';
import {
  effectiveTagLabel,
  effectiveLinkLabel,
  buildEntityLabelMap,
  buildEntityTagLabelMap,
  applyEntityDelta,
} from '../entity-labels';
import type { EntityIndexEntry } from '../../types/global';

function makeEntry(overrides: Partial<EntityIndexEntry> = {}): EntityIndexEntry {
  return { id: 'abc1', path: 'notes/foo.md', title: 'Default Title', type: 'note', ...overrides };
}

describe('effectiveTagLabel', () => {
  it('returns title when no tagLabelOverride', () => {
    expect(effectiveTagLabel(makeEntry())).toBe('Default Title');
  });

  it('returns tagLabelOverride when present', () => {
    expect(effectiveTagLabel(makeEntry({ tagLabelOverride: 'Custom Tag' }))).toBe('Custom Tag');
  });

  it('returns title when tagLabelOverride is undefined', () => {
    expect(effectiveTagLabel(makeEntry({ tagLabelOverride: undefined }))).toBe('Default Title');
  });

  it('ignores linkLabelOverride', () => {
    expect(effectiveTagLabel(makeEntry({ linkLabelOverride: 'Link Label' }))).toBe('Default Title');
  });
});

describe('effectiveLinkLabel', () => {
  it('returns title when no linkLabelOverride', () => {
    expect(effectiveLinkLabel(makeEntry())).toBe('Default Title');
  });

  it('returns linkLabelOverride when present', () => {
    expect(effectiveLinkLabel(makeEntry({ linkLabelOverride: 'Custom Link' }))).toBe('Custom Link');
  });

  it('returns title when linkLabelOverride is undefined', () => {
    expect(effectiveLinkLabel(makeEntry({ linkLabelOverride: undefined }))).toBe('Default Title');
  });

  it('ignores tagLabelOverride', () => {
    expect(effectiveLinkLabel(makeEntry({ tagLabelOverride: 'Tag Label' }))).toBe('Default Title');
  });
});

describe('buildEntityLabelMap', () => {
  it('builds a map of id → effective link label', () => {
    const index = [
      makeEntry({ id: 'aa11', title: 'Alice' }),
      makeEntry({ id: 'bb22', title: 'Bob', linkLabelOverride: 'Bobby' }),
    ];
    const map = buildEntityLabelMap(index);
    expect(map.get('aa11')).toBe('Alice');
    expect(map.get('bb22')).toBe('Bobby');
  });

  it('returns an empty map for an empty index', () => {
    expect(buildEntityLabelMap([]).size).toBe(0);
  });

  it('uses linkLabelOverride when present', () => {
    const map = buildEntityLabelMap([makeEntry({ id: 'cc33', linkLabelOverride: 'Custom' })]);
    expect(map.get('cc33')).toBe('Custom');
  });
});

describe('buildEntityTagLabelMap', () => {
  it('builds a map of id → effective tag label', () => {
    const index = [
      makeEntry({ id: 'aa11', title: 'Alice' }),
      makeEntry({ id: 'bb22', title: 'Bob', tagLabelOverride: 'Bobby' }),
    ];
    const map = buildEntityTagLabelMap(index);
    expect(map.get('aa11')).toBe('Alice');
    expect(map.get('bb22')).toBe('Bobby');
  });

  it('returns an empty map for an empty index', () => {
    expect(buildEntityTagLabelMap([]).size).toBe(0);
  });

  it('uses tagLabelOverride when present, not linkLabelOverride', () => {
    const map = buildEntityTagLabelMap([
      makeEntry({ id: 'cc33', tagLabelOverride: 'Tag', linkLabelOverride: 'Link' }),
    ]);
    expect(map.get('cc33')).toBe('Tag');
  });
});

describe('applyEntityDelta', () => {
  const a = makeEntry({ id: 'aa11', path: 'notes/a.md', title: 'Alpha' });
  const b = makeEntry({ id: 'bb22', path: 'notes/b.md', title: 'Beta' });

  it('appends a new entry on add', () => {
    const result = applyEntityDelta([a], { op: 'add', entry: b });
    expect(result).toHaveLength(2);
    expect(result.find((e) => e.id === 'bb22')).toBeDefined();
  });

  it('replaces an existing entry by id on update', () => {
    const updated = makeEntry({ id: 'aa11', path: 'notes/a.md', title: 'Alpha Renamed' });
    const result = applyEntityDelta([a, b], { op: 'update', entry: updated });
    expect(result).toHaveLength(2);
    expect(result.find((e) => e.id === 'aa11')?.title).toBe('Alpha Renamed');
  });

  it('deduplicates by path on add (same path, different id)', () => {
    const samePathDifferentId = makeEntry({ id: 'zz99', path: 'notes/a.md', title: 'Dup' });
    const result = applyEntityDelta([a, b], { op: 'add', entry: samePathDifferentId });
    expect(result).toHaveLength(2);
    expect(result.find((e) => e.id === 'aa11')).toBeUndefined();
    expect(result.find((e) => e.id === 'zz99')).toBeDefined();
  });

  it('removes the matching entry by path on remove', () => {
    const result = applyEntityDelta([a, b], { op: 'remove', path: 'notes/a.md' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('bb22');
  });

  it('returns unchanged array when remove path does not match', () => {
    const result = applyEntityDelta([a, b], { op: 'remove', path: 'notes/missing.md' });
    expect(result).toHaveLength(2);
  });
});
