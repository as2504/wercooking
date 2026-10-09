import type { Cart, CartLine, ISODate, MealType, Order, OrderStatus, SubDayState, User } from '@/types/models';
import { now } from '@/lib/clock';
import { cutoffAt, isOrderable, slotAvailability, slotsFor } from '@/lib/cutoff';
import { MEAL_LABEL, STATUS_LABEL, dateShort, time12 } from '@/lib/format';
import { digits, uid } from '@/lib/id';
import { buildOrderItems, isActiveOrder, nextStatus, orderNumber } from '@/lib/orders';
import { cartTotals, indexItems } from '@/lib/pricing';
import { ApiError, latency, nextCounter, patchById, read, write } from './base';
import { pushNotification } from './notifications';
import { adjustWallet } from './wallet';

/** Unpaid checkouts hold their slot for this long. */
export const PAYMENT_HOLD_MS = 10 * 60_000;

/** Whether an order currently occupies kitchen capacity. */
export function occupiesCapacity(o: Order, nowMs: number): boolean {
  if (o.status === 'cancelled') return false;
  if (o.paymentState === 'unpaid') return nowMs - o.createdAt < PAYMENT_HOLD_MS;
  return true;
}

export async function slotBookings(meal: MealType, date: ISODate, excludeOrderId?: string): Promise<Record<string, number>> {
  const t = now();
  const counts: Record<string, number> = {};
  for (const o of await read('orders')) {
    if (o.mealType !== meal || o.pickupDate !== date || o.id === excludeOrderId || !occupiesCapacity(o, t)) continue;
    counts[o.slot.id] = (counts[o.slot.id] ?? 0) + 1;
  }
  return counts;
}

export async function listMyOrders(userId: string): Promise<Order[]> {
  await latency();
  return (await read('orders')).filter((o) => o.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
}

export async function listAllOrders(): Promise<Order[]> {
  await latency();
  return (await read('orders')).slice().sort((a, b) => b.createdAt - a.createdAt);
}

export async function getOrder(id: string): Promise<Order> {
  await latency(80, 200);
  const o = (await read('orders')).find((x) => x.id === id);
  if (!o) throw new ApiError('Order not found.', 'not_found');
  return o;
}

/** Validates the cart against cutoff, stock and capacity, then creates an unpaid order. */
export async function createOrderFromCart(user: User, cart: Cart): Promise<Order> {
  await latency(250, 500);
  const t = now();
  if (!cart.mealType || !cart.date) throw new ApiError('Choose a meal and date first.');
  if (cart.lines.length === 0) throw new ApiError('Your cart is empty.');
  if (!cart.slotId) throw new ApiError('Pick a pickup slot.');
  const [settings, menu, coupons] = await Promise.all([read('settings'), read('menuItems'), read('coupons')]);
  const windows = settings.windows;
  const meal = cart.mealType;
  if (!isOrderable(meal, cart.date, t, windows))
    throw new ApiError(`Ordering for ${MEAL_LABEL[meal].toLowerCase()} on ${dateShort(cart.date)} closed at ${time12(cutoffAt(meal, cart.date, windows))}.`, 'cutoff_passed');

  const items = indexItems(menu);
  for (const line of cart.lines) {
    const ids = line.box ? [line.box.baseId, ...line.box.addonIds] : [line.itemId];
    for (const id of ids) {
      const item = items[id];
      if (!item) throw new ApiError('An item in your cart is no longer available.');
      if (item.soldOut) throw new ApiError(`${item.name} is sold out. Please remove it.`, 'sold_out');
      if (!item.meals.includes(meal)) throw new ApiError(`${item.name} isn't served at ${MEAL_LABEL[meal].toLowerCase()}.`);
    }
  }

  const slot = slotsFor(meal, windows).find((s) => s.id === cart.slotId);
  if (!slot) throw new ApiError('That pickup slot is not available.');
  const bookings = await slotBookings(meal, cart.date);
  const avail = slotAvailability(slot, cart.date, bookings[slot.id] ?? 0, t, windows);
  if (!avail.open) throw new ApiError(`The ${slot.label} slot is ${avail.reason === 'Full' ? 'full' : 'no longer available'}. Pick another.`, 'slot_full');
  const dayTotal = Object.values(bookings).reduce((a, b) => a + b, 0);
  if (dayTotal >= windows[meal].dailyCapacity) throw new ApiError(`${MEAL_LABEL[meal]} is fully booked for ${dateShort(cart.date)}.`, 'sold_out');

  const totals = cartTotals(cart.lines, cart.couponCode, items, coupons, user);
  if (totals.couponError) throw new ApiError(totals.couponError, 'coupon');

  const counter = await nextCounter('orderCounter');
  const order: Order = {
    id: uid('o'),
    number: orderNumber(counter),
    userId: user.id,
    customerName: user.name,
    customerPhone: user.phone,
    mealType: meal,
    pickupDate: cart.date,
    slot,
    items: buildOrderItems(cart.lines, items),
    subtotal: totals.subtotal,
    discount: totals.discount,
    total: totals.total,
    couponCode: totals.discount > 0 ? cart.couponCode : null,
    note: cart.note.trim(),
    status: 'placed',
    statusHistory: [{ status: 'placed', at: t }],
    createdAt: t,
    pickupCode: digits(4).replace(/^0/, '7'),
    paymentId: null,
    paymentState: 'unpaid',
    source: 'single',
  };
  await write('orders', (all) => [order, ...all]);
  return order;
}

/** Called by the payments module once money is captured. */
export async function markOrderPaid(orderId: string, paymentId: string): Promise<Order> {
  const order = await patchById<'orders', Order>('orders', orderId, (o) => ({ ...o, paymentId, paymentState: 'paid' }));
  await write('users', (users) => users.map((u) => (u.id === order.userId ? { ...u, hasOrdered: true } : u)));
  await pushNotification(order.userId, `Order ${order.number} placed ✅`, `${MEAL_LABEL[order.mealType]} on ${dateShort(order.pickupDate)}, pickup ${order.slot.label}. Code ${order.pickupCode}.`, `/orders/${order.id}`);
  await pushNotification('admin', `New order ${order.number}`, `${order.customerName} · ${MEAL_LABEL[order.mealType]} ${dateShort(order.pickupDate)} · ₹${order.total}`, '/admin/orders');
  return order;
}

export function canCustomerCancel(o: Order, nowMs: number, windows: Parameters<typeof cutoffAt>[2]): boolean {
  return o.source === 'single' && (o.status === 'placed' || o.status === 'accepted') && o.paymentState !== 'unpaid' && nowMs < cutoffAt(o.mealType, o.pickupDate, windows);
}

/** Cancels an order. Paid single orders are refunded to the wallet instantly. */
export async function cancelOrder(id: string, by: 'customer' | 'kitchen', reason: string): Promise<Order> {
  await latency();
  const [order, settings] = await Promise.all([getOrder(id), read('settings')]);
  if (!isActiveOrder(order)) throw new ApiError('This order can no longer be cancelled.');
  if (by === 'customer' && !canCustomerCancel(order, now(), settings.windows))
    throw new ApiError('Cutoff has passed, so this order can no longer be cancelled. Please call the kitchen.');
  // Paid orders are refunded; a prepaid plan meal the kitchen can't serve is credited at its plan value.
  const refund = order.paymentState === 'paid' || order.paymentState === 'prepaid_plan' ? order.total : 0;
  const t = now();
  const updated = await patchById<'orders', Order>('orders', id, (o) => ({
    ...o,
    status: 'cancelled',
    statusHistory: [...o.statusHistory, { status: 'cancelled', at: t }],
    cancelReason: reason,
    paymentState: refund > 0 ? 'refunded' : o.paymentState,
  }));
  if (refund > 0) await adjustWallet(order.userId, refund, 'refund', `Refund for ${order.number}`, order.id);
  if (order.subscriptionId) {
    const subId = order.subscriptionId;
    await write('subscriptions', (subs) =>
      subs.map((s) =>
        s.id !== subId
          ? s
          : { ...s, creditedBack: s.creditedBack + refund, days: s.days.map((d) => (d.orderId === id ? { ...d, state: 'cancelled' as SubDayState } : d)) },
      ),
    );
  }
  if (by === 'kitchen')
    await pushNotification(order.userId, `Order ${order.number} cancelled`, `${reason}${refund ? ` ₹${refund} refunded to your wallet.` : ''}`, `/orders/${order.id}`);
  else await pushNotification('admin', `Order ${order.number} cancelled by customer`, reason, '/admin/orders');
  return updated;
}

const STATUS_COPY: Partial<Record<OrderStatus, (o: Order) => [string, string]>> = {
  accepted: (o) => [`Order accepted 👍`, `The kitchen has your ${MEAL_LABEL[o.mealType].toLowerCase()} order ${o.number}.`],
  cooking: (o) => [`Cooking now 🍳`, `${o.cookedBy ?? 'Tai'} started cooking your ${MEAL_LABEL[o.mealType].toLowerCase()}.`],
  packed: () => [`Packed 📦`, `Your meal is packed hot and sealed.`],
  ready: (o) => [`Ready for pickup ✅`, `Show code ${o.pickupCode} at the counter. Slot ${o.slot.label}.`],
  picked_up: () => [`Enjoy your meal! 😋`, `Tap to rate it and help the kitchen.`],
};

/** Kitchen moves an order forward. Cooking/Packed record the proof-label timestamps. */
export async function setOrderStatus(id: string, status: OrderStatus): Promise<Order> {
  const [order, settings] = await Promise.all([getOrder(id), read('settings')]);
  if (order.paymentState === 'unpaid') throw new ApiError('This order is awaiting payment.');
  if (!isActiveOrder(order)) throw new ApiError('This order is already closed.');
  const t = now();
  const updated = await patchById<'orders', Order>('orders', id, (o) => ({
    ...o,
    status,
    statusHistory: [...o.statusHistory, { status, at: t }],
    cookedAt: status === 'cooking' ? t : o.cookedAt,
    cookedBy: status === 'cooking' ? settings.cookName : o.cookedBy,
    packedAt: status === 'packed' ? t : o.packedAt,
  }));
  const copy = STATUS_COPY[status]?.(updated);
  if (copy) await pushNotification(order.userId, copy[0], copy[1], `/orders/${order.id}`);
  if (order.subscriptionId) {
    const subId = order.subscriptionId;
    await write('subscriptions', (subs) =>
      subs.map((s) =>
        s.id !== subId
          ? s
          : { ...s, days: s.days.map((d) => (d.orderId === id ? { ...d, state: (status === 'picked_up' ? 'delivered' : 'ordered') as SubDayState } : d)) },
      ),
    );
  }
  return updated;
}

export async function advanceOrder(id: string): Promise<Order> {
  const order = await getOrder(id);
  const next = nextStatus(order.status);
  if (!next) throw new ApiError('Nothing further to do for this order.');
  return setOrderStatus(id, next);
}

/** Finds an active order for a pickup code on the given date. */
export async function findByPickupCode(code: string, date: ISODate): Promise<Order> {
  await latency(150, 300);
  if (!/^\d{4}$/.test(code)) throw new ApiError('Pickup codes are 4 digits.');
  const matches = (await read('orders')).filter((o) => o.pickupCode === code && o.pickupDate === date && o.paymentState !== 'unpaid');
  const active = matches.find(isActiveOrder);
  if (active) return active;
  if (matches.some((o) => o.status === 'picked_up')) throw new ApiError('This code was already used. The order is picked up.');
  throw new ApiError(`No order for code ${code} today.`, 'not_found');
}

/** Cart lines that recreate an order (plan meals are skipped). */
export function linesFromOrder(order: Order): CartLine[] {
  return order.items
    .filter((i) => !i.name.endsWith('(plan)'))
    .map((i) => ({
      id: uid('l'),
      itemId: i.itemId,
      qty: i.qty,
      box: i.box ? { baseId: i.box.base.id, addonIds: i.box.addons.map((a) => a.id) } : undefined,
    }));
}

/** Kitchen-side label for logs and invoices. */
export function statusLabel(s: OrderStatus) {
  return STATUS_LABEL[s];
}
