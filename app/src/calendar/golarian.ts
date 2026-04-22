/** Golarian calendar — month lengths match Gregorian, same leap rule, seven-day week. */

export interface GolarianDate {
  year: number;
  month: number;   // 1–12
  day: number;     // 1–31
  hour: number;    // 0–23
  minute: number;  // 0–59
  second: number;  // 0–59
}

export const MONTHS = [
  { index: 1,  name: 'Abadius',   days: 31 },
  { index: 2,  name: 'Calistril', days: 28 },
  { index: 3,  name: 'Pharast',   days: 31 },
  { index: 4,  name: 'Gozran',    days: 30 },
  { index: 5,  name: 'Desnus',    days: 31 },
  { index: 6,  name: 'Sarenith',  days: 30 },
  { index: 7,  name: 'Erastus',   days: 31 },
  { index: 8,  name: 'Arodus',    days: 31 },
  { index: 9,  name: 'Rova',      days: 30 },
  { index: 10, name: 'Lamashan',  days: 31 },
  { index: 11, name: 'Neth',      days: 30 },
  { index: 12, name: 'Kuthona',   days: 31 },
] as const;

export const WEEKDAYS = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
] as const;

export type Weekday = typeof WEEKDAYS[number];

// Anchor: 4726-05-04 is Wednesday (index 2)
const ANCHOR_YEAR = 4726;
const ANCHOR_MONTH = 5;
const ANCHOR_DAY = 4;
const ANCHOR_WEEKDAY_INDEX = 2; // Wednesday

export function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

export function daysInMonth(year: number, month: number): number {
  if (month < 1 || month > 12) throw new RangeError(`Invalid month: ${month}`);
  if (month === 2 && isLeap(year)) return 29;
  return MONTHS[month - 1].days;
}

export function daysInYear(year: number): number {
  return isLeap(year) ? 366 : 365;
}

export function monthName(month: number): string {
  if (month < 1 || month > 12) throw new RangeError(`Invalid month: ${month}`);
  return MONTHS[month - 1].name;
}

/**
 * Total days from epoch (year 0, Abadius 1) to the start of `date.day`.
 * i.e. epoch day 0 = 0000-01-01.
 */
export function toAbsoluteDays(date: Pick<GolarianDate, 'year' | 'month' | 'day'>): number {
  let days = 0;

  // Complete years
  // For large year ranges, compute using 400-year cycles for efficiency.
  const y = date.year;
  const fullCycles = Math.floor(y / 400);
  days += fullCycles * 146097; // 400 years = 97 leaps = 400*365 + 97
  for (let yr = fullCycles * 400; yr < y; yr++) {
    days += daysInYear(yr);
  }

  // Complete months in the target year
  for (let m = 1; m < date.month; m++) {
    days += daysInMonth(y, m);
  }

  // Days within the month (1-based, so day 1 = 0 additional days)
  days += date.day - 1;

  return days;
}

export function fromAbsoluteDays(totalDays: number): GolarianDate {
  let remaining = totalDays;

  // Estimate year using 400-year cycles
  let year = Math.floor(remaining / 146097) * 400;
  remaining -= Math.floor(year / 400) * 146097;

  while (remaining >= daysInYear(year)) {
    remaining -= daysInYear(year);
    year++;
  }

  let month = 1;
  while (month <= 12 && remaining >= daysInMonth(year, month)) {
    remaining -= daysInMonth(year, month);
    month++;
  }

  return { year, month, day: remaining + 1, hour: 0, minute: 0, second: 0 };
}

export function weekday(date: Pick<GolarianDate, 'year' | 'month' | 'day'>): Weekday {
  const anchorDays = toAbsoluteDays({ year: ANCHOR_YEAR, month: ANCHOR_MONTH, day: ANCHOR_DAY });
  const targetDays = toAbsoluteDays(date);
  const diff = targetDays - anchorDays;
  // JavaScript % can return negative, so normalise
  const mod = ((diff % 7) + 7) % 7;
  return WEEKDAYS[(ANCHOR_WEEKDAY_INDEX + mod) % 7];
}

export function weekdayIndex(date: Pick<GolarianDate, 'year' | 'month' | 'day'>): number {
  return WEEKDAYS.indexOf(weekday(date));
}

export function validateDate(date: Pick<GolarianDate, 'year' | 'month' | 'day'>): void {
  if (date.month < 1 || date.month > 12) {
    throw new RangeError(`Invalid month: ${date.month}`);
  }
  const maxDay = daysInMonth(date.year, date.month);
  if (date.day < 1 || date.day > maxDay) {
    throw new RangeError(`Invalid day ${date.day} for ${monthName(date.month)} ${date.year} (max ${maxDay})`);
  }
}

/**
 * Parse ISO-style string: YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS (with optional MM:SS).
 */
export function parseISOString(s: string): GolarianDate {
  const match = s.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2})(?::(\d{2})(?::(\d{2}))?)?)?$/
  );
  if (!match) throw new SyntaxError(`Cannot parse date: "${s}"`);

  const date: GolarianDate = {
    year:   parseInt(match[1], 10),
    month:  parseInt(match[2], 10),
    day:    parseInt(match[3], 10),
    hour:   match[4] ? parseInt(match[4], 10) : 0,
    minute: match[5] ? parseInt(match[5], 10) : 0,
    second: match[6] ? parseInt(match[6], 10) : 0,
  };

  validateDate(date);
  return date;
}

export function toISOString(date: GolarianDate): string {
  const y = String(date.year).padStart(4, '0');
  const m = String(date.month).padStart(2, '0');
  const d = String(date.day).padStart(2, '0');
  if (date.hour === 0 && date.minute === 0 && date.second === 0) {
    return `${y}-${m}-${d}`;
  }
  const hh = String(date.hour).padStart(2, '0');
  const mm = String(date.minute).padStart(2, '0');
  const ss = String(date.second).padStart(2, '0');
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}`;
}

/**
 * Convert a GolarianDate to absolute seconds since epoch for timeline positioning.
 */
export function toAbsoluteSeconds(date: GolarianDate): number {
  return toAbsoluteDays(date) * 86400 + date.hour * 3600 + date.minute * 60 + date.second;
}

/**
 * Whether the date string includes a time component (for all-day vs point event rendering).
 */
export function hasTime(isoString: string): boolean {
  return isoString.includes('T');
}
