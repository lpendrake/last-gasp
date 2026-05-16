import { describe, it, expect } from 'vitest';
import {
  seshTagsMatch,
  mergeSeshTags,
  computeEventsNeedingSeshTagUpdate,
} from '../session-tag-sync';
import type { EventListItem, Session } from '../../data/types';

function makeEvent(filename: string, date: string, tags?: string[]): EventListItem {
  return {
    filename,
    date,
    title: 'T',
    mtime: '2024-01-01T00:00:00',
    ...(tags !== undefined ? { tags } : {}),
  };
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 's1',
    inGameStart: '4726-05-04T13:00:00',
    inGameEnd: '4726-05-04T17:00:00',
    realStart: '2024-01-15T13:00:00',
    realEnd: '2024-01-15T17:00:00',
    color: '#6b7c5a',
    ...overrides,
  };
}

// --- seshTagsMatch ---

describe('seshTagsMatch', () => {
  it('returns true when existing and computed are both empty', () => {
    expect(seshTagsMatch([], [])).toBe(true);
  });

  it('returns true when undefined existing and empty computed', () => {
    expect(seshTagsMatch(undefined, [])).toBe(true);
  });

  it('returns true when sesh tags match', () => {
    expect(seshTagsMatch(['sesh:01', 'other'], ['sesh:01'])).toBe(true);
  });

  it('returns true when sesh tags match in different order', () => {
    expect(seshTagsMatch(['sesh:b', 'sesh:a'], ['sesh:a', 'sesh:b'])).toBe(true);
  });

  it('returns false when computed has more tags than existing', () => {
    expect(seshTagsMatch(['sesh:01'], ['sesh:01', 'sesh:02'])).toBe(false);
  });

  it('returns false when existing has more sesh tags than computed', () => {
    expect(seshTagsMatch(['sesh:01', 'sesh:02'], ['sesh:01'])).toBe(false);
  });

  it('returns false when sesh tags are completely different', () => {
    expect(seshTagsMatch(['sesh:old'], ['sesh:new'])).toBe(false);
  });

  it('ignores non-sesh tags when comparing', () => {
    expect(seshTagsMatch(['sesh:01', 'some-tag', 'another'], ['sesh:01'])).toBe(true);
  });
});

// --- mergeSeshTags ---

describe('mergeSeshTags', () => {
  it('returns computed sesh tags when no existing tags', () => {
    expect(mergeSeshTags(undefined, ['sesh:01'])).toEqual(['sesh:01']);
  });

  it('preserves non-sesh tags and appends computed sesh tags', () => {
    expect(mergeSeshTags(['other', 'tags'], ['sesh:01'])).toEqual(['other', 'tags', 'sesh:01']);
  });

  it('strips old sesh tags', () => {
    expect(mergeSeshTags(['sesh:old', 'keep'], ['sesh:new'])).toEqual(['keep', 'sesh:new']);
  });

  it('returns only non-sesh tags when computed is empty', () => {
    expect(mergeSeshTags(['keep', 'sesh:remove'], [])).toEqual(['keep']);
  });

  it('returns empty array when both inputs are empty', () => {
    expect(mergeSeshTags([], [])).toEqual([]);
  });

  it('preserves original order of non-sesh tags', () => {
    expect(mergeSeshTags(['z', 'a', 'sesh:old', 'm'], ['sesh:new'])).toEqual([
      'z',
      'a',
      'm',
      'sesh:new',
    ]);
  });
});

// --- computeEventsNeedingSeshTagUpdate ---

describe('computeEventsNeedingSeshTagUpdate', () => {
  it('returns empty array when there are no events', () => {
    expect(computeEventsNeedingSeshTagUpdate([], [makeSession()])).toEqual([]);
  });

  it('returns empty array when no sessions and event has no sesh tags', () => {
    expect(
      computeEventsNeedingSeshTagUpdate([makeEvent('a.md', '4726-01-01T00:00:00')], []),
    ).toEqual([]);
  });

  it('includes event when it should gain a sesh tag but has none', () => {
    const event = makeEvent('a.md', '4726-05-04T15:00:00');
    expect(computeEventsNeedingSeshTagUpdate([event], [makeSession()])).toContain('a.md');
  });

  it('includes event when it has a stale sesh tag and sessions are now empty (cleanup)', () => {
    const event = makeEvent('a.md', '4726-05-04T15:00:00', ['sesh:old']);
    expect(computeEventsNeedingSeshTagUpdate([event], [])).toContain('a.md');
  });

  it('skips events whose date fails to parse', () => {
    expect(
      computeEventsNeedingSeshTagUpdate([makeEvent('bad.md', 'not-a-date')], [makeSession()]),
    ).toEqual([]);
  });

  it('does not include event when both computed and existing sesh tags are empty', () => {
    // Event is outside any session range and has no sesh tags — nothing to do
    const event = makeEvent('out.md', '4726-01-01T00:00:00');
    expect(computeEventsNeedingSeshTagUpdate([event], [makeSession()])).toEqual([]);
  });

  it('returns only filenames that need updating among multiple events', () => {
    const inRange = makeEvent('in.md', '4726-05-04T15:00:00');
    const outRange = makeEvent('out.md', '4726-01-01T00:00:00');
    const result = computeEventsNeedingSeshTagUpdate([inRange, outRange], [makeSession()]);
    expect(result).toContain('in.md');
    expect(result).not.toContain('out.md');
  });

  it('does not mutate the input arrays', () => {
    const events = [makeEvent('a.md', '4726-05-04T15:00:00', ['sesh:old'])];
    const sessions = [makeSession()];
    computeEventsNeedingSeshTagUpdate(events, sessions);
    expect(events[0].tags).toEqual(['sesh:old']);
    expect(sessions).toHaveLength(1);
  });
});
