import { describe, it, expect } from 'vitest';
import { effectiveTagLabel, effectiveLinkLabel } from '../entity-labels';
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
