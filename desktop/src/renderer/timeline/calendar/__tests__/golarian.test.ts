import { describe, it, expect } from 'vitest';
import {
  parseISOString,
  toISOString,
  toAbsoluteSeconds,
  fromAbsoluteSeconds,
  toAbsoluteDays,
  fromAbsoluteDays,
  isLeap,
  daysInMonth,
} from '../golarian';

// ---- parseISOString ----

describe('parseISOString — standard cases', () => {
  it('parses a date-only string', () => {
    const d = parseISOString('4726-05-04');
    expect(d).toEqual({ year: 4726, month: 5, day: 4, hour: 0, minute: 0, second: 0 });
  });

  it('parses a datetime string', () => {
    const d = parseISOString('4726-05-04T09:30:00');
    expect(d).toEqual({ year: 4726, month: 5, day: 4, hour: 9, minute: 30, second: 0 });
  });

  it('parses a datetime with seconds', () => {
    const d = parseISOString('4726-05-04T09:30:45');
    expect(d).toEqual({ year: 4726, month: 5, day: 4, hour: 9, minute: 30, second: 45 });
  });

  it('accepts the .000Z suffix produced by JS Date.toISOString() on corrupt saves', () => {
    // When gray-matter without CORE_SCHEMA reads a year-0 date it converts it
    // to a JS Date; JS Date maps year 0 → 1900, so .toISOString() emits this format.
    const d = parseISOString('1900-01-02T07:00:00.000Z');
    expect(d).toEqual({ year: 1900, month: 1, day: 2, hour: 7, minute: 0, second: 0 });
  });

  it('throws on a completely invalid string', () => {
    expect(() => parseISOString('not-a-date')).toThrow(SyntaxError);
  });

  it('throws on a partial ISO string missing month/day', () => {
    expect(() => parseISOString('4726')).toThrow(SyntaxError);
  });

  it('throws on the malformed year-0 string produced by negative-seconds drag bug', () => {
    // String(-1).padStart(4,'0') === '00-1', not '0001'
    expect(() => parseISOString('00-1-12-31T-7:00:00')).toThrow(SyntaxError);
  });
});

describe('parseISOString — year 0', () => {
  it('parses year 0000 date-only', () => {
    const d = parseISOString('0000-01-01');
    expect(d).toEqual({ year: 0, month: 1, day: 1, hour: 0, minute: 0, second: 0 });
  });

  it('parses year 0000 with time', () => {
    const d = parseISOString('0000-01-02T07:00:00');
    expect(d).toEqual({ year: 0, month: 1, day: 2, hour: 7, minute: 0, second: 0 });
  });

  it('parses year 0001', () => {
    const d = parseISOString('0001-03-15');
    expect(d).toEqual({ year: 1, month: 3, day: 15, hour: 0, minute: 0, second: 0 });
  });
});

// ---- toISOString ----

describe('toISOString — standard cases', () => {
  it('produces date-only when time is midnight', () => {
    expect(toISOString({ year: 4726, month: 5, day: 4, hour: 0, minute: 0, second: 0 })).toBe(
      '4726-05-04',
    );
  });

  it('includes time when non-midnight', () => {
    expect(toISOString({ year: 4726, month: 5, day: 4, hour: 9, minute: 30, second: 0 })).toBe(
      '4726-05-04T09:30:00',
    );
  });
});

describe('toISOString — year 0 and near-zero years', () => {
  it('pads year 0 to 4 digits', () => {
    expect(toISOString({ year: 0, month: 1, day: 1, hour: 0, minute: 0, second: 0 })).toBe(
      '0000-01-01',
    );
  });

  it('pads year 1 to 4 digits', () => {
    expect(toISOString({ year: 1, month: 3, day: 15, hour: 0, minute: 0, second: 0 })).toBe(
      '0001-03-15',
    );
  });

  it('output is re-parseable by parseISOString for year 0', () => {
    const original = { year: 0, month: 1, day: 2, hour: 7, minute: 0, second: 0 };
    expect(parseISOString(toISOString(original))).toEqual(original);
  });
});

// ---- roundtrip: toAbsoluteSeconds / fromAbsoluteSeconds ----

describe('toAbsoluteSeconds / fromAbsoluteSeconds roundtrip', () => {
  it('roundtrips the anchor date (4726-05-04)', () => {
    const d = parseISOString('4726-05-04');
    expect(fromAbsoluteSeconds(toAbsoluteSeconds(d))).toEqual(d);
  });

  it('roundtrips year 0 epoch (0000-01-01)', () => {
    const d = parseISOString('0000-01-01');
    const secs = toAbsoluteSeconds(d);
    expect(secs).toBe(0);
    expect(fromAbsoluteSeconds(0)).toEqual(d);
  });

  it('roundtrips year 0 with a time component', () => {
    const d = parseISOString('0000-01-02T07:00:00');
    expect(fromAbsoluteSeconds(toAbsoluteSeconds(d))).toEqual(d);
  });

  it('roundtrips year 1', () => {
    const d = parseISOString('0001-01-01');
    expect(fromAbsoluteSeconds(toAbsoluteSeconds(d))).toEqual(d);
  });

  it('0 seconds is year 0000-01-01 midnight', () => {
    const d = fromAbsoluteSeconds(0);
    expect(d.year).toBe(0);
    expect(d.month).toBe(1);
    expect(d.day).toBe(1);
    expect(d.hour).toBe(0);
  });

  it('86399 seconds is year 0000-01-01 at 23:59:59', () => {
    const d = fromAbsoluteSeconds(86399);
    expect(d.year).toBe(0);
    expect(d.month).toBe(1);
    expect(d.day).toBe(1);
    expect(d.hour).toBe(23);
    expect(d.minute).toBe(59);
    expect(d.second).toBe(59);
  });

  it('86400 seconds is year 0000-01-02 midnight', () => {
    const d = fromAbsoluteSeconds(86400);
    expect(d.year).toBe(0);
    expect(d.month).toBe(1);
    expect(d.day).toBe(2);
    expect(d.hour).toBe(0);
  });
});

// ---- negative seconds: the drag-before-year-0 bug ----

describe('negative seconds — behaviour after drag clamp fix', () => {
  it('toISOString on fromAbsoluteSeconds(0) produces 0000-01-01 not a malformed string', () => {
    // The clamp in reschedule.ts ensures we never get negatives, but verify
    // that 0 seconds itself roundtrips cleanly.
    const s = toISOString(fromAbsoluteSeconds(0));
    expect(s).toBe('0000-01-01');
    expect(() => parseISOString(s)).not.toThrow();
  });

  it('the malformed string "00-1-12-31T-7:00:00" that negative drag produced is rejected', () => {
    // This was the actual crash string from the production bug report.
    // Verify it fails loudly rather than silently producing a wrong date.
    expect(() => parseISOString('00-1-12-31T-7:00:00')).toThrow(SyntaxError);
  });
});

// ---- year 0 YAML corruption: the gray-matter DEFAULT schema bug ----

describe('year 0 → 1900 YAML corruption (regression)', () => {
  it('parseISOString accepts the JS-Date-corrupted form "1900-01-02T07:00:00.000Z"', () => {
    // When gray-matter without CORE_SCHEMA read "0000-01-02T07:00:00" it created
    // a JS Date; Date.UTC(0,...) maps year 0 → 1900 and toISOString() appends .000Z.
    // We must parse this without throwing so existing corrupt files are still readable.
    const d = parseISOString('1900-01-02T07:00:00.000Z');
    expect(d.year).toBe(1900); // stored incorrectly but parseable; user must fix the date
    expect(d.month).toBe(1);
    expect(d.day).toBe(2);
    expect(d.hour).toBe(7);
  });
});

// ---- isLeap / daysInMonth sanity ----

describe('isLeap', () => {
  it('year 0 is a leap year (divisible by 400)', () => {
    expect(isLeap(0)).toBe(true);
  });

  it('year 4 is a leap year', () => {
    expect(isLeap(4)).toBe(true);
  });

  it('year 100 is not a leap year', () => {
    expect(isLeap(100)).toBe(false);
  });

  it('year 400 is a leap year', () => {
    expect(isLeap(400)).toBe(true);
  });
});

describe('daysInMonth — year 0 (leap year)', () => {
  it('February in year 0 has 29 days', () => {
    expect(daysInMonth(0, 2)).toBe(29);
  });

  it('January in year 0 has 31 days', () => {
    expect(daysInMonth(0, 1)).toBe(31);
  });
});

// ---- toAbsoluteDays / fromAbsoluteDays ----

describe('toAbsoluteDays / fromAbsoluteDays', () => {
  it('day 0 is 0000-01-01', () => {
    expect(toAbsoluteDays({ year: 0, month: 1, day: 1 })).toBe(0);
    expect(fromAbsoluteDays(0)).toMatchObject({ year: 0, month: 1, day: 1 });
  });

  it('day 1 is 0000-01-02', () => {
    expect(toAbsoluteDays({ year: 0, month: 1, day: 2 })).toBe(1);
    expect(fromAbsoluteDays(1)).toMatchObject({ year: 0, month: 1, day: 2 });
  });

  it('day 365 is 0001-01-01 (year 0 is a leap year, so 366 days)', () => {
    expect(toAbsoluteDays({ year: 1, month: 1, day: 1 })).toBe(366);
    expect(fromAbsoluteDays(366)).toMatchObject({ year: 1, month: 1, day: 1 });
  });

  it('day -1 is -0001-12-31 (year -1 is not a leap year, 365 days)', () => {
    expect(toAbsoluteDays({ year: -1, month: 12, day: 31 })).toBe(-1);
    expect(fromAbsoluteDays(-1)).toMatchObject({ year: -1, month: 12, day: 31 });
  });

  it('day -365 is -0001-01-01', () => {
    expect(toAbsoluteDays({ year: -1, month: 1, day: 1 })).toBe(-365);
    expect(fromAbsoluteDays(-365)).toMatchObject({ year: -1, month: 1, day: 1 });
  });
});

// ---- negative years: parseISOString / toISOString / seconds roundtrip ----

describe('negative years', () => {
  it('toISOString formats year -1 correctly', () => {
    expect(toISOString({ year: -1, month: 12, day: 31, hour: 0, minute: 0, second: 0 })).toBe(
      '-0001-12-31',
    );
  });

  it('toISOString formats year -1 with time', () => {
    expect(toISOString({ year: -1, month: 1, day: 1, hour: 23, minute: 59, second: 59 })).toBe(
      '-0001-01-01T23:59:59',
    );
  });

  it('parseISOString accepts negative year', () => {
    expect(parseISOString('-0001-12-31')).toEqual({
      year: -1,
      month: 12,
      day: 31,
      hour: 0,
      minute: 0,
      second: 0,
    });
  });

  it('parseISOString accepts negative year with time', () => {
    expect(parseISOString('-0001-01-01T23:59:59')).toEqual({
      year: -1,
      month: 1,
      day: 1,
      hour: 23,
      minute: 59,
      second: 59,
    });
  });

  it('toISOString output is re-parseable for year -1', () => {
    const original = { year: -1, month: 6, day: 15, hour: 12, minute: 0, second: 0 };
    expect(parseISOString(toISOString(original))).toEqual(original);
  });

  it('fromAbsoluteSeconds(-1) is year -1, Dec 31, 23:59:59', () => {
    const d = fromAbsoluteSeconds(-1);
    expect(d).toMatchObject({ year: -1, month: 12, day: 31, hour: 23, minute: 59, second: 59 });
  });

  it('fromAbsoluteSeconds(-86400) is year -1, Dec 31, 00:00:00', () => {
    const d = fromAbsoluteSeconds(-86400);
    expect(d).toMatchObject({ year: -1, month: 12, day: 31, hour: 0, minute: 0, second: 0 });
  });

  it('fromAbsoluteSeconds(-86401) is year -1, Dec 30, 23:59:59', () => {
    const d = fromAbsoluteSeconds(-86401);
    expect(d).toMatchObject({ year: -1, month: 12, day: 30, hour: 23, minute: 59, second: 59 });
  });

  it('toAbsoluteSeconds / fromAbsoluteSeconds roundtrip for year -1', () => {
    const d = parseISOString('-0001-06-15T12:00:00');
    expect(fromAbsoluteSeconds(toAbsoluteSeconds(d))).toEqual(d);
  });
});
