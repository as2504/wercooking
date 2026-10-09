import { describe, expect, it } from 'vitest';
import type { Subscription } from '@/types/models';
import { DEFAULT_WINDOWS } from '@/lib/cutoff';
import {
  buildPlanDays, cancelPlan, canModifyDay, daysDueForOrder, earliestStartDate, pausePlan, resumePlan, skipDate, unskipDate,
} from '@/lib/subscription';
import { istAt } from '@/lib/time';

const W = DEFAULT_WINDOWS;
const FRI = '2026-10-09';

function plan(meal: Subscription['meal'] = 'lunch', start = '2026-10-10', length: Subscription['plan'] = 'weekly'): Subscription {
  const pricePerDay = meal === 'combo' ? 190 : 100;
  return {
    id: 's1', userId: 'u1', customerName: 'Test', plan: length, meal, pricePerDay, serviceDays: 6, amount: pricePerDay * 6,
    startDate: start, slots: {}, days: buildPlanDays(length, meal, start), status: 'active', paymentId: 'p1', createdAt: 0, creditedBack: 0,
  };
}

describe('plan calendar', () => {
  it('weekly = 6 service days, skipping Sunday', () => {
    expect(buildPlanDays('weekly', 'lunch', '2026-10-10').map((d) => d.date)).toEqual([
      '2026-10-10', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16',
    ]);
  });
  it('monthly = 26 days, combo has two meals per day', () => {
    expect(buildPlanDays('monthly', 'lunch', '2026-10-12')).toHaveLength(26);
    expect(buildPlanDays('weekly', 'combo', '2026-10-12')).toHaveLength(12);
  });
  it('earliest start respects every meal’s cutoff', () => {
    expect(earliestStartDate('lunch', istAt(FRI, '08:00'), W)).toBe(FRI);
    expect(earliestStartDate('combo', istAt(FRI, '10:00'), W)).toBe('2026-10-10');
  });
});

describe('skip', () => {
  it('credits the per-meal value and marks the day skipped', () => {
    const r = skipDate(plan(), '2026-10-12', istAt(FRI, '12:00'), W);
    expect(r.error).toBeUndefined();
    expect(r.credit).toBe(100);
    expect(r.sub.days.find((d) => d.date === '2026-10-12')!.state).toBe('skipped');
  });
  it('a combo day credits both meals (half the day price each)', () => {
    expect(skipDate(plan('combo'), '2026-10-12', istAt(FRI, '12:00'), W).credit).toBe(190);
  });
  it('is refused after the cutoff', () => {
    const r = skipDate(plan(), '2026-10-10', istAt('2026-10-10', '09:00'), W);
    expect(r.error).toMatch(/Cutoff has passed/);
    expect(r.credit).toBe(0);
  });
  it('can be undone before cutoff, taking the credit back', () => {
    const t = istAt(FRI, '12:00');
    const skipped = skipDate(plan(), '2026-10-12', t, W).sub;
    const r = unskipDate(skipped, '2026-10-12', t, W);
    expect(r.credit).toBe(-100);
    expect(r.sub.creditedBack).toBe(0);
  });
});

describe('pause / resume / cancel', () => {
  it('pause holds modifiable days; resume reschedules them from the next open date', () => {
    const paused = pausePlan(plan(), istAt(FRI, '12:00'), W).sub;
    expect(paused.status).toBe('paused');
    expect(paused.days.every((d) => d.state === 'paused')).toBe(true);
    // Resume on Monday after lunch cutoff: first new day is Tuesday.
    const resumed = resumePlan(paused, istAt('2026-10-12', '10:00'), W).sub;
    expect(resumed.status).toBe('active');
    expect(resumed.days).toHaveLength(6);
    expect(resumed.days[0].date).toBe('2026-10-13');
    expect(resumed.days.at(-1)!.date).toBe('2026-10-19');
  });
  it('cancel refunds only meals still before cutoff', () => {
    // Saturday 10 AM: Saturday lunch is locked, 5 meals remain refundable.
    const r = cancelPlan(plan(), istAt('2026-10-10', '10:00'), W);
    expect(r.sub.status).toBe('cancelled');
    expect(r.credit).toBe(500);
    expect(r.sub.days[0].state).toBe('upcoming');
  });
  it('locked days become kitchen orders at cutoff, but never for paused plans', () => {
    const t = istAt('2026-10-10', '09:00');
    expect(daysDueForOrder(plan(), t, W).map((d) => d.date)).toEqual(['2026-10-10']);
    expect(daysDueForOrder({ ...plan(), status: 'paused' }, t, W)).toEqual([]);
    expect(canModifyDay(plan().days[0], t, W)).toBe(false);
  });
});
