// Pricing rules. Simple GST-free pricing: item totals + add-ons - coupon.
import type { CartLine, Coupon, MenuItem, PlanLength, PlanMeal, User } from '@/types/models';

export type ItemIndex = Record<string, MenuItem>;

export function indexItems(items: MenuItem[]): ItemIndex {
  return Object.fromEntries(items.map((i) => [i.id, i]));
}

/** Price of one breakfast box: base + each add-on. */
export function boxPrice(base: MenuItem, addons: MenuItem[]): number {
  return base.price + addons.reduce((s, a) => s + a.price, 0);
}

/** Unit price of a cart line, or null if it references unknown items. */
export function lineUnitPrice(line: CartLine, items: ItemIndex): number | null {
  if (line.box) {
    const base = items[line.box.baseId];
    const addons = line.box.addonIds.map((id) => items[id]);
    if (!base || addons.some((a) => !a)) return null;
    return boxPrice(base, addons as MenuItem[]);
  }
  const item = items[line.itemId];
  return item ? item.price : null;
}

export function cartSubtotal(lines: CartLine[], items: ItemIndex): number {
  return lines.reduce((sum, l) => sum + (lineUnitPrice(l, items) ?? 0) * l.qty, 0);
}

export interface CouponResult {
  discount: number;
  error?: string;
}

export function evaluateCoupon(
  code: string | null,
  subtotal: number,
  coupons: Coupon[],
  user: Pick<User, 'hasOrdered'> | null,
): CouponResult {
  if (!code) return { discount: 0 };
  const coupon = coupons.find((c) => c.code.toUpperCase() === code.trim().toUpperCase());
  if (!coupon || !coupon.active) return { discount: 0, error: 'This coupon code is not valid.' };
  if (coupon.firstOrderOnly && user?.hasOrdered) return { discount: 0, error: 'This coupon is only for your first order.' };
  if (subtotal < coupon.minOrder) return { discount: 0, error: `Add items worth ₹${coupon.minOrder - subtotal} more to use this coupon.` };
  return { discount: Math.min(coupon.amountOff, subtotal) };
}

export interface CartTotals {
  subtotal: number;
  discount: number;
  total: number;
  couponError?: string;
  itemCount: number;
}

export function cartTotals(
  lines: CartLine[],
  couponCode: string | null,
  items: ItemIndex,
  coupons: Coupon[],
  user: Pick<User, 'hasOrdered'> | null,
): CartTotals {
  const subtotal = cartSubtotal(lines, items);
  const { discount, error } = evaluateCoupon(couponCode, subtotal, coupons, user);
  return {
    subtotal,
    discount,
    total: Math.max(0, subtotal - discount),
    couponError: error,
    itemCount: lines.reduce((n, l) => n + l.qty, 0),
  };
}

export const PLAN_DAYS: Record<PlanLength, number> = { weekly: 6, monthly: 26 };

export const DEFAULT_PLAN_PRICES: Record<PlanLength, Record<PlanMeal, number>> = {
  weekly: { lunch: 100, dinner: 100, breakfast: 50, combo: 190 },
  monthly: { lunch: 95, dinner: 95, breakfast: 48, combo: 180 },
};

/** What the same meals would cost as single orders (for the "you save" message). */
export const SINGLE_REFERENCE: Record<PlanMeal, number> = { lunch: 110, dinner: 110, breakfast: 60, combo: 220 };

export interface PlanQuote {
  pricePerDay: number;
  days: number;
  total: number;
  singleTotal: number;
  savings: number;
}

export function planQuote(
  plan: PlanLength,
  meal: PlanMeal,
  prices: Record<PlanLength, Record<PlanMeal, number>> = DEFAULT_PLAN_PRICES,
): PlanQuote {
  const days = PLAN_DAYS[plan];
  const pricePerDay = prices[plan][meal];
  const total = pricePerDay * days;
  const singleTotal = SINGLE_REFERENCE[meal] * days;
  return { pricePerDay, days, total, singleTotal, savings: Math.max(0, singleTotal - total) };
}
