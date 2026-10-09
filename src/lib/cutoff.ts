// Cutoff and slot rules. Pure functions: pass `nowMs` from clock.now() so they are testable.
import type { ISODate, MealType, MealWindow, Millis, Slot } from '@/types/models';
import { hhmm12 } from './format';
import { addDays, fromMinutes, istAt, istDate, isSunday, toMinutes } from './time';

export type Windows = Record<MealType, MealWindow>;

export const MEALS: MealType[] = ['breakfast', 'lunch', 'dinner'];

export const DEFAULT_WINDOWS: Windows = {
  breakfast: { cutoffDayOffset: -1, cutoffTime: '21:00', slotStart: '07:30', slotEnd: '10:00', slotCapacity: 10, dailyCapacity: 40 },
  lunch: { cutoffDayOffset: 0, cutoffTime: '09:00', slotStart: '12:30', slotEnd: '14:30', slotCapacity: 10, dailyCapacity: 40 },
  dinner: { cutoffDayOffset: 0, cutoffTime: '16:00', slotStart: '19:30', slotEnd: '21:30', slotCapacity: 10, dailyCapacity: 40 },
};

/** The kitchen serves Monday to Saturday. */
export function isServiceDay(date: ISODate): boolean {
  return !isSunday(date);
}

/** Moment after which orders for (meal, date) are closed. */
export function cutoffAt(meal: MealType, date: ISODate, windows: Windows): Millis {
  const w = windows[meal];
  return istAt(addDays(date, w.cutoffDayOffset), w.cutoffTime);
}

export function isOrderable(meal: MealType, date: ISODate, nowMs: Millis, windows: Windows): boolean {
  return isServiceDay(date) && nowMs < cutoffAt(meal, date, windows);
}

/** Earliest date for which this meal can still be ordered. */
export function nextOrderableDate(meal: MealType, nowMs: Millis, windows: Windows): ISODate {
  let date = istDate(nowMs);
  for (let i = 0; i < 14; i++) {
    if (isOrderable(meal, date, nowMs, windows)) return date;
    date = addDays(date, 1);
  }
  return date;
}

/** Orderable dates for a meal within the next `days` days. */
export function orderableDates(meal: MealType, nowMs: Millis, windows: Windows, days = 7): ISODate[] {
  const out: ISODate[] = [];
  const today = istDate(nowMs);
  for (let i = 0; i <= days; i++) {
    const d = addDays(today, i);
    if (isOrderable(meal, d, nowMs, windows)) out.push(d);
  }
  return out;
}

export interface NextCutoff {
  meal: MealType;
  date: ISODate;
  cutoff: Millis;
  remainingMs: number;
}

/** The soonest still-open cutoff across all meals (drives the Home countdown). */
export function nextCutoff(nowMs: Millis, windows: Windows): NextCutoff {
  const candidates = MEALS.map((meal) => {
    const date = nextOrderableDate(meal, nowMs, windows);
    const cutoff = cutoffAt(meal, date, windows);
    return { meal, date, cutoff, remainingMs: cutoff - nowMs };
  });
  return candidates.sort((a, b) => a.cutoff - b.cutoff)[0];
}

/** 30-minute pickup slots for a meal. */
export function slotsFor(meal: MealType, windows: Windows): Slot[] {
  const w = windows[meal];
  const out: Slot[] = [];
  for (let m = toMinutes(w.slotStart); m + 30 <= toMinutes(w.slotEnd); m += 30) {
    const start = fromMinutes(m);
    const end = fromMinutes(m + 30);
    out.push({
      id: `${meal}-${start.replace(':', '')}`,
      meal,
      start,
      end,
      label: `${hhmm12(start).replace(/ (AM|PM)$/, '')} – ${hhmm12(end)}`,
    });
  }
  return out;
}

/** A slot is selectable when it has capacity; same-day slots must also start in the future. */
export function slotAvailability(
  slot: Slot,
  date: ISODate,
  booked: number,
  nowMs: Millis,
  windows: Windows,
): { left: number; open: boolean; reason?: string } {
  const left = Math.max(0, windows[slot.meal].slotCapacity - booked);
  if (istAt(date, slot.start) <= nowMs) return { left, open: false, reason: 'Time passed' };
  if (left === 0) return { left, open: false, reason: 'Full' };
  return { left, open: true };
}
