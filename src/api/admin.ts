import type { ISODate, Order } from '@/types/models';
import { buildReport, isKitchenOrder, type Report } from '@/lib/kitchen';
import { latency, read } from './base';

/** Kitchen orders (paid / prepaid) for a pickup date. */
export async function ordersForDate(date: ISODate): Promise<Order[]> {
  await latency(100, 250);
  return (await read('orders')).filter((o) => o.pickupDate === date && isKitchenOrder(o)).sort((a, b) => a.slot.start.localeCompare(b.slot.start) || a.createdAt - b.createdAt);
}

export async function weeklyReport(endDate: ISODate): Promise<Report> {
  await latency(200, 400);
  const [orders, reviews] = await Promise.all([read('orders'), read('reviews')]);
  return buildReport(orders, reviews, endDate, 7);
}
