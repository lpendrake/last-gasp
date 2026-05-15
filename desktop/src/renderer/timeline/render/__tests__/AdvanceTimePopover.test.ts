import { describe, it, expect } from 'vitest';
import {
  parseISOString,
  toISOString,
  toAbsoluteSeconds,
  fromAbsoluteSeconds,
} from '../../calendar/golarian';
import { formatExpanded } from '../../calendar/format';

// Tests for the pure logic used by AdvanceTimePopover:
// delta application, direct-input parsing, and display formatting.

const BASE_ISO = '4726-05-04T12:00:00';
const BASE_SECS = toAbsoluteSeconds(parseISOString(BASE_ISO));

function applyDelta(baseSeconds: number, delta: number): string {
  return toISOString(fromAbsoluteSeconds(baseSeconds + delta));
}

describe('AdvanceTimePopover — delta application', () => {
  it('+1 hour advances by 3600 seconds', () => {
    const result = applyDelta(BASE_SECS, 3600);
    const parsed = parseISOString(result);
    expect(parsed.hour).toBe(13);
    expect(parsed.minute).toBe(0);
  });

  it('+6 hours advances by 6 hours', () => {
    const result = applyDelta(BASE_SECS, 6 * 3600);
    const parsed = parseISOString(result);
    expect(parsed.hour).toBe(18);
  });

  it('+1 day advances to the next calendar day', () => {
    const result = applyDelta(BASE_SECS, 86400);
    const parsed = parseISOString(result);
    expect(parsed.day).toBe(5);
    expect(parsed.month).toBe(5);
  });

  it('+1 week advances by 7 days', () => {
    const result = applyDelta(BASE_SECS, 7 * 86400);
    const parsed = parseISOString(result);
    expect(parsed.day).toBe(11);
    expect(parsed.month).toBe(5);
  });

  it('advances that cross a month boundary roll over correctly', () => {
    const endOfMonth = toAbsoluteSeconds(parseISOString('4726-05-31T12:00:00'));
    const result = applyDelta(endOfMonth, 86400);
    const parsed = parseISOString(result);
    expect(parsed.day).toBe(1);
    expect(parsed.month).toBe(6);
  });
});

describe('AdvanceTimePopover — direct input parsing', () => {
  it('parses a full ISO datetime string', () => {
    const parsed = parseISOString('4726-06-15T09:30:00');
    expect(parsed.year).toBe(4726);
    expect(parsed.month).toBe(6);
    expect(parsed.day).toBe(15);
    expect(parsed.hour).toBe(9);
    expect(parsed.minute).toBe(30);
  });

  it('parses a date-only ISO string (time defaults to 00:00:00)', () => {
    const parsed = parseISOString('4726-06-15');
    expect(parsed.hour).toBe(0);
    expect(parsed.minute).toBe(0);
  });

  it('throws on invalid input', () => {
    expect(() => parseISOString('not-a-date')).toThrow();
  });

  it('round-trips: toISOString ∘ parseISOString ∘ toISOString is stable', () => {
    const iso = toISOString(parseISOString(BASE_ISO));
    expect(toISOString(parseISOString(iso))).toBe(iso);
  });
});

describe('AdvanceTimePopover — display formatting', () => {
  it('formats a pending date for the current-time display', () => {
    const formatted = formatExpanded(fromAbsoluteSeconds(BASE_SECS));
    expect(formatted).toContain('4726');
    expect(formatted).toContain('Desnus');
    // time portion included since hour ≠ 0
    expect(formatted).toContain('12:00');
  });

  it('omits time portion when hour is midnight', () => {
    const midnight = toAbsoluteSeconds(parseISOString('4726-05-04'));
    const formatted = formatExpanded(fromAbsoluteSeconds(midnight));
    expect(formatted).not.toContain(':');
  });
});
