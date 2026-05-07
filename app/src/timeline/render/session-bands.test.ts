import { describe, it, expect } from 'vitest';
import { computeSessionBands } from './session-bands.ts';
import type { EventListItem } from '../../data/types.ts';
import { parseISOString, toAbsoluteSeconds } from '../../calendar/golarian.ts';

function makeEvent(overrides: Partial<EventListItem>): EventListItem {
  return {
    filename: 'x.md',
    title: 'x',
    date: '4726-05-04',
    tags: [],
    mtime: 'Wed, 22 Apr 2026 00:00:00 GMT',
    ...overrides,
  };
}

describe('computeSessionBands', () => {
  it('groups events by session tag and finds min/max seconds', () => {
    const events: EventListItem[] = [
      makeEvent({ date: '4726-05-04', tags: ['session:2026-02-01'] }),
      makeEvent({ date: '4726-05-06', tags: ['session:2026-02-01'] }),
      makeEvent({ date: '4726-05-08', tags: ['session:2026-02-08'] }),
    ];
    const bands = computeSessionBands(events);
    expect(bands).toHaveLength(2);

    const s1 = bands.find(b => b.sessionId === '2026-02-01')!;
    expect(s1.eventCount).toBe(2);
    expect(s1.startSeconds).toBe(toAbsoluteSeconds(parseISOString('4726-05-04')));
    expect(s1.endSeconds).toBe(toAbsoluteSeconds(parseISOString('4726-05-06')));

    const s2 = bands.find(b => b.sessionId === '2026-02-08')!;
    expect(s2.eventCount).toBe(1);
    expect(s2.startSeconds).toBe(s2.endSeconds);
  });

  it('sorts bands by startSeconds', () => {
    const events: EventListItem[] = [
      makeEvent({ date: '4726-06-15', tags: ['session:2026-03-01'] }),
      makeEvent({ date: '4726-05-04', tags: ['session:2026-02-01'] }),
      makeEvent({ date: '4726-05-20', tags: ['session:2026-02-15'] }),
    ];
    const bands = computeSessionBands(events);
    expect(bands.map(b => b.sessionId)).toEqual([
      '2026-02-01', '2026-02-15', '2026-03-01',
    ]);
  });

  it('ignores events without session tags', () => {
    const events: EventListItem[] = [
      makeEvent({ date: '4726-05-04', tags: ['gm-notes'] }),
      makeEvent({ date: '4726-05-06', tags: ['session:2026-02-01'] }),
    ];
    const bands = computeSessionBands(events);
    expect(bands).toHaveLength(1);
    expect(bands[0].eventCount).toBe(1);
  });

  it('handles events tagged with multiple sessions', () => {
    const events: EventListItem[] = [
      makeEvent({ date: '4726-05-04', tags: ['session:a', 'session:b'] }),
      makeEvent({ date: '4726-05-08', tags: ['session:b'] }),
    ];
    const bands = computeSessionBands(events);
    expect(bands).toHaveLength(2);
    const a = bands.find(b => b.sessionId === 'a')!;
    const b = bands.find(b => b.sessionId === 'b')!;
    expect(a.eventCount).toBe(1);
    expect(b.eventCount).toBe(2);
    expect(b.startSeconds).toBe(toAbsoluteSeconds(parseISOString('4726-05-04')));
    expect(b.endSeconds).toBe(toAbsoluteSeconds(parseISOString('4726-05-08')));
  });

  it('returns empty array when no events have session tags', () => {
    const events: EventListItem[] = [
      makeEvent({ date: '4726-05-04', tags: ['gm-notes'] }),
    ];
    expect(computeSessionBands(events)).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(computeSessionBands([])).toEqual([]);
  });
});
