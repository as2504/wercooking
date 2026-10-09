// Kitchen-side aggregations (pure): cook sheet, revenue, slot load and 7-day reports.
import type { ISODate, MealType, Order, Review } from '@/types/models';
import { addDays, istAt } from './time';

/** Orders the kitchen must act on: paid or prepaid, not abandoned checkouts. */
export function isKitchenOrder(o: Order): boolean {
  return o.paymentState !== 'unpaid';
}

export interface CookLine {
  key: string;
  label: string;
  emoji: string;
  qty: number;
}

export interface CookSheet {
  meal: MealType;
  orders: number;
  lines: CookLine[];
  notes: { number: string; name: string; note: string }[];
}

/**
 * Totals of what to cook for a set of orders, e.g. 42 thalis, 18 breakfast boxes, 25 eggs.
 * Breakfast boxes count each base and each add-on; eggs are counted individually (2 per portion).
 */
export function buildCookSheet(meal: MealType, orders: Order[]): CookSheet {
  const active = orders.filter((o) => o.mealType === meal && o.status !== 'cancelled' && isKitchenOrder(o));
  const tally = new Map<string, CookLine>();
  const add = (key: string, label: string, emoji: string, qty: number) => {
    const cur = tally.get(key);
    tally.set(key, { key, label, emoji, qty: (cur?.qty ?? 0) + qty });
  };
  for (const o of active) {
    for (const i of o.items) {
      if (i.box) {
        add('box_total', 'Breakfast boxes (total)', '🥡', i.qty);
        add(`base_${i.box.base.id}`, i.box.base.name, i.emoji, i.qty);
        for (const a of i.box.addons) {
          if (a.id === 'a_eggs') add('eggs', 'Boiled eggs (pcs)', '🥚', 2 * i.qty);
          else add(a.id, a.name, '➕', i.qty);
        }
      } else if (i.itemId === 'm_eggcurry') {
        add('m_eggcurry', 'Egg curry portions', '🍳', i.qty);
        add('eggs', 'Boiled eggs (pcs)', '🥚', 2 * i.qty);
      } else if (i.itemId === 't_regular') add('t_regular', 'Regular thalis', '🍛', i.qty);
      else add(i.itemId, i.name.replace(' (plan)', ''), i.emoji, i.qty);
    }
  }
  // Rotis are what actually gets rolled: 4 per regular thali, 3 per mini, plus extras.
  if (meal !== 'breakfast') {
    const rotis = (tally.get('t_regular')?.qty ?? 0) * 4 + (tally.get('t_mini')?.qty ?? 0) * 3 + (tally.get('m_roti')?.qty ?? 0);
    if (rotis) add('rotis_total', 'Rotis to roll (total)', '🫓', rotis);
  }
  const ORDER = ['t_regular', 't_mini', 'box_total', 'rotis_total', 'm_roti', 'eggs', 'm_eggcurry', 'm_curd'];
  const lines = [...tally.values()].sort((a, b) => {
    const ia = ORDER.indexOf(a.key);
    const ib = ORDER.indexOf(b.key);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || b.qty - a.qty;
  });
  return {
    meal,
    orders: active.length,
    lines,
    notes: active.filter((o) => o.note).map((o) => ({ number: o.number, name: o.customerName, note: o.note })),
  };
}

/** Revenue earned from orders: paid single orders at their total, plan meals at their per-meal value. */
export function revenueOf(orders: Order[]): number {
  return orders.reduce((sum, o) => {
    if (o.status === 'cancelled' || o.paymentState === 'unpaid' || o.paymentState === 'refunded') return sum;
    return sum + o.total;
  }, 0);
}

export function slotLoad(orders: Order[], meal: MealType): Record<string, number> {
  const out: Record<string, number> = {};
  for (const o of orders) {
    if (o.mealType !== meal || o.status === 'cancelled' || !isKitchenOrder(o)) continue;
    out[o.slot.id] = (out[o.slot.id] ?? 0) + 1;
  }
  return out;
}

export interface DayStat {
  date: ISODate;
  orders: number;
  revenue: number;
}

export interface Report {
  days: DayStat[];
  totalOrders: number;
  totalRevenue: number;
  topItems: { name: string; emoji: string; qty: number }[];
  avgRating: number;
  ratingCounts: number[]; // index 0 = 1 star
  reviews: Review[];
  byMeal: Record<MealType, number>;
}

/** Last `n` days ending at `endDate` (inclusive). */
export function buildReport(orders: Order[], reviews: Review[], endDate: ISODate, n = 7): Report {
  const dates = Array.from({ length: n }, (_, i) => addDays(endDate, i - n + 1));
  const inRange = orders.filter((o) => dates.includes(o.pickupDate) && o.status !== 'cancelled' && isKitchenOrder(o));
  const days = dates.map((date) => {
    const d = inRange.filter((o) => o.pickupDate === date);
    return { date, orders: d.length, revenue: revenueOf(d) };
  });
  const items = new Map<string, { name: string; emoji: string; qty: number }>();
  for (const o of inRange)
    for (const i of o.items) {
      const name = i.box ? `Breakfast Box: ${i.box.base.name}` : i.name.replace(' (plan)', '');
      const cur = items.get(name);
      items.set(name, { name, emoji: i.emoji, qty: (cur?.qty ?? 0) + i.qty });
    }
  const firstMs = istAt(dates[0], '00:00');
  const rs = reviews.filter((r) => r.createdAt >= firstMs).sort((a, b) => b.createdAt - a.createdAt);
  const ratingCounts = [1, 2, 3, 4, 5].map((s) => rs.filter((r) => r.stars === s).length);
  const byMeal: Record<MealType, number> = { breakfast: 0, lunch: 0, dinner: 0 };
  for (const o of inRange) byMeal[o.mealType]++;
  return {
    days,
    totalOrders: inRange.length,
    totalRevenue: days.reduce((s, d) => s + d.revenue, 0),
    topItems: [...items.values()].sort((a, b) => b.qty - a.qty).slice(0, 6),
    avgRating: rs.length ? rs.reduce((s, r) => s + r.stars, 0) / rs.length : 0,
    ratingCounts,
    reviews: rs,
    byMeal,
  };
}
