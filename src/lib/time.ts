// IST helpers. India has no DST, so IST is always UTC+05:30. We do date math on
// "shifted" timestamps (UTC + 5.5h) and read them with UTC getters, which keeps
// results identical regardless of the device's own timezone.
import type { ISODate, Millis } from '@/types/models';

export const IST_OFFSET_MS = 330 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

export interface ISTParts {
  year: number;
  month: number; // 1-12
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** 0 = Sunday */
  weekday: number;
}

export function istParts(ms: Millis): ISTParts {
  const d = new Date(ms + IST_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hours: d.getUTCHours(),
    minutes: d.getUTCMinutes(),
    seconds: d.getUTCSeconds(),
    weekday: d.getUTCDay(),
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

export function istDate(ms: Millis): ISODate {
  const p = istParts(ms);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Epoch ms for a wall-clock time in IST on the given date. */
export function istAt(date: ISODate, time = '00:00'): Millis {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return Date.UTC(y, m - 1, d, hh, mm) - IST_OFFSET_MS;
}

export function addDays(date: ISODate, n: number): ISODate {
  return istDate(istAt(date, '12:00') + n * DAY_MS);
}

export function weekdayOf(date: ISODate): number {
  return istParts(istAt(date, '12:00')).weekday;
}

/** Days from a to b (b - a). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((istAt(b, '12:00') - istAt(a, '12:00')) / DAY_MS);
}

export function isSunday(date: ISODate): boolean {
  return weekdayOf(date) === 0;
}

/** Minutes since midnight for "HH:MM". */
export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function fromMinutes(min: number): string {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}

/** Monday of the week containing date. */
export function startOfWeek(date: ISODate): ISODate {
  const wd = weekdayOf(date);
  return addDays(date, wd === 0 ? -6 : 1 - wd);
}
