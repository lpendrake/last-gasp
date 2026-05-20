import { describe, it, expect } from 'vitest';
import {
  isLeap, weekday, parseISOString, toISOString,
  toAbsoluteDays, fromAbsoluteDays, toAbsoluteSeconds, fromAbsoluteSeconds, validateDate,
} from './golarian.ts';
import { formatExpanded, formatCompact, formatAxisDay, formatFloatingDay } from './format.ts';

describe('isLeap', () => {
  it('4728 is leap (divisible by 4, not a century)', () => {
    expect(isLeap(4728)).toBe(true);
  });
  it('4700 is NOT leap (divisible by 100, not 400)', () => {
    expect(isLeap(4700)).toBe(false);
  });
  it('4800 is leap (divisible by 400)', () => {
    expect(isLeap(4800)).toBe(true);
  });
  it('4900 is NOT leap (divisible by 100, not 400)', () => {
    expect(isLeap(4900)).toBe(false);
  });
  it('4726 is not leap', () => {
    expect(isLeap(4726)).toBe(false);
  });
});

describe('weekday — anchor dates from §5.8', () => {
  it('4726-05-04 is Wednesday (anchor)', () => {
    expect(weekday({ year: 4726, month: 5, day: 4 })).toBe('Wednesday');
  });
  it('4726-10-28 is Friday (177 days, mod 7 = 2)', () => {
    expect(weekday({ year: 4726, month: 10, day: 28 })).toBe('Friday');
  });
  it('4727-04-16 is Sunday (347 days, mod 7 = 4)', () => {
    expect(weekday({ year: 4727, month: 4, day: 16 })).toBe('Sunday');
  });
  it('4728-02-29 is Thursday (666 days, mod 7 = 1)', () => {
    expect(weekday({ year: 4728, month: 2, day: 29 })).toBe('Thursday');
  });
});

describe('weekday — additional edge cases', () => {
  it('year boundary: 4726-12-31 and 4727-01-01 are consecutive weekdays', () => {
    const dec31 = weekday({ year: 4726, month: 12, day: 31 });
    const jan1 = weekday({ year: 4727, month: 1, day: 1 });
    const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const idx31 = WEEKDAYS.indexOf(dec31);
    const idx1 = WEEKDAYS.indexOf(jan1);
    expect((idx31 + 1) % 7).toBe(idx1);
  });

  it('campaign start 4726-03-01 has a valid weekday', () => {
    const wd = weekday({ year: 4726, month: 3, day: 1 });
    expect(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']).toContain(wd);
  });
});

describe('leap year date validation', () => {
  it('4700-02-29 is invalid (not leap — 4700 is div by 100, not 400)', () => {
    expect(() => validateDate({ year: 4700, month: 2, day: 29 })).toThrow();
  });
  it('4800-02-29 is valid (leap)', () => {
    expect(() => validateDate({ year: 4800, month: 2, day: 29 })).not.toThrow();
  });
  it('4900-02-29 is invalid (not leap)', () => {
    expect(() => validateDate({ year: 4900, month: 2, day: 29 })).toThrow();
  });
  it('4726-02-29 is invalid (not leap)', () => {
    expect(() => validateDate({ year: 4726, month: 2, day: 29 })).toThrow();
  });
});

describe('parseISOString', () => {
  it('parses date-only', () => {
    const d = parseISOString('4726-05-04');
    expect(d).toEqual({ year: 4726, month: 5, day: 4, hour: 0, minute: 0, second: 0 });
  });
  it('parses date + hour', () => {
    const d = parseISOString('4726-05-04T18');
    expect(d.hour).toBe(18);
    expect(d.minute).toBe(0);
  });
  it('parses date + hour:minute', () => {
    const d = parseISOString('4726-05-04T18:30');
    expect(d.hour).toBe(18);
    expect(d.minute).toBe(30);
  });
  it('parses full datetime', () => {
    const d = parseISOString('4726-05-04T09:30:15');
    expect(d).toEqual({ year: 4726, month: 5, day: 4, hour: 9, minute: 30, second: 15 });
  });
  it('rejects invalid format', () => {
    expect(() => parseISOString('not-a-date')).toThrow();
  });
  it('rejects invalid date (Feb 29 non-leap)', () => {
    expect(() => parseISOString('4726-02-29')).toThrow();
  });
});

describe('toISOString', () => {
  it('date-only when no time', () => {
    expect(toISOString({ year: 4726, month: 5, day: 4, hour: 0, minute: 0, second: 0 }))
      .toBe('4726-05-04');
  });
  it('includes time when present', () => {
    expect(toISOString({ year: 4726, month: 5, day: 4, hour: 18, minute: 30, second: 0 }))
      .toBe('4726-05-04T18:30:00');
  });
});

describe('absoluteDays round-trip', () => {
  it('epoch is day 0', () => {
    expect(toAbsoluteDays({ year: 0, month: 1, day: 1 })).toBe(0);
  });
  it('round-trips through fromAbsoluteDays', () => {
    const original = { year: 4726, month: 5, day: 4 };
    const days = toAbsoluteDays(original);
    const restored = fromAbsoluteDays(days);
    expect(restored.year).toBe(4726);
    expect(restored.month).toBe(5);
    expect(restored.day).toBe(4);
  });
  it('round-trips year boundary', () => {
    const original = { year: 4727, month: 1, day: 1 };
    const days = toAbsoluteDays(original);
    const restored = fromAbsoluteDays(days);
    expect(restored.year).toBe(4727);
    expect(restored.month).toBe(1);
    expect(restored.day).toBe(1);
  });
});

describe('toAbsoluteSeconds', () => {
  it('adds time components correctly', () => {
    const dateOnly = toAbsoluteSeconds({ year: 4726, month: 5, day: 4, hour: 0, minute: 0, second: 0 });
    const withTime = toAbsoluteSeconds({ year: 4726, month: 5, day: 4, hour: 18, minute: 30, second: 0 });
    expect(withTime - dateOnly).toBe(18 * 3600 + 30 * 60);
  });
});

describe('fromAbsoluteSeconds round-trip', () => {
  it('round-trips an ISO string with time', () => {
    const iso = '4726-05-04T18:30:00';
    const parsed = parseISOString(iso);
    const secs = toAbsoluteSeconds(parsed);
    const restored = fromAbsoluteSeconds(secs);
    expect(toISOString(restored)).toBe(iso);
  });
  it('round-trips midnight (toISOString omits time at midnight)', () => {
    const parsed = parseISOString('4727-01-01T00:00:00');
    const secs = toAbsoluteSeconds(parsed);
    const restored = fromAbsoluteSeconds(secs);
    expect(restored.year).toBe(4727);
    expect(restored.month).toBe(1);
    expect(restored.day).toBe(1);
    expect(restored.hour).toBe(0);
    expect(restored.minute).toBe(0);
  });
  it('+1 day advances correctly', () => {
    const parsed = parseISOString('4726-05-04T18:30:00');
    const secs = toAbsoluteSeconds(parsed) + 86400;
    const next = fromAbsoluteSeconds(secs);
    expect(next.day).toBe(5);
    expect(next.hour).toBe(18);
    expect(next.minute).toBe(30);
  });
});

describe('format', () => {
  const date = { year: 4726, month: 5, day: 4, hour: 18, minute: 30, second: 0 };

  it('formatExpanded', () => {
    expect(formatExpanded(date)).toBe('Wednesday, 4th of Desnus, 4726 AR — 18:30');
  });
  it('formatExpanded without time', () => {
    expect(formatExpanded({ ...date, hour: 0, minute: 0 })).toBe('Wednesday, 4th of Desnus, 4726 AR');
  });
  it('formatCompact', () => {
    expect(formatCompact(date)).toBe('Wed 4 Desnus 4726');
  });
  it('formatAxisDay', () => {
    expect(formatAxisDay(date)).toBe('Wed 4 Desnus');
  });
  it('formatFloatingDay', () => {
    expect(formatFloatingDay(date)).toBe('Desnus 4th, Wednesday, 4726 AR');
  });
});
