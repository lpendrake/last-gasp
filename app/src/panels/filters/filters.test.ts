import { describe, it, expect } from 'vitest';
import {
  applyFilters, matchesFilter, filterSummary,
  makeInitialFilterState, newFilterId,
} from './logic.ts';
import type { Filter, TagFilter, DateFilter } from './types.ts';
import type { EventListItem } from '../../data/types.ts';

function ev(overrides: Partial<EventListItem>): EventListItem {
  return {
    filename: 'x.md',
    title: 'x',
    date: '4726-05-04',
    tags: [],
    mtime: 'Wed, 22 Apr 2026 00:00:00 GMT',
    ...overrides,
  };
}

function tagF(tags: string[], enabled = true): TagFilter {
  return { id: newFilterId(), type: 'tag', enabled, pinned: false, tags };
}

function dateF(
  field: 'in-game' | 'session' | 'creation',
  from: string | null,
  to: string | null,
  enabled = true,
): DateFilter {
  return { id: newFilterId(), type: 'date', enabled, pinned: false, field, from, to };
}

describe('applyFilters — empty state', () => {
  it('returns all events when no filters are set', () => {
    const events = [ev({ filename: 'a.md' }), ev({ filename: 'b.md' })];
    expect(applyFilters(events, makeInitialFilterState())).toHaveLength(2);
  });

  it('ignores disabled filters', () => {
    const events = [ev({ tags: ['plot:beast'] })];
    const state = { filters: [tagF(['faction:abadar'], false)] };
    expect(applyFilters(events, state)).toHaveLength(1);
  });
});

describe('applyFilters — tag filters', () => {
  it('matches events whose tags intersect the filter tag list (OR within filter)', () => {
    const events = [
      ev({ filename: 'a.md', tags: ['plot:beast'] }),
      ev({ filename: 'b.md', tags: ['plot:twin-thorns'] }),
      ev({ filename: 'c.md', tags: ['gm-notes'] }),
    ];
    const state = { filters: [tagF(['plot:beast', 'plot:twin-thorns'])] };
    const out = applyFilters(events, state);
    expect(out.map(e => e.filename).sort()).toEqual(['a.md', 'b.md']);
  });

  it('requires ALL enabled filters to match (AND across filters)', () => {
    const events = [
      ev({ filename: 'a.md', tags: ['plot:beast', 'faction:abadar'] }),
      ev({ filename: 'b.md', tags: ['plot:beast'] }),
      ev({ filename: 'c.md', tags: ['faction:abadar'] }),
    ];
    const state = {
      filters: [
        tagF(['plot:beast']),
        tagF(['faction:abadar']),
      ],
    };
    const out = applyFilters(events, state);
    expect(out.map(e => e.filename)).toEqual(['a.md']);
  });

  it('excludes untagged events when a tag filter is present', () => {
    const events = [ev({ filename: 'a.md', tags: [] })];
    const state = { filters: [tagF(['plot:beast'])] };
    expect(applyFilters(events, state)).toHaveLength(0);
  });
});

describe('applyFilters — date filter: in-game', () => {
  it('includes events on the From boundary', () => {
    const events = [ev({ date: '4726-05-04' })];
    const state = { filters: [dateF('in-game', '4726-05-04', null)] };
    expect(applyFilters(events, state)).toHaveLength(1);
  });

  it('includes events on the To boundary (inclusive whole day)', () => {
    const events = [ev({ date: '4726-05-04T23:59:59' })];
    const state = { filters: [dateF('in-game', null, '4726-05-04')] };
    expect(applyFilters(events, state)).toHaveLength(1);
  });

  it('excludes out-of-range events', () => {
    const events = [
      ev({ filename: 'before.md', date: '4726-05-03' }),
      ev({ filename: 'after.md',  date: '4726-05-05' }),
    ];
    const state = { filters: [dateF('in-game', '4726-05-04', '4726-05-04')] };
    expect(applyFilters(events, state)).toHaveLength(0);
  });
});

describe('applyFilters — date filter: session', () => {
  it('matches events whose session tag falls in the range', () => {
    const events = [
      ev({ filename: 'a.md', tags: ['session:2026-02-01'] }),
      ev({ filename: 'b.md', tags: ['session:2026-03-01'] }),
    ];
    const state = { filters: [dateF('session', '2026-02-01', '2026-02-28')] };
    expect(applyFilters(events, state).map(e => e.filename)).toEqual(['a.md']);
  });

  it('excludes events with no session tag', () => {
    const events = [ev({ tags: ['gm-notes'] })];
    const state = { filters: [dateF('session', '2026-01-01', '2027-01-01')] };
    expect(applyFilters(events, state)).toHaveLength(0);
  });

  it('matches when any of multiple session tags falls in range', () => {
    const events = [ev({ tags: ['session:2026-01-01', 'session:2026-03-15'] })];
    const state = { filters: [dateF('session', '2026-03-01', '2026-03-31')] };
    expect(applyFilters(events, state)).toHaveLength(1);
  });
});

describe('applyFilters — date filter: creation (mtime)', () => {
  it('compares the UTC calendar day of mtime against the range', () => {
    const events = [
      ev({ filename: 'a.md', mtime: 'Wed, 22 Apr 2026 10:00:00 GMT' }),
      ev({ filename: 'b.md', mtime: 'Tue, 21 Apr 2026 23:59:59 GMT' }),
    ];
    const state = { filters: [dateF('creation', '2026-04-22', '2026-04-22')] };
    expect(applyFilters(events, state).map(e => e.filename)).toEqual(['a.md']);
  });

  it('accepts ISO mtime as well', () => {
    const events = [ev({ mtime: '2026-04-22T10:00:00.000Z' })];
    const state = { filters: [dateF('creation', '2026-04-22', '2026-04-22')] };
    expect(applyFilters(events, state)).toHaveLength(1);
  });
});

describe('matchesFilter — edge cases', () => {
  it('vacuous tag filter (no tags chosen yet) matches everything', () => {
    expect(matchesFilter(ev({ tags: ['plot:beast'] }), tagF([]))).toBe(true);
  });

  it('vacuous date filter matches everything', () => {
    expect(matchesFilter(ev({ date: '4726-05-04' }), dateF('in-game', null, null))).toBe(true);
  });
});

describe('filterSummary', () => {
  it('summarises a tag filter with OR between tags', () => {
    expect(filterSummary(tagF(['plot:beast', 'plot:twin-thorns'])))
      .toBe('Tags: plot:beast OR plot:twin-thorns');
  });

  it('summarises a date filter with field prefix', () => {
    expect(filterSummary(dateF('in-game', '4726-03-01', '4726-05-04')))
      .toBe('In-game: 4726-03-01 → 4726-05-04');
    expect(filterSummary(dateF('session', '2026-02-01', '2026-02-28')))
      .toBe('Session: 2026-02-01 → 2026-02-28');
    expect(filterSummary(dateF('creation', '2026-04-22', null)))
      .toBe('Created: ≥ 2026-04-22');
  });

  it('labels empty date filters as (any)', () => {
    expect(filterSummary(dateF('in-game', null, null))).toBe('In-game: (any)');
  });

  it('labels empty tag filters clearly', () => {
    const f: Filter = tagF([]);
    expect(filterSummary(f)).toBe('(no tags selected)');
  });
});
