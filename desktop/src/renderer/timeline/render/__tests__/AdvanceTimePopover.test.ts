import { describe, it, expect } from 'vitest';
import {
  parseISOString,
  toISOString,
  toAbsoluteSeconds,
  fromAbsoluteSeconds,
} from '../../calendar/golarian';
import { formatExpanded } from '../../calendar/format';
import { parseRelativeDelta } from '../AdvanceTimePopover';

const BASE_ISO = '4726-05-04T12:00:00';
const BASE_SECS = toAbsoluteSeconds(parseISOString(BASE_ISO));

function applyDelta(baseSeconds: number, delta: number): string {
  return toISOString(fromAbsoluteSeconds(baseSeconds + delta));
}

describe('AdvanceTimePopover — quick delta buttons', () => {
  it('+1 min advances by 60 seconds', () => {
    const result = applyDelta(BASE_SECS, 60);
    const parsed = parseISOString(result);
    expect(parsed.hour).toBe(12);
    expect(parsed.minute).toBe(1);
  });

  it('+10 min advances by 600 seconds', () => {
    const result = applyDelta(BASE_SECS, 600);
    expect(parseISOString(result).minute).toBe(10);
  });

  it('+1 hour advances by 3600 seconds', () => {
    const result = applyDelta(BASE_SECS, 3600);
    expect(parseISOString(result).hour).toBe(13);
  });

  it('+1 day advances to the next calendar day', () => {
    const result = applyDelta(BASE_SECS, 86400);
    const parsed = parseISOString(result);
    expect(parsed.day).toBe(5);
    expect(parsed.month).toBe(5);
  });

  it('+1 week advances by 7 days', () => {
    const result = applyDelta(BASE_SECS, 7 * 86400);
    expect(parseISOString(result).day).toBe(11);
  });

  it('applying the same delta twice accumulates (each click adds more)', () => {
    const after1 = toAbsoluteSeconds(parseISOString(applyDelta(BASE_SECS, 86400)));
    const after2 = toAbsoluteSeconds(parseISOString(applyDelta(after1, 86400)));
    expect(parseISOString(toISOString(fromAbsoluteSeconds(after2))).day).toBe(6);
  });

  it('delta crossing a month boundary rolls over correctly', () => {
    const endOfMonth = toAbsoluteSeconds(parseISOString('4726-05-31T12:00:00'));
    const result = applyDelta(endOfMonth, 86400);
    const parsed = parseISOString(result);
    expect(parsed.day).toBe(1);
    expect(parsed.month).toBe(6);
  });
});

describe('parseRelativeDelta', () => {
  it('parses +1h as 3600 seconds', () => {
    expect(parseRelativeDelta('+1h')).toBe(3600);
  });

  it('parses +6h as 21600 seconds', () => {
    expect(parseRelativeDelta('+6h')).toBe(6 * 3600);
  });

  it('parses +1d as 86400 seconds', () => {
    expect(parseRelativeDelta('+1d')).toBe(86400);
  });

  it('parses +1w as 7 days', () => {
    expect(parseRelativeDelta('+1w')).toBe(7 * 86400);
  });

  it('parses +30m as 1800 seconds', () => {
    expect(parseRelativeDelta('+30m')).toBe(1800);
  });

  it('is case-insensitive for the unit', () => {
    expect(parseRelativeDelta('+2H')).toBe(2 * 3600);
    expect(parseRelativeDelta('+3D')).toBe(3 * 86400);
  });

  it('tolerates whitespace inside the expression', () => {
    expect(parseRelativeDelta('+ 5 h')).toBe(5 * 3600);
  });

  it('returns null for an absolute ISO string', () => {
    expect(parseRelativeDelta('4726-05-04T09:30')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(parseRelativeDelta('')).toBeNull();
  });

  it('returns null for garbage input', () => {
    expect(parseRelativeDelta('banana')).toBeNull();
    expect(parseRelativeDelta('+h')).toBeNull();
    expect(parseRelativeDelta('+1')).toBeNull();
  });
});

describe('AdvanceTimePopover — direct ISO input parsing', () => {
  it('parses a full ISO datetime string', () => {
    const parsed = parseISOString('4726-06-15T09:30:00');
    expect(parsed.year).toBe(4726);
    expect(parsed.hour).toBe(9);
    expect(parsed.minute).toBe(30);
  });

  it('parses a date-only string (time defaults to 00:00:00)', () => {
    const parsed = parseISOString('4726-06-15');
    expect(parsed.hour).toBe(0);
    expect(parsed.minute).toBe(0);
  });

  it('throws on invalid input', () => {
    expect(() => parseISOString('not-a-date')).toThrow();
  });

  it('round-trips: toISOString ∘ parseISOString is stable', () => {
    const iso = toISOString(parseISOString(BASE_ISO));
    expect(toISOString(parseISOString(iso))).toBe(iso);
  });
});

describe('AdvanceTimePopover — display formatting', () => {
  it('includes year, month name and time in expanded format', () => {
    const formatted = formatExpanded(fromAbsoluteSeconds(BASE_SECS));
    expect(formatted).toContain('4726');
    expect(formatted).toContain('Desnus');
    expect(formatted).toContain('12:00');
  });

  it('omits time when hour is midnight', () => {
    const midnight = toAbsoluteSeconds(parseISOString('4726-05-04'));
    expect(formatExpanded(fromAbsoluteSeconds(midnight))).not.toContain(':');
  });
});
