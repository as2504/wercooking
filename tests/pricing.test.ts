import { describe, expect, it } from 'vitest';
import type { CartLine } from '@/types/models';
import { SEED_COUPONS, SEED_MENU } from '@/db/seed';
import { boxPrice, cartTotals, evaluateCoupon, indexItems, lineUnitPrice, planQuote } from '@/lib/pricing';
import { buildCookSheet } from '@/lib/kitchen';
import { buildOrderItems } from '@/lib/orders';

const items = indexItems(SEED_MENU);
const newUser = { hasOrdered: false };
const regular = { hasOrdered: true };

describe('breakfast box pricing', () => {
  it('adds base and add-on prices', () => {
    expect(boxPrice(items.b_poha, [items.a_eggs, items.a_sprouts])).toBe(45 + 14 + 15);
    expect(boxPrice(items.b_oats, [items.a_eggs, items.a_sprouts, items.a_fruit, items.a_chikki])).toBe(60 + 14 + 15 + 20 + 10);
  });
  it('prices a box line from the menu, and returns null for unknown items', () => {
    const line: CartLine = { id: 'l1', itemId: 'b_idli', qty: 2, box: { baseId: 'b_idli', addonIds: ['a_fruit'] } };
    expect(lineUnitPrice(line, items)).toBe(70);
    expect(lineUnitPrice({ ...line, box: { baseId: 'nope', addonIds: [] } }, items)).toBeNull();
  });
});

describe('cart totals and coupons', () => {
  const lines: CartLine[] = [
    { id: 'a', itemId: 't_regular', qty: 1 },
    { id: 'b', itemId: 'm_roti', qty: 2 },
  ];
  it('sums lines with no GST or fees', () => {
    expect(cartTotals(lines, null, items, SEED_COUPONS, newUser)).toMatchObject({ subtotal: 130, discount: 0, total: 130, itemCount: 3 });
  });
  it('applies WELCOME20 to a first order over ₹80', () => {
    expect(cartTotals(lines, 'welcome20', items, SEED_COUPONS, newUser)).toMatchObject({ discount: 20, total: 110 });
  });
  it('rejects WELCOME20 for returning customers and below the minimum', () => {
    expect(evaluateCoupon('WELCOME20', 130, SEED_COUPONS, regular).error).toMatch(/first order/);
    expect(evaluateCoupon('WELCOME20', 79, SEED_COUPONS, newUser).error).toMatch(/₹1 more/);
  });
  it('rejects unknown codes', () => {
    expect(evaluateCoupon('FREEFOOD', 500, SEED_COUPONS, newUser)).toEqual({ discount: 0, error: 'This coupon code is not valid.' });
  });
  it('never discounts below zero', () => {
    const cheap = [{ ...SEED_COUPONS[0], minOrder: 0, amountOff: 100 }];
    expect(cartTotals([{ id: 'p', itemId: 'i_poha_only', qty: 1 }], 'WELCOME20', items, cheap, newUser).total).toBe(0);
  });
});

describe('subscription quotes', () => {
  it('monthly lunch is 26 days at ₹95 and saves vs single ₹110', () => {
    expect(planQuote('monthly', 'lunch')).toEqual({ pricePerDay: 95, days: 26, total: 2470, singleTotal: 2860, savings: 390 });
  });
  it('weekly combo covers 6 days of lunch + dinner', () => {
    expect(planQuote('weekly', 'combo')).toMatchObject({ days: 6, total: 1140, savings: 180 });
  });
});

describe('cook sheet', () => {
  it('totals thalis, rotis and eggs across orders', () => {
    const mk = (lines: CartLine[]) => ({ mealType: 'lunch', status: 'placed', paymentState: 'paid', items: buildOrderItems(lines, items), note: '', number: 'X', customerName: 'A' }) as never;
    const orders = [
      mk([{ id: '1', itemId: 't_regular', qty: 2 }, { id: '2', itemId: 'm_roti', qty: 3 }]),
      mk([{ id: '3', itemId: 't_mini', qty: 1 }, { id: '4', itemId: 'm_eggcurry', qty: 1 }]),
    ];
    const sheet = buildCookSheet('lunch', orders);
    const qty = (k: string) => sheet.lines.find((l) => l.key === k)?.qty;
    expect(qty('t_regular')).toBe(2);
    expect(qty('rotis_total')).toBe(2 * 4 + 3 + 3);
    expect(qty('eggs')).toBe(2);
  });
});
