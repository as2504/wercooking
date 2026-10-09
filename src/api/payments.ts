// Simulated payment gateway (UPI + wallet). No real money moves. A real integration would
// create the payment on the server (e.g. a gateway "order"), open the UPI intent / collect
// request, and confirm via a signed webhook. The outcome here is chosen by the simulator.
import type { Payment, PaymentMethod, PaymentPurpose, SimOutcome } from '@/types/models';
import { now } from '@/lib/clock';
import { digits, txnId, uid } from '@/lib/id';
import { istDate, istParts } from '@/lib/time';
import { rupees } from '@/lib/format';
import { ApiError, latency, nextCounter, patchById, read, write } from './base';
import { getOrder, markOrderPaid } from './orders';
import { activateSubscription, getSubscription } from './subscriptions';
import { adjustWallet } from './wallet';
import { pushNotification } from './notifications';

/** How long a "pending" payment takes to settle as success. */
export const PENDING_SETTLE_MS = 5_000;

const SIM_KEY = 'wac:simOutcome';

export function getSimOutcome(): SimOutcome {
  try {
    const v = localStorage.getItem(SIM_KEY);
    return v === 'failed' || v === 'pending' || v === 'timeout' ? v : 'success';
  } catch {
    return 'success';
  }
}

export function setSimOutcome(o: SimOutcome) {
  try {
    localStorage.setItem(SIM_KEY, o);
  } catch {
    /* ignore */
  }
}

export const UPI_ID_RE = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63}$/;

export const MIN_TOPUP = 50;
export const MAX_TOPUP = 10_000;

export interface PayTarget {
  purpose: PaymentPurpose;
  refId: string | null;
  amount: number;
  title: string;
  subtitle: string;
  /** Already paid: the existing payment id. */
  paidWith?: string | null;
}

/** Resolves what is being paid for, validating that it is still payable. */
export async function getPayTarget(purpose: PaymentPurpose, id: string, userId: string): Promise<PayTarget> {
  await latency(100, 250);
  if (purpose === 'order') {
    const o = await getOrder(id);
    if (o.userId !== userId) throw new ApiError('This order belongs to another account.');
    if (o.status === 'cancelled') throw new ApiError(o.cancelReason === 'Payment not completed' ? 'This checkout expired. Please reorder.' : 'This order was cancelled.', 'expired');
    return { purpose, refId: o.id, amount: o.total, title: `Order ${o.number}`, subtitle: `${o.items.length} item${o.items.length > 1 ? 's' : ''} · pickup ${o.slot.label}`, paidWith: o.paymentState === 'paid' ? o.paymentId : null };
  }
  if (purpose === 'subscription') {
    const s = await getSubscription(id);
    if (s.userId !== userId) throw new ApiError('This plan belongs to another account.');
    if (s.status === 'cancelled') throw new ApiError('This plan was cancelled.', 'expired');
    return { purpose, refId: s.id, amount: s.amount, title: `${s.plan === 'weekly' ? 'Weekly' : 'Monthly'} ${s.meal} plan`, subtitle: `${s.serviceDays} days · prepaid`, paidWith: s.status !== 'pending_payment' ? s.paymentId : null };
  }
  const amount = Number(id);
  if (!Number.isInteger(amount) || amount < MIN_TOPUP || amount > MAX_TOPUP) throw new ApiError(`Top-up must be between ${rupees(MIN_TOPUP)} and ${rupees(MAX_TOPUP)}.`);
  return { purpose, refId: null, amount, title: 'Add money to wallet', subtitle: 'WeAreCooking wallet' };
}

export async function getPayment(id: string): Promise<Payment> {
  const p = (await read('payments')).find((x) => x.id === id);
  if (!p) throw new ApiError('Payment not found.', 'not_found');
  return p;
}

export async function listMyPayments(userId: string): Promise<Payment[]> {
  await latency();
  return (await read('payments')).filter((p) => p.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
}

export interface StartInput {
  userId: string;
  target: PayTarget;
  method: Exclude<PaymentMethod, 'wallet'>;
  upiId?: string;
  appLabel?: string;
}

/** Creates a payment attempt in "processing" state (the user is approving in their UPI app). */
export async function startUpiPayment(input: StartInput): Promise<Payment> {
  if (input.target.paidWith) throw new ApiError('This is already paid.');
  if (input.method === 'upi_id' && !UPI_ID_RE.test(input.upiId ?? '')) throw new ApiError('Enter a valid UPI ID, like name@bank.');
  await latency(300, 600);
  const prev = (await read('payments')).filter((p) => p.refId === input.target.refId && p.purpose === input.target.purpose && input.target.refId);
  const p: Payment = {
    id: uid('p'),
    userId: input.userId,
    purpose: input.target.purpose,
    refId: input.target.refId,
    amount: input.target.amount,
    method: input.method,
    upiId: input.upiId,
    appLabel: input.appLabel,
    status: 'processing',
    txnId: txnId(),
    attempt: prev.length + 1,
    createdAt: now(),
  };
  await write('payments', (all) => [p, ...all]);
  return p;
}

async function receiptNumbers(): Promise<{ receiptNo: string; invoiceNo: string }> {
  const n = await nextCounter('invoiceCounter');
  const t = now();
  const p = istParts(t);
  const fy = p.month >= 4 ? `${p.year}-${String((p.year + 1) % 100).padStart(2, '0')}` : `${p.year - 1}-${String(p.year % 100).padStart(2, '0')}`;
  return { receiptNo: `RCPT-${istDate(t).replace(/-/g, '')}-${String(n).padStart(4, '0')}`, invoiceNo: `WAC/${fy}/${String(n).padStart(5, '0')}` };
}

/** Applies what a successful payment buys. */
async function fulfil(p: Payment) {
  if (p.purpose === 'order' && p.refId) await markOrderPaid(p.refId, p.id);
  else if (p.purpose === 'subscription' && p.refId) await activateSubscription(p.refId, p.id);
  else if (p.purpose === 'wallet_topup') {
    await adjustWallet(p.userId, p.amount, 'topup', `Added via UPI (${p.txnId})`, p.id);
    await pushNotification(p.userId, 'Money added 💰', `${rupees(p.amount)} added to your wallet.`, '/wallet');
  }
}

const FAILURE: Record<Exclude<SimOutcome, 'success' | 'pending'>, string> = {
  failed: 'Insufficient balance in your bank account.',
  timeout: 'Your bank did not respond in time.',
};

/** Settles a processing/pending payment with the simulator's outcome. */
export async function resolvePayment(id: string, outcome: SimOutcome, reason?: string): Promise<Payment> {
  const current = await getPayment(id);
  if (current.status === 'success' || current.status === 'failed' || current.status === 'timeout') return current;
  if (outcome === 'pending') return patchById<'payments', Payment>('payments', id, (p) => ({ ...p, status: 'pending' }));
  if (outcome === 'success') {
    // Guard against double payment (e.g. two tabs paying the same order).
    if (current.refId) {
      const dup = (await read('payments')).find((p) => p.refId === current.refId && p.purpose === current.purpose && p.status === 'success' && p.id !== id);
      if (dup) return patchById<'payments', Payment>('payments', id, (p) => ({ ...p, status: 'failed', failureReason: 'Already paid in another attempt. No money was taken.', completedAt: now() }));
    }
    const nums = await receiptNumbers();
    const paid = await patchById<'payments', Payment>('payments', id, (p) => ({ ...p, status: 'success', completedAt: now(), upiRef: digits(12), ...nums }));
    await fulfil(paid);
    return paid;
  }
  return patchById<'payments', Payment>('payments', id, (p) => ({ ...p, status: outcome, failureReason: reason ?? FAILURE[outcome], completedAt: now() }));
}

/** Pays instantly from wallet balance. */
export async function payWithWallet(userId: string, target: PayTarget): Promise<Payment> {
  if (target.purpose === 'wallet_topup') throw new ApiError('Use UPI to add money to the wallet.');
  if (target.paidWith) throw new ApiError('This is already paid.');
  await latency(400, 700);
  const user = (await read('users')).find((u) => u.id === userId);
  if (!user) throw new ApiError('User not found.');
  if (user.walletBalance < target.amount) throw new ApiError(`Wallet balance is ${rupees(user.walletBalance)}. Add ${rupees(target.amount - user.walletBalance)} more or pay by UPI.`, 'insufficient_balance');
  const nums = await receiptNumbers();
  const t = now();
  const p: Payment = {
    id: uid('p'),
    userId,
    purpose: target.purpose,
    refId: target.refId,
    amount: target.amount,
    method: 'wallet',
    status: 'success',
    txnId: txnId(),
    attempt: 1,
    createdAt: t,
    completedAt: t,
    ...nums,
  };
  await adjustWallet(userId, -target.amount, 'payment', `Paid for ${target.title}`, p.id);
  await write('payments', (all) => [p, ...all]);
  await fulfil(p);
  return p;
}

/** Background job: pending payments settle as success after PENDING_SETTLE_MS. */
export async function settlePendingPayments(): Promise<void> {
  const t = now();
  const pending = (await read('payments')).filter((p) => p.status === 'pending' && t - p.createdAt >= PENDING_SETTLE_MS);
  for (const p of pending) await resolvePayment(p.id, 'success');
}

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  upi_id: 'UPI ID',
  upi_app: 'UPI app',
  upi_qr: 'UPI QR',
  wallet: 'Wallet',
};
