import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Order, OrderStatus } from '@/types/models';
import { useUser } from '@/store/session';
import { toast } from '@/store/toast';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { useCatalog } from '@/hooks/useCatalog';
import { useNow } from '@/hooks/useNow';
import { useReorder } from '@/hooks/useReorder';
import { canCustomerCancel, cancelOrder, getOrder } from '@/api/orders';
import { getReview, rateOrder } from '@/api/reviews';
import { cutoffAt } from '@/lib/cutoff';
import { MEAL_EMOJI, MEAL_LABEL, STATUS_LABEL, dateShort, relativeDay, rupees, time12 } from '@/lib/format';
import { STATUS_FLOW } from '@/lib/orders';
import { ProofLabel } from '@/components/ProofLabel';
import { QR } from '@/components/QR';
import { StatusBadge } from '@/components/OrderBits';
import { Button, ButtonLink } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { PageHeader, SectionTitle } from '@/components/ui/Misc';
import { Sheet } from '@/components/ui/Sheet';
import { CardSkeleton, ErrorState, QueryView } from '@/components/ui/States';

const STATUS_HINT: Record<OrderStatus, string> = {
  placed: 'Waiting for the kitchen to confirm.',
  accepted: 'Confirmed! It goes on the stove closer to your slot.',
  cooking: 'Tai is cooking your meal right now.',
  packed: 'Packed hot and sealed. Almost ready.',
  ready: 'Ready at the counter. Show your code.',
  picked_up: 'Picked up. Enjoy your meal!',
  cancelled: 'This order was cancelled.',
};

export default function OrderDetail() {
  const { id = '' } = useParams();
  const q = useLiveQuery(() => getOrder(id), ['orders'], [id]);
  return (
    <div className="pb-10">
      <PageHeader title={q.data ? `Order ${q.data.number}` : 'Order'} back="/orders" />
      <div className="px-4 pt-3">
        <QueryView q={q} skeleton={<div className="space-y-3"><CardSkeleton lines={4} /><CardSkeleton /></div>}>
          {(o) => <OrderBody order={o} />}
        </QueryView>
      </div>
    </div>
  );
}

function OrderBody({ order }: { order: Order }) {
  const user = useUser();
  const now = useNow(10_000);
  const catalog = useCatalog();
  const reorder = useReorder();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const review = useLiveQuery(() => (order.reviewId ? getReview(order.reviewId) : Promise.resolve(undefined)), ['reviews'], [order.reviewId]);

  if (order.userId !== user.id) return <ErrorState error={new Error('This order belongs to another account.')} />;

  const unpaid = order.paymentState === 'unpaid' && order.status === 'placed';
  const cancelled = order.status === 'cancelled';
  const windows = catalog.data?.settings.windows;
  const cancellable = !!windows && canCustomerCancel(order, now, windows);
  const reached = new Map(order.statusHistory.map((h) => [h.status, h.at]));
  const currentIdx = STATUS_FLOW.indexOf(order.status);

  return (
    <div className="space-y-4">
      {unpaid && (
        <div className="rounded-2xl border border-amber-300 bg-turmeric-100 p-4" role="alert">
          <p className="font-bold text-amber-900">Payment not completed</p>
          <p className="text-sm text-amber-900">Your slot is held for a few minutes. Complete payment to confirm the order.</p>
          <ButtonLink to={`/pay/order/${order.id}`} className="mt-3">
            Complete payment · {rupees(order.total)}
          </ButtonLink>
        </div>
      )}

      <section className={`rounded-3xl p-5 ${cancelled ? 'bg-red-50 ring-1 ring-red-200' : order.status === 'ready' ? 'bg-leaf-600 text-white' : 'bg-white ring-1 ring-line'}`} aria-live="polite">
        <div className="flex items-center justify-between">
          <p className={`text-sm font-semibold ${order.status === 'ready' ? 'text-white/85' : 'text-ink-muted'}`}>
            {MEAL_EMOJI[order.mealType]} {MEAL_LABEL[order.mealType]} · {relativeDay(order.pickupDate, now)} · {order.slot.label}
          </p>
          {order.status !== 'ready' && <StatusBadge order={order} />}
        </div>
        <h2 className="mt-2 text-2xl font-bold">{unpaid ? 'Awaiting payment' : STATUS_LABEL[order.status]}</h2>
        <p className={`text-sm ${order.status === 'ready' ? 'text-white/90' : 'text-ink-soft'}`}>{unpaid ? 'Complete payment to send it to the kitchen.' : STATUS_HINT[order.status]}</p>
        {cancelled && order.cancelReason && <p className="mt-1 text-sm text-red-800">Reason: {order.cancelReason}{order.paymentState === 'refunded' ? ` · ${rupees(order.total)} refunded to wallet` : ''}</p>}

        {!cancelled && !unpaid && order.status !== 'picked_up' && (
          <div className={`mt-4 flex items-center gap-4 rounded-2xl p-3 ${order.status === 'ready' ? 'bg-white text-ink' : 'bg-cream'}`}>
            <div className="h-[120px] w-[120px] shrink-0">
              <QR value={`WAC|${order.id}|${order.pickupCode}`} size={120} label={`Pickup QR code for order ${order.number}`} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Pickup code</p>
              <p className="font-mono text-4xl font-bold tracking-[0.2em]" aria-label={`Pickup code ${order.pickupCode.split('').join(' ')}`}>
                {order.pickupCode}
              </p>
              <p className="text-xs text-ink-muted">Show this at the counter</p>
            </div>
          </div>
        )}
      </section>

      {!cancelled && !unpaid && <ProofLabel order={order} />}

      {!cancelled && !unpaid && (
        <section className="card p-4" aria-label="Order progress">
          <ol className="relative space-y-4">
            {STATUS_FLOW.map((s, i) => {
              const at = reached.get(s);
              const done = i <= currentIdx;
              return (
                <li key={s} className="relative flex items-start gap-3">
                  <span className={`relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full ${done ? 'bg-leaf-600 text-white' : 'bg-stone-200 text-ink-muted'}`}>
                    {done ? <Icon name="check" className="h-4 w-4" /> : <span className="text-xs font-bold">{i + 1}</span>}
                  </span>
                  {i < STATUS_FLOW.length - 1 && <span className={`absolute -bottom-4 left-[13px] top-7 w-0.5 ${i < currentIdx ? 'bg-leaf-600' : 'bg-stone-200'}`} aria-hidden="true" />}
                  <div className="flex flex-1 items-center justify-between pt-0.5">
                    <span className={`text-sm ${done ? 'font-semibold' : 'text-ink-muted'}`}>{STATUS_LABEL[s]}</span>
                    {at && <span className="text-xs text-ink-muted">{time12(at)}</span>}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {order.status === 'picked_up' && (
        <section className="card p-4">
          {review.data ? (
            <div>
              <p className="text-sm font-semibold">Your rating</p>
              <p className="text-2xl" aria-label={`${review.data.stars} out of 5 stars`}>
                {'★'.repeat(review.data.stars)}
                <span className="text-stone-300">{'★'.repeat(5 - review.data.stars)}</span>
              </p>
              {review.data.comment && <p className="mt-1 text-sm text-ink-soft">“{review.data.comment}”</p>}
            </div>
          ) : order.reviewId ? (
            <CardSkeleton lines={1} />
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-3xl" aria-hidden="true">⭐</span>
              <div className="flex-1">
                <p className="font-semibold">How was your meal?</p>
                <p className="text-sm text-ink-muted">Your rating goes straight to Tai.</p>
              </div>
              <Button size="sm" onClick={() => setRateOpen(true)}>
                Rate
              </Button>
            </div>
          )}
        </section>
      )}

      <SectionTitle>Items</SectionTitle>
      <section className="card p-4">
        <ul className="space-y-3">
          {order.items.map((i, idx) => (
            <li key={idx} className="flex gap-3 text-sm">
              <span className="text-2xl" aria-hidden="true">{i.emoji}</span>
              <div className="flex-1">
                <p className="font-semibold">
                  {i.qty}× {i.name}
                </p>
                {i.box && i.box.addons.length > 0 && <p className="text-xs text-ink-muted">+ {i.box.addons.map((a) => `${a.name} (${rupees(a.price)})`).join(', ')}</p>}
              </div>
              <span className="font-semibold">{order.source === 'subscription' ? 'Plan' : rupees(i.lineTotal)}</span>
            </li>
          ))}
        </ul>
        {order.note && <p className="mt-3 rounded-lg bg-cream px-3 py-2 text-xs">📝 {order.note}</p>}
        {order.source === 'single' && (
          <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd>{rupees(order.subtotal)}</dd>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-leaf-700">
                <dt>Coupon {order.couponCode}</dt>
                <dd>−{rupees(order.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between font-bold">
              <dt>Total</dt>
              <dd>{rupees(order.total)}</dd>
            </div>
          </dl>
        )}
        <p className="mt-3 text-xs text-ink-muted">
          Ordered {dateShort(order.createdAt)}, {time12(order.createdAt)} · #{order.number}
        </p>
        {order.paymentId && (
          <Link to={`/receipt/${order.paymentId}`} className="mt-3 flex items-center gap-2 text-sm font-semibold text-brand-700">
            <Icon name="receipt" className="h-4 w-4" /> View receipt & invoice
          </Link>
        )}
      </section>

      <div className="flex flex-col gap-2">
        {order.source === 'single' && (order.status === 'picked_up' || cancelled) && (
          <Button variant="secondary" size="lg" onClick={() => reorder(order)}>
            <Icon name="refresh" className="h-4 w-4" /> Reorder
          </Button>
        )}
        {cancellable && (
          <Button variant="ghost" size="lg" className="!text-red-700" onClick={() => setCancelOpen(true)}>
            Cancel order
          </Button>
        )}
        {!cancellable && !cancelled && order.status !== 'picked_up' && !unpaid && windows && order.source === 'single' && (
          <p className="text-center text-xs text-ink-muted">Cancellation closed at {time12(cutoffAt(order.mealType, order.pickupDate, windows))} (cutoff).</p>
        )}
      </div>

      <CancelSheet open={cancelOpen} onClose={() => setCancelOpen(false)} order={order} />
      <RateSheet open={rateOpen} onClose={() => setRateOpen(false)} order={order} />
    </div>
  );
}

const REASONS = ['Change of plans', 'Ordered by mistake', 'Want a different meal', 'Other'];

function CancelSheet({ open, onClose, order }: { open: boolean; onClose: () => void; order: Order }) {
  const [reason, setReason] = useState(REASONS[0]);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await cancelOrder(order.id, 'customer', reason);
      toast.success('Order cancelled', order.paymentState === 'paid' ? `${rupees(order.total)} refunded to your wallet.` : undefined);
      onClose();
    } catch (e) {
      toast.error('Could not cancel', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Cancel this order?"
      footer={
        <Button variant="danger" size="lg" loading={busy} onClick={submit}>
          Cancel order & refund {rupees(order.total)}
        </Button>
      }
    >
      <p className="text-sm text-ink-soft">The full amount goes back to your WeAreCooking wallet instantly (simulated).</p>
      <fieldset className="mt-4 space-y-2">
        <legend className="label">Reason</legend>
        {REASONS.map((r) => (
          <label key={r} className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-line bg-white px-4">
            <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} className="h-4 w-4 accent-brand-600" />
            {r}
          </label>
        ))}
      </fieldset>
    </Sheet>
  );
}

function RateSheet({ open, onClose, order }: { open: boolean; onClose: () => void; order: Order }) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!stars) return setError('Tap a star to rate.');
    setBusy(true);
    try {
      await rateOrder(order, stars, comment);
      toast.success('Thanks for rating!', 'Tai reads every review 🙏');
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Rate your meal" footer={<Button size="lg" loading={busy} onClick={submit}>Submit rating</Button>}>
      <div className="flex justify-center gap-1" role="radiogroup" aria-label="Stars">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={stars === n}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            onClick={() => {
              setStars(n);
              setError(null);
            }}
            className={`grid h-12 w-12 place-items-center text-4xl transition ${n <= stars ? 'text-turmeric-500' : 'text-stone-300'}`}
          >
            ★
          </button>
        ))}
      </div>
      <p className="mt-1 text-center text-sm text-ink-muted">{['Tap to rate', 'Not good', 'Okay', 'Good', 'Very good', 'Loved it!'][stars]}</p>
      {error && <p className="mt-2 text-center text-sm font-medium text-red-700" role="alert">{error}</p>}
      <div className="mt-4">
        <TextArea label="Comment (optional)" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={300} placeholder="What did you like? What can be better?" hint={`${comment.length}/300`} />
      </div>
    </Sheet>
  );
}
