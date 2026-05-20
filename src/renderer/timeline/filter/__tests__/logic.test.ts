// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { EventListItem, Session } from '../../data/types';
import type { DateFilter, TagFilter } from '../types';
import {
  applyFilters,
  collectAllTags,
  filterSummary,
  makeInitialFilterState,
  nowForField,
} from '../logic';
import {
  loadPinnedFilters,
  loadSessionFilters,
  savePinnedFilters,
  saveSessionFilters,
} from '../persistence';

// ---- Helpers ----

function makeEvent(overrides: Partial<EventListItem> = {}): EventListItem {
  return {
    filename: 'test.md',
    title: 'Test Event',
    date: '4726-01-01',
    mtime: '2026-01-15T00:00:00.000Z',
    tags: [],
    ...overrides,
  };
}

function makeTagFilter(tags: string[], overrides: Partial<TagFilter> = {}): TagFilter {
  return { id: 'f1', type: 'tag', enabled: true, pinned: false, tags, ...overrides };
}

function makeDateFilter(overrides: Partial<DateFilter> = {}): DateFilter {
  return {
    id: 'f2',
    type: 'date',
    enabled: true,
    pinned: false,
    field: 'in-game',
    from: null,
    to: null,
    ...overrides,
  };
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 's1',
    inGameStart: '4726-01-01',
    inGameEnd: '4726-01-02',
    realStart: '2026-01-15',
    realEnd: '2026-01-15',
    color: '#fff',
    ...overrides,
  };
}

// ---- applyFilters ----

describe('applyFilters', () => {
  const ev1 = makeEvent({ filename: 'a.md', tags: ['plot:beast', 'faction:abadar'] });
  const ev2 = makeEvent({ filename: 'b.md', tags: ['faction:abadar'] });
  const ev3 = makeEvent({ filename: 'c.md', tags: [] });

  it('returns a copy of all events when no filters active', () => {
    const input = [ev1, ev2];
    const state = makeInitialFilterState();
    const result = applyFilters(input, state);
    expect(result).toEqual(input);
    expect(result).not.toBe(input);
  });

  it('does not mutate the input array', () => {
    const events = [ev1, ev2];
    const state = makeInitialFilterState();
    applyFilters(events, state);
    expect(events).toHaveLength(2);
  });

  it('ignores disabled filters', () => {
    const state = { filters: [makeTagFilter(['plot:beast'], { enabled: false })] };
    expect(applyFilters([ev1, ev2, ev3], state)).toEqual([ev1, ev2, ev3]);
  });

  describe('tag filter — OR semantics', () => {
    it('matches events with any of the filter tags', () => {
      const state = { filters: [makeTagFilter(['plot:beast'])] };
      expect(applyFilters([ev1, ev2, ev3], state)).toEqual([ev1]);
    });

    it('OR: matches events with either tag', () => {
      const state = { filters: [makeTagFilter(['plot:beast', 'faction:abadar'])] };
      expect(applyFilters([ev1, ev2, ev3], state)).toEqual([ev1, ev2]);
    });

    it('vacuous tag filter (empty tags) matches all events', () => {
      const state = { filters: [makeTagFilter([])] };
      expect(applyFilters([ev1, ev2, ev3], state)).toEqual([ev1, ev2, ev3]);
    });

    it('excludes events with no matching tags', () => {
      const state = { filters: [makeTagFilter(['npc:unknown'])] };
      expect(applyFilters([ev1, ev2, ev3], state)).toEqual([]);
    });
  });

  describe('multiple filters — AND semantics', () => {
    it('event must match all enabled filters', () => {
      const state = {
        filters: [makeTagFilter(['plot:beast']), makeTagFilter(['faction:abadar'], { id: 'f2' })],
      };
      // ev1 has both; ev2 only has faction:abadar (no plot:beast)
      expect(applyFilters([ev1, ev2], state)).toEqual([ev1]);
    });

    it('with one disabled filter, only enabled filter applies', () => {
      const state = {
        filters: [
          makeTagFilter(['plot:beast'], { enabled: false }),
          makeTagFilter(['faction:abadar'], { id: 'f2' }),
        ],
      };
      expect(applyFilters([ev1, ev2, ev3], state)).toEqual([ev1, ev2]);
    });
  });

  describe('date filter — in-game', () => {
    // date '4726-01-15' is after '4726-01-01'
    const evEarly = makeEvent({ date: '4726-01-01', filename: 'early.md' });
    const evLate = makeEvent({ date: '4726-06-15', filename: 'late.md' });

    it('null bounds match all', () => {
      const state = { filters: [makeDateFilter({ field: 'in-game' })] };
      expect(applyFilters([evEarly, evLate], state)).toEqual([evEarly, evLate]);
    });

    it('from bound is inclusive', () => {
      const state = {
        filters: [makeDateFilter({ field: 'in-game', from: '4726-06-15', to: null })],
      };
      expect(applyFilters([evEarly, evLate], state)).toEqual([evLate]);
    });

    it('to bound is inclusive for whole day', () => {
      const state = {
        filters: [makeDateFilter({ field: 'in-game', from: null, to: '4726-01-01' })],
      };
      // evEarly date is exactly '4726-01-01'; to +86400s means that whole day is included
      expect(applyFilters([evEarly, evLate], state)).toEqual([evEarly]);
    });
  });

  describe('date filter — session', () => {
    const session = makeSession({ realStart: '2026-01-15' });
    const evWithSesh = makeEvent({
      filename: 'sesh.md',
      tags: ['sesh:Jan 15'],
    });
    const evNoSesh = makeEvent({ filename: 'nosesh.md', tags: [] });

    it('matches events whose session real date is in range', () => {
      const state = {
        filters: [makeDateFilter({ field: 'session', from: '2026-01-15', to: '2026-01-15' })],
      };
      expect(applyFilters([evWithSesh, evNoSesh], state, [session])).toEqual([evWithSesh]);
    });

    it('excludes events with no sesh: tags', () => {
      const state = {
        filters: [makeDateFilter({ field: 'session', from: '2026-01-01', to: null })],
      };
      expect(applyFilters([evNoSesh], state, [session])).toEqual([]);
    });

    it('excludes events outside session date range', () => {
      const state = {
        filters: [makeDateFilter({ field: 'session', from: '2026-02-01', to: '2026-02-28' })],
      };
      expect(applyFilters([evWithSesh], state, [session])).toEqual([]);
    });
  });

  describe('date filter — creation', () => {
    const evIso = makeEvent({ mtime: '2026-01-15T10:30:00.000Z', filename: 'iso.md' });
    const evRfc = makeEvent({
      mtime: 'Wed, 15 Jan 2026 10:30:00 GMT',
      filename: 'rfc.md',
    });
    const evOld = makeEvent({ mtime: '2025-12-01T00:00:00.000Z', filename: 'old.md' });

    it('matches ISO mtime', () => {
      const state = {
        filters: [makeDateFilter({ field: 'creation', from: '2026-01-15', to: '2026-01-15' })],
      };
      expect(applyFilters([evIso, evOld], state)).toEqual([evIso]);
    });

    it('matches RFC2822 mtime', () => {
      const state = {
        filters: [makeDateFilter({ field: 'creation', from: '2026-01-15', to: '2026-01-15' })],
      };
      expect(applyFilters([evRfc, evOld], state)).toEqual([evRfc]);
    });

    it('excludes event outside range', () => {
      const state = {
        filters: [makeDateFilter({ field: 'creation', from: '2026-01-15', to: '2026-01-31' })],
      };
      expect(applyFilters([evOld], state)).toEqual([]);
    });

    it('excludes event with invalid mtime', () => {
      const evBadMtime = makeEvent({ mtime: 'not-a-date', filename: 'bad.md' });
      const state = {
        filters: [makeDateFilter({ field: 'creation', from: '2026-01-01', to: null })],
      };
      expect(applyFilters([evBadMtime], state)).toEqual([]);
    });
  });
});

// ---- filterSummary ----

describe('filterSummary', () => {
  it('tag: no tags selected', () => {
    expect(filterSummary(makeTagFilter([]))).toBe('(no tags selected)');
  });

  it('tag: single tag', () => {
    expect(filterSummary(makeTagFilter(['plot:beast']))).toBe('Tags: plot:beast');
  });

  it('tag: multiple tags', () => {
    expect(filterSummary(makeTagFilter(['a', 'b']))).toBe('Tags: a OR b');
  });

  it('date in-game: both bounds', () => {
    expect(
      filterSummary(makeDateFilter({ field: 'in-game', from: '4726-01-01', to: '4726-12-31' })),
    ).toBe('In-game: 4726-01-01 → 4726-12-31');
  });

  it('date session: from only', () => {
    expect(filterSummary(makeDateFilter({ field: 'session', from: '2026-01-01', to: null }))).toBe(
      'Session: ≥ 2026-01-01',
    );
  });

  it('date creation: to only', () => {
    expect(filterSummary(makeDateFilter({ field: 'creation', from: null, to: '2026-12-31' }))).toBe(
      'Created: ≤ 2026-12-31',
    );
  });

  it('date: no bounds', () => {
    expect(filterSummary(makeDateFilter({ field: 'in-game' }))).toBe('In-game: (any)');
  });
});

// ---- collectAllTags ----

describe('collectAllTags', () => {
  it('returns sorted unique tags from all events', () => {
    const events = [
      makeEvent({ tags: ['z', 'a'] }),
      makeEvent({ tags: ['a', 'b'] }),
      makeEvent({ tags: undefined }),
    ];
    expect(collectAllTags(events)).toEqual(['a', 'b', 'z']);
  });
});

// ---- nowForField ----

describe('nowForField', () => {
  it('in-game uses inGameNow sliced to 10 chars', () => {
    expect(nowForField('in-game', '4726-05-04T12:00:00', '2026-05-04')).toBe('4726-05-04');
  });

  it('session uses realWorldNow', () => {
    expect(nowForField('session', '4726-05-04', '2026-05-04')).toBe('2026-05-04');
  });

  it('creation uses realWorldNow', () => {
    expect(nowForField('creation', '4726-05-04', '2026-05-04')).toBe('2026-05-04');
  });
});

// ---- persistence ----

describe('persistence', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('returns empty array when nothing stored', () => {
    expect(loadPinnedFilters()).toEqual([]);
  });

  it('round-trips a TagFilter', () => {
    const f: TagFilter = {
      id: 'f1',
      type: 'tag',
      enabled: true,
      pinned: true,
      tags: ['plot:beast'],
    };
    savePinnedFilters({ filters: [f] });
    const loaded = loadPinnedFilters();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toMatchObject({ id: 'f1', type: 'tag', tags: ['plot:beast'], pinned: true });
  });

  it('round-trips a DateFilter', () => {
    const f: DateFilter = {
      id: 'f2',
      type: 'date',
      enabled: false,
      pinned: true,
      field: 'in-game',
      from: '4726-01-01',
      to: null,
    };
    savePinnedFilters({ filters: [f] });
    const loaded = loadPinnedFilters();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toMatchObject({ id: 'f2', type: 'date', field: 'in-game', pinned: true });
  });

  it('only saves pinned:true filters', () => {
    const pinned: TagFilter = { id: 'p1', type: 'tag', enabled: true, pinned: true, tags: [] };
    const unpinned: TagFilter = { id: 'u1', type: 'tag', enabled: true, pinned: false, tags: [] };
    savePinnedFilters({ filters: [pinned, unpinned] });
    const loaded = loadPinnedFilters();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('p1');
  });

  it('returns empty array for malformed JSON', () => {
    localStorage.setItem('last-gasp-pinned-filters', 'not-json');
    expect(loadPinnedFilters()).toEqual([]);
  });

  it('returns empty array for non-array JSON', () => {
    localStorage.setItem('last-gasp-pinned-filters', JSON.stringify({ filters: [] }));
    expect(loadPinnedFilters()).toEqual([]);
  });

  it('filters out entries with missing required fields', () => {
    localStorage.setItem('last-gasp-pinned-filters', JSON.stringify([{ type: 'tag', tags: [] }]));
    expect(loadPinnedFilters()).toEqual([]);
  });
});

describe('session filters persistence', () => {
  const CAMPAIGN = '/campaigns/test';

  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  it('returns null when nothing stored', () => {
    expect(loadSessionFilters(CAMPAIGN)).toBeNull();
  });

  it('round-trips a FilterState', () => {
    const state = {
      filters: [
        makeTagFilter(['plot:beast'], { enabled: true, pinned: false }),
        makeDateFilter({ field: 'in-game', from: '4726-01-01', to: null }),
      ],
    };
    saveSessionFilters(CAMPAIGN, state);
    const loaded = loadSessionFilters(CAMPAIGN);
    expect(loaded).not.toBeNull();
    expect(loaded!.filters).toHaveLength(2);
    expect(loaded!.filters[0]).toMatchObject({ type: 'tag', tags: ['plot:beast'] });
  });

  it('returns null for malformed JSON', () => {
    sessionStorage.setItem('last-gasp-session-filters:/campaigns/test', 'bad-json');
    expect(loadSessionFilters(CAMPAIGN)).toBeNull();
  });

  it('isolates state by campaign path', () => {
    const stateA = { filters: [makeTagFilter(['a'])] };
    const stateB = { filters: [makeTagFilter(['b'])] };
    saveSessionFilters('/campaigns/a', stateA);
    saveSessionFilters('/campaigns/b', stateB);
    expect(loadSessionFilters('/campaigns/a')!.filters[0]).toMatchObject({ tags: ['a'] });
    expect(loadSessionFilters('/campaigns/b')!.filters[0]).toMatchObject({ tags: ['b'] });
  });
});
