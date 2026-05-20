import { describe, it, expect } from 'vitest';
import {
  computeSessionBandsFromSessions,
  computeSessionLabel,
  computeSessionPills,
  computeTooltipPosition,
  formatRealRange,
  formatGameRange,
  RAIL_H,
  RAIL_OFFSET,
} from '../session-bands';
import type { EventListItem, Session } from '../../data/types';
import { toAbsoluteSeconds, parseISOString } from '../../calendar/golarian';
import { type ViewState, type ViewportSize, secondsToX } from '../../math/zoom';

// ---- Fixtures ----

const SIZE: ViewportSize = { width: 1200, height: 600 };
const REF_DATE = '4726-05-04';
const REF_SECS = toAbsoluteSeconds(parseISOString(REF_DATE));
const VIEW: ViewState = { centerSeconds: REF_SECS, secondsPerPixel: 432 }; // ~200px/day

function makeSession(overrides: Partial<Session> & { id: string }): Session {
  return {
    inGameStart: '4726-05-04',
    inGameEnd: '4726-05-06',
    realStart: '2024-01-15T19:00:00',
    realEnd: '2024-01-15T23:00:00',
    color: '#6b7c5a',
    ...overrides,
  };
}

function makeEvent(date: string, opts: Partial<EventListItem> = {}): EventListItem {
  return {
    filename: `${date}.md`,
    title: 'Event',
    date,
    tags: [],
    mtime: '2026-04-22T00:00:00Z',
    ...opts,
  };
}

// ---- computeSessionBandsFromSessions ----

describe('computeSessionBandsFromSessions', () => {
  it('returns empty for no sessions', () => {
    expect(computeSessionBandsFromSessions([], [])).toEqual([]);
  });

  it('skips sessions without inGameStart', () => {
    const s = makeSession({ id: 's1', inGameStart: '' });
    expect(computeSessionBandsFromSessions([s], [])).toHaveLength(0);
  });

  it('creates one band per session with correct seconds', () => {
    const s = makeSession({ id: 's1', inGameStart: '4726-05-04', inGameEnd: '4726-05-06' });
    const [band] = computeSessionBandsFromSessions([s], []);
    expect(band.sessionId).toBe('s1');
    expect(band.startSeconds).toBe(toAbsoluteSeconds(parseISOString('4726-05-04')));
    expect(band.endSeconds).toBe(toAbsoluteSeconds(parseISOString('4726-05-06')));
  });

  it('sets endSeconds equal to startSeconds when inGameEnd is absent', () => {
    const s = makeSession({ id: 's1', inGameStart: '4726-05-04', inGameEnd: '' });
    const [band] = computeSessionBandsFromSessions([s], []);
    expect(band.endSeconds).toBe(band.startSeconds);
  });

  it('counts events whose date falls within the session bounds (inclusive)', () => {
    const s = makeSession({ id: 's1', inGameStart: '4726-05-04', inGameEnd: '4726-05-06' });
    const events = [
      makeEvent('4726-05-03'), // before
      makeEvent('4726-05-04'), // on start edge
      makeEvent('4726-05-05'), // inside
      makeEvent('4726-05-06'), // on end edge
      makeEvent('4726-05-07'), // after
    ];
    const [band] = computeSessionBandsFromSessions([s], events);
    expect(band.eventCount).toBe(3);
  });

  it('counts zero events when none fall within the session', () => {
    const s = makeSession({ id: 's1', inGameStart: '4726-05-10', inGameEnd: '4726-05-12' });
    const events = [makeEvent('4726-05-04'), makeEvent('4726-05-20')];
    const [band] = computeSessionBandsFromSessions([s], events);
    expect(band.eventCount).toBe(0);
  });

  it('sorts bands by startSeconds', () => {
    const sessions = [
      makeSession({ id: 'later', inGameStart: '4726-06-01', inGameEnd: '4726-06-03' }),
      makeSession({ id: 'earlier', inGameStart: '4726-05-01', inGameEnd: '4726-05-03' }),
    ];
    const bands = computeSessionBandsFromSessions(sessions, []);
    expect(bands[0].sessionId).toBe('earlier');
    expect(bands[1].sessionId).toBe('later');
  });

  it('preserves the session color on the band', () => {
    const s = makeSession({ id: 's1', color: '#ff0000' });
    const [band] = computeSessionBandsFromSessions([s], []);
    expect(band.color).toBe('#ff0000');
  });
});

// ---- computeSessionLabel ----

describe('computeSessionLabel', () => {
  it('returns "Month Day" for a session alone on its real day', () => {
    const s = makeSession({ id: 's1', realStart: '2024-01-15T19:00:00' });
    expect(computeSessionLabel(s, [s])).toBe('Jan 15');
  });

  it('returns plain base label for the first session on a shared real day', () => {
    const s1 = makeSession({
      id: 's1',
      realStart: '2024-02-10T19:00:00',
      inGameStart: '4726-05-04',
    });
    const s2 = makeSession({
      id: 's2',
      realStart: '2024-02-10T19:00:00',
      inGameStart: '4726-05-07',
    });
    expect(computeSessionLabel(s1, [s1, s2])).toBe('Feb 10');
  });

  it('appends "(2)" for the second session on the same real day', () => {
    const s1 = makeSession({
      id: 's1',
      realStart: '2024-02-10T19:00:00',
      inGameStart: '4726-05-04',
    });
    const s2 = makeSession({
      id: 's2',
      realStart: '2024-02-10T19:00:00',
      inGameStart: '4726-05-07',
    });
    expect(computeSessionLabel(s2, [s1, s2])).toBe('Feb 10 (2)');
  });

  it('uses id as tiebreaker when two sessions share the same inGameStart and real day', () => {
    const s1 = makeSession({
      id: 'aaa',
      realStart: '2024-03-01T19:00:00',
      inGameStart: '4726-05-04',
    });
    const s2 = makeSession({
      id: 'zzz',
      realStart: '2024-03-01T19:00:00',
      inGameStart: '4726-05-04',
    });
    expect(computeSessionLabel(s1, [s1, s2])).toBe('Mar 1');
    expect(computeSessionLabel(s2, [s1, s2])).toBe('Mar 1 (2)');
  });

  it('ignores sessions from other real days when disambiguating', () => {
    const s1 = makeSession({ id: 's1', realStart: '2024-04-01T19:00:00' });
    const s2 = makeSession({ id: 's2', realStart: '2024-04-05T19:00:00' });
    expect(computeSessionLabel(s1, [s1, s2])).toBe('Apr 1');
    expect(computeSessionLabel(s2, [s1, s2])).toBe('Apr 5');
  });
});

// ---- computeSessionPills ----

describe('computeSessionPills', () => {
  it('returns empty for no bands', () => {
    expect(computeSessionPills([], [], VIEW, SIZE)).toEqual([]);
  });

  it('returns empty for zero-width viewport', () => {
    const s = makeSession({ id: 's1' });
    const bands = computeSessionBandsFromSessions([s], []);
    expect(computeSessionPills(bands, [s], VIEW, { width: 0, height: 600 })).toEqual([]);
  });

  it('returns empty for zero-height viewport', () => {
    const s = makeSession({ id: 's1' });
    const bands = computeSessionBandsFromSessions([s], []);
    expect(computeSessionPills(bands, [s], VIEW, { width: 1200, height: 0 })).toEqual([]);
  });

  it('positions pill left edge at secondsToX of session start when unclamped', () => {
    const s = makeSession({
      id: 's1',
      inGameStart: REF_DATE,
      inGameEnd: '4726-05-06',
      color: '#abc',
    });
    const bands = computeSessionBandsFromSessions([s], []);
    const [pill] = computeSessionPills(bands, [s], VIEW, SIZE);
    const expectedStartX = secondsToX(REF_SECS, VIEW, SIZE);
    expect(pill.left).toBeCloseTo(expectedStartX, 1);
  });

  it('gives instant sessions a minimum pill width of 12px', () => {
    const s = makeSession({ id: 's1', inGameStart: REF_DATE, inGameEnd: REF_DATE });
    const bands = computeSessionBandsFromSessions([s], []);
    const [pill] = computeSessionPills(bands, [s], VIEW, SIZE);
    expect(pill.width).toBeGreaterThanOrEqual(12);
  });

  it('clamps a pill whose left edge is off-screen left to -4px', () => {
    // Session starts 200px left of viewport but ends 50px into it:
    // startX ≈ -200, endX ≈ +50  →  clampedLeft = -4, clampedRight = 50, width = 54
    const offsetSecs = 200 * VIEW.secondsPerPixel; // 200px worth of seconds
    const sessionStart = REF_SECS - (SIZE.width / 2 + 200) * VIEW.secondsPerPixel;
    const sessionEnd = sessionStart + offsetSecs;
    const bands = [
      { sessionId: 's1', startSeconds: sessionStart, endSeconds: sessionEnd, eventCount: 0 },
    ];
    const s = makeSession({ id: 's1', inGameStart: '', inGameEnd: '', color: '#abc' });
    const [pill] = computeSessionPills(bands, [s], VIEW, SIZE);
    expect(pill.left).toBeCloseTo(-4, 1);
    expect(pill.width).toBeGreaterThan(0);
  });

  it('skips pills entirely off-screen to the left', () => {
    const farLeft = toAbsoluteSeconds(parseISOString('4725-05-04'));
    const bands = [
      { sessionId: 's1', startSeconds: farLeft, endSeconds: farLeft + 86400, eventCount: 0 },
    ];
    const s = makeSession({
      id: 's1',
      color: '#abc',
      inGameStart: '4725-05-04',
      inGameEnd: '4725-05-05',
    });
    expect(computeSessionPills(bands, [s], VIEW, SIZE)).toHaveLength(0);
  });

  it('skips pills entirely off-screen to the right', () => {
    const farRight = toAbsoluteSeconds(parseISOString('4727-05-04'));
    const bands = [
      { sessionId: 's1', startSeconds: farRight, endSeconds: farRight + 86400, eventCount: 0 },
    ];
    const s = makeSession({
      id: 's1',
      color: '#abc',
      inGameStart: '4727-05-04',
      inGameEnd: '4727-05-05',
    });
    expect(computeSessionPills(bands, [s], VIEW, SIZE)).toHaveLength(0);
  });

  it('sets pill top to axisY + RAIL_OFFSET', () => {
    const s = makeSession({ id: 's1', inGameStart: REF_DATE, inGameEnd: '4726-05-06' });
    const bands = computeSessionBandsFromSessions([s], []);
    const [pill] = computeSessionPills(bands, [s], VIEW, SIZE);
    const axisY = Math.floor(SIZE.height * 0.8);
    expect(pill.top).toBe(axisY + RAIL_OFFSET);
  });

  it('sets pill height to RAIL_H', () => {
    const s = makeSession({ id: 's1', inGameStart: REF_DATE, inGameEnd: '4726-05-06' });
    const bands = computeSessionBandsFromSessions([s], []);
    const [pill] = computeSessionPills(bands, [s], VIEW, SIZE);
    expect(pill.height).toBe(RAIL_H);
  });

  it('omits label when pill width is <= 60px', () => {
    // Session spans 2 hours (7200 sec) at VIEW (432 sec/px) → 16.7px wide — renders but too narrow for label
    const twoHoursSecs = 7200;
    const start = REF_SECS;
    const end = REF_SECS + twoHoursSecs;
    const bands = [{ sessionId: 's1', startSeconds: start, endSeconds: end, eventCount: 0 }];
    const s = makeSession({ id: 's1', color: '#abc' });
    const pills = computeSessionPills(bands, [s], VIEW, SIZE);
    expect(pills).toHaveLength(1);
    expect(pills[0].label).toBeNull();
  });

  it('shows label when pill is wide enough (> 60px)', () => {
    const wideView: ViewState = { centerSeconds: REF_SECS, secondsPerPixel: 86400 / 200 };
    const s = makeSession({
      id: 's1',
      inGameStart: REF_DATE,
      inGameEnd: '4726-05-10',
      realStart: '2024-01-15T19:00:00',
    });
    const bands = computeSessionBandsFromSessions([s], []);
    const [pill] = computeSessionPills(bands, [s], wideView, SIZE);
    expect(pill.label).not.toBeNull();
    expect(typeof pill.label).toBe('string');
  });

  it('sets rightFlat on first pill and leftFlat on second when they share an endpoint', () => {
    const s1 = makeSession({ id: 's1', inGameStart: REF_DATE, inGameEnd: '4726-05-06' });
    const s2 = makeSession({ id: 's2', inGameStart: '4726-05-06', inGameEnd: '4726-05-08' });
    const bands = computeSessionBandsFromSessions([s1, s2], []);
    const pills = computeSessionPills(bands, [s1, s2], VIEW, SIZE);
    const p1 = pills.find((p) => p.sessionId === 's1')!;
    const p2 = pills.find((p) => p.sessionId === 's2')!;
    expect(p1.rightFlat).toBe(true);
    expect(p2.leftFlat).toBe(true);
  });

  it('sets leftFlat=false and rightFlat=false for a standalone session', () => {
    const s = makeSession({ id: 's1', inGameStart: REF_DATE, inGameEnd: '4726-05-06' });
    const bands = computeSessionBandsFromSessions([s], []);
    const [pill] = computeSessionPills(bands, [s], VIEW, SIZE);
    expect(pill.leftFlat).toBe(false);
    expect(pill.rightFlat).toBe(false);
  });

  it('does not set flat flags when sessions have a gap between them', () => {
    const s1 = makeSession({ id: 's1', inGameStart: REF_DATE, inGameEnd: '4726-05-05' });
    const s2 = makeSession({ id: 's2', inGameStart: '4726-05-06', inGameEnd: '4726-05-08' });
    const bands = computeSessionBandsFromSessions([s1, s2], []);
    const pills = computeSessionPills(bands, [s1, s2], VIEW, SIZE);
    expect(pills.find((p) => p.sessionId === 's1')!.rightFlat).toBe(false);
    expect(pills.find((p) => p.sessionId === 's2')!.leftFlat).toBe(false);
  });

  it('uses the session color from the sessions array over the band color', () => {
    const s = makeSession({
      id: 's1',
      color: '#deadbe',
      inGameStart: REF_DATE,
      inGameEnd: '4726-05-06',
    });
    const bands = computeSessionBandsFromSessions([s], []);
    bands[0].color = '#000000'; // mutate band color — should not win
    const [pill] = computeSessionPills(bands, [s], VIEW, SIZE);
    expect(pill.color).toBe('#deadbe');
  });
});

// ---- computeTooltipPosition ----

describe('computeTooltipPosition', () => {
  it('returns pill.left as-is when it fits in the viewport', () => {
    const pos = computeTooltipPosition({ left: 100, top: 400 }, 1200, 600);
    expect(pos.left).toBe(100);
  });

  it('clamps left so tooltip does not overflow viewport right edge', () => {
    // pill at x=1150, viewport=1200: 1150+360 > 1200-8, so left = 1200-360-8 = 832
    const pos = computeTooltipPosition({ left: 1150, top: 400 }, 1200, 600);
    expect(pos.left).toBe(1200 - 360 - 8);
  });

  it('clamps left to 8 when pill is near the left edge', () => {
    const pos = computeTooltipPosition({ left: 4, top: 400 }, 1200, 600);
    expect(pos.left).toBe(8);
  });

  it('places tooltip bottom edge 6px above pill top', () => {
    // bottom = viewportHeight - pillRect.top + 6 → bottom edge at pillTop - 6
    const pos = computeTooltipPosition({ left: 100, top: 400 }, 1200, 600);
    expect(pos.bottom).toBe(600 - 400 + 6);
  });
});

// ---- formatRealRange ----

describe('formatRealRange', () => {
  it('formats a real-world date range with day, month, year and times', () => {
    // 2024-01-15 is a Monday
    const result = formatRealRange('2024-01-15T19:00:00', '2024-01-15T23:00:00');
    expect(result).toContain('Jan');
    expect(result).toContain('15');
    expect(result).toContain('2024');
    expect(result).toContain('7:00pm');
    expect(result).toContain('11:00pm');
  });

  it('returns a fallback string for invalid dates', () => {
    const result = formatRealRange('not-a-date', 'also-invalid');
    expect(result).toBe('not-a-date – also-invalid');
  });

  it('handles midnight (12:00am) correctly', () => {
    const result = formatRealRange('2024-06-01T00:00:00', '2024-06-01T01:00:00');
    expect(result).toContain('12:00am');
    expect(result).toContain('1:00am');
  });

  it('handles noon (12:00pm) correctly', () => {
    const result = formatRealRange('2024-06-01T12:00:00', '2024-06-01T13:00:00');
    expect(result).toContain('12:00pm');
    expect(result).toContain('1:00pm');
  });
});

// ---- formatGameRange ----

describe('formatGameRange', () => {
  it('formats a game-time range as two compact Golarian dates', () => {
    const result = formatGameRange('4726-05-04', '4726-05-06');
    expect(result).toContain('Desnus');
    expect(result).toContain(' – ');
  });

  it('appends "(instant)" when start equals end', () => {
    const result = formatGameRange('4726-05-04', '4726-05-04');
    expect(result).toContain('(instant)');
  });

  it('returns fallback for an unparseable date', () => {
    const result = formatGameRange('bad-date', '4726-05-06');
    expect(result).toBe('bad-date');
  });
});
