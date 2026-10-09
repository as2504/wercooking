import type { ISODate, MealType, Order, PlanLength, PlanMeal, Subscription, User } from '@/types/models';
import { now } from '@/lib/clock';
import { cutoffAt, isServiceDay, slotsFor } from '@/lib/cutoff';
import { MEAL_LABEL, dateShort, rupees } from '@/lib/format';
import { digits, uid } from '@/lib/id';
import { orderNumber, planMealItem } from '@/lib/orders';
import { indexItems, planQuote } from '@/lib/pricing';
import {
  buildPlanDays, cancelPlan, daysDueForOrder, earliestStartDate, isPlanFinished, mealsOf, pausePlan, perMealValue, resumePlan, skipDate, unskipDate,
  type RuleResult,
} from '@/lib/subscription';
import { ApiError, latency, nextCounter, patchById, read, write } from './base';
import { pushNotification } from './notifications';
import { adjustWallet } from './wallet';

/** Unpaid plan checkouts are dropped after this long. */
export const PLAN_PAYMENT_WINDOW_MS = 30 * 60_000;

export async function listMySubscriptions(userId: string): Promise<Subscription[]> {
  await latency();
  const t = now();
  return (await read('subscriptions'))
    .filter((s) => s.userId === userId && (s.status !== 'pending_payment' || t - s.createdAt < PLAN_PAYMENT_WINDOW_MS))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function listAllSubscriptions(): Promise<Subscription[]> {
  await latency();
  return (await read('subscriptions')).filter((s) => s.status !== 'pending_payment').sort((a, b) => b.createdAt - a.createdAt);
}

export async function getSubscription(id: string): Promise<Subscription> {
  const s = (await read('subscriptions')).find((x) => x.id === id);
  if (!s) throw new ApiError('Plan not found.', 'not_found');
  return s;
}

export interface NewPlanInput {
  plan: PlanLength;
  meal: PlanMeal;
  startDate: ISODate;
  slots: Partial<Record<MealType, string>>;
}

/** Creates a plan awaiting payment. One live plan per meal (combo counts as lunch + dinner). */
export async function createSubscription(user: User, input: NewPlanInput): Promise<Subscription> {
  await latency(250, 500);
  const t = now();
  const settings = await read('settings');
  const earliest = earliestStartDate(input.meal, t, settings.windows);
  if (!isServiceDay(input.startDate)) throw new ApiError('Plans can’t start on a Sunday (kitchen holiday).');
  if (input.startDate < earliest) throw new ApiError(`The earliest start date is ${dateShort(earliest)} (cutoff has passed for earlier days).`, 'cutoff_passed');
  for (const m of mealsOf(input.meal)) {
    const slotId = input.slots[m];
    if (!slotId || !slotsFor(m, settings.windows).some((s) => s.id === slotId)) throw new ApiError(`Pick a ${MEAL_LABEL[m].toLowerCase()} pickup slot.`, 'slot');
  }
  const existing = (await read('subscriptions')).filter(
    (s) => s.userId === user.id && (s.status === 'active' || s.status === 'paused') && mealsOf(s.meal).some((m) => mealsOf(input.meal).includes(m)),
  );
  if (existing.length) throw new ApiError(`You already have a live ${existing[0].meal} plan. Cancel it or wait for it to finish first.`, 'duplicate');

  const quote = planQuote(input.plan, input.meal, settings.planPrices);
  const sub: Subscription = {
    id: uid('s'),
    userId: user.id,
    customerName: user.name,
    plan: input.plan,
    meal: input.meal,
    pricePerDay: quote.pricePerDay,
    serviceDays: quote.days,
    amount: quote.total,
    startDate: input.startDate,
    slots: input.slots,
    days: buildPlanDays(input.plan, input.meal, input.startDate),
    status: 'pending_payment',
    paymentId: null,
    createdAt: t,
    creditedBack: 0,
  };
  // Drop this user's older unpaid plan checkouts so they don't pile up.
  await write('subscriptions', (all) => [sub, ...all.filter((s) => !(s.userId === user.id && s.status === 'pending_payment'))]);
  return sub;
}

/** Called by payments once a plan is paid. */
export async function activateSubscription(id: string, paymentId: string): Promise<Subscription> {
  const settings = await read('settings');
  const current = await getSubscription(id);
  // If paying took long enough that the first days' cutoffs passed, shift those days forward.
  let sub = current;
  if (current.days.some((d) => now() >= cutoffAt(d.meal, d.date, settings.windows))) {
    const start = earliestStartDate(current.meal, now(), settings.windows);
    sub = { ...current, startDate: start, days: buildPlanDays(current.plan, current.meal, start) };
  }
  sub = await patchById<'subscriptions', Subscription>('subscriptions', id, () => ({ ...sub, status: 'active', paymentId }));
  await write('users', (users) => users.map((u) => (u.id === sub.userId ? { ...u, hasOrdered: true } : u)));
  await pushNotification(sub.userId, 'Plan activated ✅', `Your ${sub.plan} ${sub.meal} plan starts ${dateShort(sub.startDate)}. Skip any day before its cutoff.`, `/plans/${sub.id}`);
  await pushNotification('admin', `New subscriber: ${sub.customerName}`, `${sub.plan} ${sub.meal} plan · ${rupees(sub.amount)}`, '/admin/subscribers');
  return sub;
}

async function applyRule(id: string, userId: string, rule: (s: Subscription, t: number) => RuleResult, walletNote: (r: RuleResult) => string, type: 'rollover' | 'refund') {
  await latency();
  const sub = await getSubscription(id);
  if (sub.userId !== userId) throw new ApiError('This plan belongs to another account.');
  const res = rule(sub, now());
  if (res.error) throw new ApiError(res.error);
  if (res.credit < 0) {
    // Undoing a skip takes the rolled-over credit back.
    const user = (await read('users')).find((u) => u.id === userId);
    if (!user || user.walletBalance < -res.credit) throw new ApiError('The credit from this skip was already used, so it can’t be undone.');
  }
  await patchById<'subscriptions', Subscription>('subscriptions', id, () => res.sub);
  if (res.credit !== 0) await adjustWallet(userId, res.credit, type, walletNote(res), id);
  return res;
}

export async function skipPlanDate(id: string, userId: string, date: ISODate): Promise<RuleResult> {
  const { windows } = await read('settings');
  return applyRule(id, userId, (s, t) => skipDate(s, date, t, windows), (r) => `Skipped ${dateShort(date)} · ${r.changed} meal${r.changed > 1 ? 's' : ''} rolled over`, 'rollover');
}

export async function unskipPlanDate(id: string, userId: string, date: ISODate): Promise<RuleResult> {
  const { windows } = await read('settings');
  return applyRule(id, userId, (s, t) => unskipDate(s, date, t, windows), () => `Restored ${dateShort(date)} meal`, 'rollover');
}

export async function pauseSubscription(id: string, userId: string): Promise<RuleResult> {
  const { windows } = await read('settings');
  return applyRule(id, userId, (s, t) => pausePlan(s, t, windows), () => '', 'rollover');
}

export async function resumeSubscription(id: string, userId: string): Promise<RuleResult> {
  const { windows } = await read('settings');
  return applyRule(id, userId, (s, t) => resumePlan(s, t, windows), () => '', 'rollover');
}

export async function cancelSubscription(id: string, userId: string): Promise<RuleResult> {
  const { windows } = await read('settings');
  const res = await applyRule(id, userId, (s, t) => cancelPlan(s, t, windows), (r) => `Plan cancelled · ${r.changed} unused meal${r.changed === 1 ? '' : 's'} refunded`, 'refund');
  await pushNotification('admin', `Plan cancelled: ${res.sub.customerName}`, `${res.sub.plan} ${res.sub.meal} · ${rupees(res.credit)} refunded`, '/admin/subscribers');
  return res;
}

/** Preview of the refund a cancellation would give right now. */
export function cancelPreview(sub: Subscription, windows: Parameters<typeof cancelPlan>[2]): number {
  return cancelPlan(sub, now(), windows).credit;
}

/**
 * Background job: when a plan day's cutoff passes, it becomes a real kitchen order.
 * Also completes finished plans and drops abandoned unpaid plan checkouts.
 */
export async function materializePlanOrders(): Promise<number> {
  const t = now();
  const [subs, settings, menu, weekly, users] = await Promise.all([read('subscriptions'), read('settings'), read('menuItems'), read('weeklyMenu'), read('users')]);
  const items = indexItems(menu);
  const created: Order[] = [];
  const updated = new Map<string, Subscription>();

  for (const sub of subs) {
    if (sub.status === 'pending_payment' && t - sub.createdAt > PLAN_PAYMENT_WINDOW_MS) {
      updated.set(sub.id, { ...sub, status: 'cancelled', cancelledAt: t });
      continue;
    }
    const due = daysDueForOrder(sub, t, settings.windows);
    let next = sub;
    if (due.length) {
      const user = users.find((u) => u.id === sub.userId);
      const value = perMealValue(sub);
      const days = sub.days.map((d) => {
        if (!due.includes(d)) return d;
        const slots = slotsFor(d.meal, settings.windows);
        const slot = slots.find((s) => s.id === sub.slots[d.meal]) ?? slots[0];
        const order: Order = {
          id: uid('o'),
          number: '',
          userId: sub.userId,
          customerName: sub.customerName,
          customerPhone: user?.phone ?? '',
          mealType: d.meal,
          pickupDate: d.date,
          slot,
          items: [planMealItem(d.meal, d.date, weekly, items, value)],
          subtotal: value,
          discount: 0,
          total: value,
          couponCode: null,
          note: user?.allergies ? `Allergies: ${user.allergies}` : '',
          status: 'placed',
          statusHistory: [{ status: 'placed', at: t }],
          createdAt: t,
          pickupCode: digits(4).replace(/^0/, '7'),
          paymentId: sub.paymentId,
          paymentState: 'prepaid_plan',
          source: 'subscription',
          subscriptionId: sub.id,
        };
        created.push(order);
        return { ...d, state: 'ordered' as const, orderId: order.id };
      });
      next = { ...sub, days };
    }
    if ((next.status === 'active' || next.status === 'paused') && isPlanFinished(next)) next = { ...next, status: 'completed' };
    if (next !== sub) updated.set(sub.id, next);
  }

  if (!updated.size) return 0;
  for (const o of created) o.number = orderNumber(await nextCounter('orderCounter'));
  if (created.length) await write('orders', (all) => [...created, ...all]);
  await write('subscriptions', (all) => all.map((s) => updated.get(s.id) ?? s));
  for (const o of created)
    await pushNotification(o.userId, `Plan ${MEAL_LABEL[o.mealType].toLowerCase()} confirmed 🍽️`, `${dateShort(o.pickupDate)}, pickup ${o.slot.label}. Code ${o.pickupCode}.`, `/orders/${o.id}`);
  return created.length;
}
