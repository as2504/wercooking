import { useParams } from 'react-router-dom';
import type { Order, Payment, Subscription } from '@/types/models';
import { useUser } from '@/store/session';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { getPayment, METHOD_LABEL } from '@/api/payments';
import { getOrder } from '@/api/orders';
import { getSettings } from '@/api/menu';
import { getSubscription } from '@/api/subscriptions';
import { MEAL_LABEL, dateNumeric, dateShort, formatPhone, rupees2, time12 } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/Misc';
import { CardSkeleton, ErrorState, QueryView } from '@/components/ui/States';

interface ReceiptData {
  payment: Payment;
  order?: Order;
  sub?: Subscription;
  kitchen: { name: string; address: string; fssai: string };
}

export default function Receipt() {
  const { paymentId = '' } = useParams();
  const user = useUser();
  const q = useLiveQuery<ReceiptData>(
    async () => {
      const [payment, settings] = await Promise.all([getPayment(paymentId), getSettings()]);
      const order = payment.purpose === 'order' && payment.refId ? await getOrder(payment.refId) : undefined;
      const sub = payment.purpose === 'subscription' && payment.refId ? await getSubscription(payment.refId) : undefined;
      return { payment, order, sub, kitchen: { name: 'WeAreCooking Kitchen', address: settings.kitchenAddress, fssai: settings.fssaiNumber } };
    },
    ['payments', 'orders'],
    [paymentId],
  );

  return (
    <div className="pb-10">
      <div className="print:hidden">
        <PageHeader title="Receipt & invoice" back />
      </div>
      <div className="px-4 pt-3">
        <QueryView q={q} skeleton={<CardSkeleton lines={8} />}>
          {(d) =>
            d.payment.userId !== user.id ? (
              <ErrorState error={new Error('This receipt belongs to another account.')} />
            ) : d.payment.status !== 'success' ? (
              <ErrorState error={new Error('No receipt: this payment did not succeed.')} />
            ) : (
              <Invoice data={d} user={user} />
            )
          }
        </QueryView>
      </div>
    </div>
  );
}

function Invoice({ data, user }: { data: ReceiptData; user: ReturnType<typeof useUser> }) {
  const { payment, order, sub, kitchen } = data;
  const lines =
    order?.items.map((i) => ({ name: `${i.name}${i.box?.addons.length ? ` (+ ${i.box.addons.map((a) => a.name).join(', ')})` : ''}`, qty: i.qty, rate: i.unitPrice, amount: i.lineTotal })) ??
    (sub
      ? [{ name: `${sub.plan === 'weekly' ? 'Weekly' : 'Monthly'} ${sub.meal} plan, from ${dateShort(sub.startDate)}`, qty: sub.serviceDays, rate: sub.pricePerDay, amount: sub.amount }]
      : [{ name: 'Wallet top-up', qty: 1, rate: payment.amount, amount: payment.amount }]);
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const discount = order?.discount ?? 0;

  return (
    <article className="relative overflow-hidden rounded-2xl border border-line bg-white p-5 shadow-card print:border-0 print:shadow-none" aria-label="Invoice">
      <div className="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden="true">
        <span className="-rotate-12 select-none text-5xl font-black tracking-widest text-amber-500/15">SIMULATION</span>
      </div>
      <header className="flex items-start justify-between gap-3 border-b border-dashed border-line pb-4">
        <div>
          <div className="flex items-center gap-2">
            <img src="/favicon.svg" alt="" className="h-9 w-9 rounded-lg" />
            <p className="font-display text-xl font-bold">WeAreCooking</p>
          </div>
          <p className="mt-1 max-w-[220px] text-xs text-ink-muted">{kitchen.address}</p>
          <p className="text-xs text-ink-muted">FSSAI: {kitchen.fssai}</p>
        </div>
        <div className="text-right text-xs">
          <p className="font-bold uppercase tracking-wide text-ink-soft">Invoice</p>
          <p className="font-mono">{payment.invoiceNo}</p>
          <p className="mt-1 text-ink-muted">Receipt {payment.receiptNo}</p>
          <p className="text-ink-muted">{dateNumeric(payment.completedAt ?? payment.createdAt)}, {time12(payment.completedAt ?? payment.createdAt)}</p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 border-b border-dashed border-line py-4 text-sm">
        <div>
          <p className="text-xs font-semibold uppercase text-ink-muted">Billed to</p>
          <p className="font-semibold">{user.name}</p>
          <p className="text-ink-muted">{formatPhone(user.phone)}</p>
          <p className="text-ink-muted">{user.area}</p>
        </div>
        {order && (
          <div>
            <p className="text-xs font-semibold uppercase text-ink-muted">Order</p>
            <p className="font-semibold">#{order.number}</p>
            <p className="text-ink-muted">
              {MEAL_LABEL[order.mealType]}, {dateShort(order.pickupDate)}
            </p>
            <p className="text-ink-muted">Pickup {order.slot.label}</p>
          </div>
        )}
      </section>

      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase text-ink-muted">
            <th className="py-1 font-semibold">Item</th>
            <th className="py-1 text-right font-semibold">Qty</th>
            <th className="hidden py-1 text-right font-semibold sm:table-cell">Rate</th>
            <th className="py-1 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} className="border-t border-line align-top">
              <td className="py-2 pr-2">{l.name}</td>
              <td className="py-2 text-right">{l.qty}</td>
              <td className="hidden py-2 text-right sm:table-cell">{rupees2(l.rate)}</td>
              <td className="py-2 text-right">{rupees2(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
        <div className="flex justify-between">
          <dt>Subtotal</dt>
          <dd>{rupees2(subtotal)}</dd>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-leaf-700">
            <dt>Coupon {order?.couponCode}</dt>
            <dd>−{rupees2(discount)}</dd>
          </div>
        )}
        <div className="flex justify-between text-ink-muted">
          <dt>GST</dt>
          <dd>Not applicable*</dd>
        </div>
        <div className="flex justify-between text-base font-bold">
          <dt>Total paid</dt>
          <dd>{rupees2(payment.amount)}</dd>
        </div>
      </dl>

      <section className="mt-4 rounded-xl bg-cream p-3 text-xs">
        <p>
          Paid via <strong>{METHOD_LABEL[payment.method]}</strong>
          {payment.upiId ? ` (${payment.upiId})` : payment.appLabel ? ` (${payment.appLabel})` : ''}
        </p>
        <p className="font-mono">Txn ID: {payment.txnId}</p>
        {payment.upiRef && <p className="font-mono">UPI ref: {payment.upiRef}</p>}
      </section>

      <p className="mt-4 text-[11px] leading-relaxed text-ink-muted">
        *Prototype only. This is a SIMULATED receipt, not a tax invoice, and no money was transferred. A real deployment would issue invoices per GST rules once registered.
      </p>

      <div className="mt-4 flex gap-2 print:hidden">
        <Button variant="secondary" className="flex-1" onClick={() => window.print()}>
          <Icon name="download" className="h-4 w-4" /> Save as PDF
        </Button>
        {navigator.share && (
          <Button
            variant="ghost"
            onClick={() => void navigator.share({ title: `WeAreCooking receipt ${payment.receiptNo}`, text: `Paid ${rupees2(payment.amount)} · Txn ${payment.txnId} (simulated)` }).catch(() => undefined)}
          >
            <Icon name="share" className="h-4 w-4" /> Share
          </Button>
        )}
      </div>
    </article>
  );
}
