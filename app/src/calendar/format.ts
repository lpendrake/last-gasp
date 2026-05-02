import { type GolarianDate, monthName, weekday } from './golarian.ts';

function ordinal(day: number): string {
  if (day >= 11 && day <= 13) return `${day}th`;
  switch (day % 10) {
    case 1: return `${day}st`;
    case 2: return `${day}nd`;
    case 3: return `${day}rd`;
    default: return `${day}th`;
  }
}

/** "Wednesday, 4th of Desnus, 4726 AR — 18:30" */
export function formatExpanded(date: GolarianDate): string {
  const wd = weekday(date);
  const mn = monthName(date.month);
  let s = `${wd}, ${ordinal(date.day)} of ${mn}, ${date.year} AR`;
  if (date.hour !== 0 || date.minute !== 0 || date.second !== 0) {
    const hh = String(date.hour).padStart(2, '0');
    const mm = String(date.minute).padStart(2, '0');
    s += ` — ${hh}:${mm}`;
  }
  return s;
}

/** "Wed 4 Desnus 4726" */
export function formatCompact(date: GolarianDate): string {
  const wd = weekday(date).slice(0, 3);
  return `${wd} ${date.day} ${monthName(date.month)} ${date.year}`;
}

/** "Wed 4 Desnus 4726" or "Wed 4 Desnus 4726 — 18:30" when time is set */
export function formatCompactWithTime(date: GolarianDate): string {
  const base = formatCompact(date);
  if (date.hour !== 0 || date.minute !== 0 || date.second !== 0) {
    const hh = String(date.hour).padStart(2, '0');
    const mm = String(date.minute).padStart(2, '0');
    return `${base} — ${hh}:${mm}`;
  }
  return base;
}

/** "4726, Desnus, 4th (Wed)" or "4726, Desnus, 4th (Wed), 01:30" when time is set */
export function formatCardFace(date: GolarianDate): string {
  const mn = monthName(date.month);
  const wd = weekday(date).slice(0, 3);
  let s = `${date.year}, ${mn}, ${ordinal(date.day)} (${wd})`;
  if (date.hour !== 0 || date.minute !== 0 || date.second !== 0) {
    const hh = String(date.hour).padStart(2, '0');
    const mm = String(date.minute).padStart(2, '0');
    s += `, ${hh}:${mm}`;
  }
  return s;
}

/** "Wed 4 Desnus" — axis major tick */
export function formatAxisDay(date: GolarianDate): string {
  return `${weekday(date).slice(0, 3)} ${date.day} ${monthName(date.month)}`;
}

/** "09:00" — axis minor tick */
export function formatAxisHour(date: GolarianDate): string {
  return `${String(date.hour).padStart(2, '0')}:${String(date.minute).padStart(2, '0')}`;
}

/** "Desnus 4th, Wednesday, 4726 AR" — floating header (day) */
export function formatFloatingDay(date: GolarianDate): string {
  const wd = weekday(date);
  return `${monthName(date.month)} ${ordinal(date.day)}, ${wd}, ${date.year} AR`;
}

/** "Desnus 4726 AR" — floating header (month) */
export function formatFloatingMonth(date: GolarianDate): string {
  return `${monthName(date.month)} ${date.year} AR`;
}

/** Now-marker label: ["4th of Desnus", "4726 AR"] + optional "15:00" */
export function formatNowMarker(date: GolarianDate): [string, string, string | null] {
  const dayMonth = `${ordinal(date.day)} of ${monthName(date.month)}`;
  const year = `${date.year} AR`;
  const time = (date.hour !== 0 || date.minute !== 0)
    ? `${String(date.hour).padStart(2, '0')}:${String(date.minute).padStart(2, '0')}`
    : null;
  return [dayMonth, year, time];
}
