// Subscription rules (pure). All mutations return new objects; the api layer persists them
// and applies wallet credits.
import type { ISODate, MealType, Millis, PlanLength, PlanMeal, SubDay, Subscription } from '@/types/models';
import { cutoffAt, isServiceDay, nextOrderableDate, type Windows } from './cutoff';
import { PLAN_DAYS } from './pricing';
import { addDays } from './time';

export function mealsOf(meal: PlanMeal): MealType[] {
  return meal === 'combo' ? ['lunch', 'dinner'] : [meal];
}

/** Value of a single meal in the plan (a combo day covers two meals). */
export function perMealValue(sub: Pick<Subscription, 'meal' | 'pricePerDay'>): number {
  return sub.meal === 'combo' ? sub.pricePerDay / 2 : sub.pricePerDay;
}

/** Earliest date a new plan can start: every meal in it must still be before cutoff. */
export function earliestStartDate(meal: PlanMeal, nowMs: Millis, windows: Windows): ISODate {
  const dates = mealsOf(meal).map((m) => nextOrderableDate(m, nowMs, windows));
  return dates.sort().at(-1)!;
}

/** `count` service dates (Mon–Sat) starting at `start`, skipping any in `exclude`. */
export function serviceDates(start: ISODate, count: number, exclude: Set<ISODate> = new Set()): ISODate[] {
  const out: ISODate[] = [];
  let d = start;
  while (out.length < count) {
    if (isServiceDay(d) && !exclude.has(d)) out.push(d);
    d = addDays(d, 1);
  }
  return out;
}

export function buildPlanDays(plan: PlanLength, meal: PlanMeal, start: ISODate): SubDay[] {
  return serviceDates(start, PLAN_DAYS[plan]).flatMap((date) =>
    mealsOf(meal).map((m) => ({ date, meal: m, state: 'upcoming' as const })),
  );
}

/** A day can be skipped / paused / cancelled only while upcoming and before its cutoff. */
export function canModifyDay(day: SubDay, nowMs: Millis, windows: Windows): boolean {
  return day.state === 'upcoming' && nowMs < cutoffAt(day.meal, day.date, windows);
}

export interface RuleResult {
  sub: Subscription;
  /** Amount to credit back to the wallet. */
  credit: number;
  changed: number;
  error?: string;
}

/** Skip all meals of a plan on a given date. Skipped meals roll over to wallet credit. */
export function skipDate(sub: Subscription, date: ISODate, nowMs: Millis, windows: Windows): RuleResult {
  if (sub.status !== 'active') return { sub, credit: 0, changed: 0, error: 'Only active plans can skip a day.' };
  const targets = sub.days.filter((d) => d.date === date);
  if (targets.length === 0) return { sub, credit: 0, changed: 0, error: 'That date is not part of your plan.' };
  if (!targets.some((d) => canModifyDay(d, nowMs, windows)))
    return { sub, credit: 0, changed: 0, error: 'Cutoff has passed for this day, so it can no longer be skipped.' };
  let changed = 0;
  const days = sub.days.map((d) => {
    if (d.date === date && canModifyDay(d, nowMs, windows)) {
      changed++;
      return { ...d, state: 'skipped' as const };
    }
    return d;
  });
  const credit = changed * perMealValue(sub);
  return { sub: { ...sub, days, creditedBack: sub.creditedBack + credit }, credit, changed };
}

/** Undo a skip (only before cutoff). Takes the credit back from the wallet. */
export function unskipDate(sub: Subscription, date: ISODate, nowMs: Millis, windows: Windows): RuleResult {
  let changed = 0;
  const days = sub.days.map((d) => {
    if (d.date === date && d.state === 'skipped' && nowMs < cutoffAt(d.meal, d.date, windows)) {
      changed++;
      return { ...d, state: 'upcoming' as const };
    }
    return d;
  });
  if (!changed) return { sub, credit: 0, changed: 0, error: 'This day can no longer be restored.' };
  const credit = -changed * perMealValue(sub);
  return { sub: { ...sub, days, creditedBack: sub.creditedBack + credit }, credit, changed };
}

/** Pause: all modifiable upcoming meals become "paused" (they are kept, not credited). */
export function pausePlan(sub: Subscription, nowMs: Millis, windows: Windows): RuleResult {
  if (sub.status !== 'active') return { sub, credit: 0, changed: 0, error: 'Only active plans can be paused.' };
  let changed = 0;
  const days = sub.days.map((d) => {
    if (canModifyDay(d, nowMs, windows)) {
      changed++;
      return { ...d, state: 'paused' as const };
    }
    return d;
  });
  if (!changed) return { sub, credit: 0, changed: 0, error: 'No upcoming meals left to pause.' };
  return { sub: { ...sub, days, status: 'paused', pausedAt: nowMs }, credit: 0, changed };
}

/** Resume: paused meals are rescheduled onto the next available service dates. */
export function resumePlan(sub: Subscription, nowMs: Millis, windows: Windows): RuleResult {
  if (sub.status !== 'paused') return { sub, credit: 0, changed: 0, error: 'This plan is not paused.' };
  const kept = sub.days.filter((d) => d.state !== 'paused');
  const pausedDates = [...new Set(sub.days.filter((d) => d.state === 'paused').map((d) => d.date))];
  const used = new Set(kept.map((d) => d.date));
  const start = earliestStartDate(sub.meal, nowMs, windows);
  const newDates = serviceDates(start, pausedDates.length, used);
  const rescheduled = newDates.flatMap((date) =>
    mealsOf(sub.meal).map((m) => ({ date, meal: m, state: 'upcoming' as const })),
  );
  const days = [...kept, ...rescheduled].sort((a, b) => a.date.localeCompare(b.date) || a.meal.localeCompare(b.meal));
  return {
    sub: { ...sub, days, status: 'active', pausedAt: undefined },
    credit: 0,
    changed: rescheduled.length,
  };
}

/** Cancel: every meal still modifiable (upcoming before cutoff, or paused) is refunded to wallet. */
export function cancelPlan(sub: Subscription, nowMs: Millis, windows: Windows): RuleResult {
  if (sub.status !== 'active' && sub.status !== 'paused')
    return { sub, credit: 0, changed: 0, error: 'This plan cannot be cancelled.' };
  let changed = 0;
  const days = sub.days.map((d) => {
    if (d.state === 'paused' || canModifyDay(d, nowMs, windows)) {
      changed++;
      return { ...d, state: 'cancelled' as const };
    }
    return d;
  });
  const credit = changed * perMealValue(sub);
  return {
    sub: { ...sub, days, status: 'cancelled', cancelledAt: nowMs, creditedBack: sub.creditedBack + credit },
    credit,
    changed,
  };
}

/** Upcoming days whose cutoff has passed: the kitchen must now cook them (an order gets created). */
export function daysDueForOrder(sub: Subscription, nowMs: Millis, windows: Windows): SubDay[] {
  if (sub.status !== 'active') return [];
  return sub.days.filter((d) => d.state === 'upcoming' && nowMs >= cutoffAt(d.meal, d.date, windows));
}

/** A plan is completed when nothing is left to cook or pick up. */
export function isPlanFinished(sub: Subscription): boolean {
  return sub.days.every((d) => d.state !== 'upcoming' && d.state !== 'ordered' && d.state !== 'paused');
}

export function planSummary(sub: Subscription) {
  const count = (s: SubDay['state']) => sub.days.filter((d) => d.state === s).length;
  return {
    total: sub.days.length,
    delivered: count('delivered'),
    skipped: count('skipped'),
    upcoming: count('upcoming') + count('ordered'),
    paused: count('paused'),
    cancelled: count('cancelled'),
    missed: count('missed'),
  };
}
