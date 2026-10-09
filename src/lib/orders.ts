import type { CartLine, ISODate, MealType, MenuItem, Order, OrderItem, OrderStatus, WeeklyMenu } from '@/types/models';
import { lineUnitPrice, type ItemIndex } from './pricing';
import { weekdayOf } from './time';

export const STATUS_FLOW: OrderStatus[] = ['placed', 'accepted', 'cooking', 'packed', 'ready', 'picked_up'];

export function nextStatus(s: OrderStatus): OrderStatus | null {
  const i = STATUS_FLOW.indexOf(s);
  return i >= 0 && i < STATUS_FLOW.length - 1 ? STATUS_FLOW[i + 1] : null;
}

export function isActiveOrder(o: Pick<Order, 'status'>): boolean {
  return o.status !== 'picked_up' && o.status !== 'cancelled';
}

/** Snapshot cart lines into order items with prices fixed at order time. */
export function buildOrderItems(lines: CartLine[], items: ItemIndex): OrderItem[] {
  return lines.map((line) => {
    const unitPrice = lineUnitPrice(line, items) ?? 0;
    const item = items[line.itemId] as MenuItem | undefined;
    if (line.box) {
      const base = items[line.box.baseId];
      const addons = line.box.addonIds.map((id) => items[id]).filter(Boolean);
      return {
        itemId: line.itemId,
        name: `Breakfast Box: ${base?.name ?? 'Base'}`,
        emoji: base?.emoji ?? '🥣',
        qty: line.qty,
        unitPrice,
        lineTotal: unitPrice * line.qty,
        box: {
          base: { id: base?.id ?? '', name: base?.name ?? '', price: base?.price ?? 0 },
          addons: addons.map((a) => ({ id: a.id, name: a.name, price: a.price })),
        },
      };
    }
    return {
      itemId: line.itemId,
      name: item?.name ?? 'Item',
      emoji: item?.emoji ?? '🍽️',
      qty: line.qty,
      unitPrice,
      lineTotal: unitPrice * line.qty,
    };
  });
}

/** The single item a subscription meal turns into on a given day. */
export function planMealItem(meal: MealType, date: ISODate, weekly: WeeklyMenu, items: ItemIndex, value: number): OrderItem {
  if (meal === 'breakfast') {
    const day = weekly.days.find((d) => d.day === weekdayOf(date));
    const base = items[day?.breakfastSpecial ?? 'b_poha'] ?? items.b_poha;
    return {
      itemId: base.id,
      name: `Breakfast Box: ${base.name} (plan)`,
      emoji: base.emoji,
      qty: 1,
      unitPrice: value,
      lineTotal: value,
      box: { base: { id: base.id, name: base.name, price: value }, addons: [] },
    };
  }
  const thali = items.t_regular;
  return { itemId: thali.id, name: `${thali.name} (plan)`, emoji: thali.emoji, qty: 1, unitPrice: value, lineTotal: value };
}

export function itemsSummary(items: OrderItem[]): string {
  return items.map((i) => (i.qty > 1 ? `${i.qty}× ${i.name}` : i.name)).join(', ');
}

/** "WAC-1042" */
export function orderNumber(counter: number): string {
  return `WAC-${counter}`;
}
