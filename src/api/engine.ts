// Background "server jobs", run periodically by the app (and when time-travel changes).
// A real backend would run these as scheduled jobs.
import type { Order } from '@/types/models';
import { now } from '@/lib/clock';
import { cutoffAt } from '@/lib/cutoff';
import { read, write } from './base';
import { resolvePayment, settlePendingPayments } from './payments';
import { materializePlanOrders } from './subscriptions';

/** A UPI attempt the user abandoned mid-approval times out after this long. */
export const PROCESSING_TIMEOUT_MS = 3 * 60_000;

export async function timeoutAbandonedPayments(): Promise<void> {
  const t = now();
  const stuck = (await read('payments')).filter((p) => p.status === 'processing' && t - p.createdAt > PROCESSING_TIMEOUT_MS);
  for (const p of stuck) await resolvePayment(p.id, 'timeout');
}

/** Unpaid checkouts are dropped after this long or once the cutoff passes. */
export const DRAFT_EXPIRY_MS = 30 * 60_000;

export async function expireUnpaidOrders(): Promise<number> {
  const t = now();
  const { windows } = await read('settings');
  const stale = (o: Order) =>
    o.paymentState === 'unpaid' && o.status === 'placed' && (t - o.createdAt > DRAFT_EXPIRY_MS || t >= cutoffAt(o.mealType, o.pickupDate, windows));
  const orders = await read('orders');
  const count = orders.filter(stale).length;
  if (count === 0) return 0;
  await write('orders', (all) =>
    all.map((o) =>
      stale(o)
        ? { ...o, status: 'cancelled' as const, cancelReason: 'Payment not completed', statusHistory: [...o.statusHistory, { status: 'cancelled' as const, at: t }] }
        : o,
    ),
  );
  return count;
}

let running = false;

export async function runJobs(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await settlePendingPayments();
    await timeoutAbandonedPayments();
    await expireUnpaidOrders();
    await materializePlanOrders();
  } finally {
    running = false;
  }
}
