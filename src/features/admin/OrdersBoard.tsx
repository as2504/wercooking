import { useState } from 'react';
import type { MealType, Order, OrderStatus } from '@/types/models';
import { toast } from '@/store/toast';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { useNow } from '@/hooks/useNow';
import { ordersForDate } from '@/api/admin';
import { advanceOrder, cancelOrder } from '@/api/orders';
import { MEAL_EMOJI, MEAL_LABEL, STATUS_LABEL, dateShort, time12, timeAgo } from '@/lib/format';
import { STATUS_FLOW, nextStatus } from '@/lib/orders';
import { ProofLabel } from '@/components/ProofLabel';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Misc';
import { Sheet } from '@/components/ui/Sheet';
import { ListSkeleton, QueryView } from '@/components/ui/States';
import { AdminHeader, DateStepper, useSelectedDate } from './common';

const ACTION: Partial<Record<OrderStatus, string>> = {
  placed: 'Accept',
  accepted: 'Start cooking',
  cooking: 'Mark packed',
  packed: 'Ready for pickup',
  ready: 'Picked up',
};

const COL_TONE: Record<OrderStatus, string> = {
  placed: 'bg-sky-50',
  accepted: 'bg-sky-50',
  cooking: 'bg-turmeric-100/60',
  packed: 'bg-turmeric-100/60',
  ready: 'bg-leaf-50',
  picked_up: 'bg-stone-100',
  cancelled: 'bg-red-50',
};

export default function OrdersBoard() {
  const date = useSelectedDate();
  const q = useLiveQuery(() => ordersForDate(date), ['orders'], [date]);
  const [meal, setMeal] = useState<MealType | 'all'>('all');
  const [cancelling, setCancelling] = useState<Order | null>(null);

  return (
    <div>
      <AdminHeader title="Orders board" subtitle={dateShort(date)} action={<DateStepper />} />
      <div className="px-4 pt-3">
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" role="radiogroup" aria-label="Filter by meal">
          {(['all', 'breakfast', 'lunch', 'dinner'] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={meal === m} onClick={() => setMeal(m)} className={`chip shrink-0 ${meal === m ? 'chip-on' : 'chip-off'}`}>
              {m === 'all' ? 'All meals' : `${MEAL_EMOJI[m]} ${MEAL_LABEL[m]}`}
              {q.data && <span className="text-xs text-ink-muted">{q.data.filter((o) => (m === 'all' || o.mealType === m) && o.status !== 'cancelled').length}</span>}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-muted">Tap a button to move an order forward. Customers see each change instantly, with “cooked at / packed at” timestamps.</p>
      </div>
      <QueryView q={q} skeleton={<div className="p-4"><ListSkeleton count={3} /></div>}>
        {(orders) => {
          const visible = orders.filter((o) => meal === 'all' || o.mealType === meal);
          const cancelled = visible.filter((o) => o.status === 'cancelled');
          return (
            <>
              <div className="no-scrollbar mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4" role="list" aria-label="Order statuses">
                {STATUS_FLOW.map((s) => {
                  const col = visible.filter((o) => o.status === s);
                  return (
                    <section key={s} role="listitem" aria-label={`${STATUS_LABEL[s]}, ${col.length} orders`} className={`w-[80vw] max-w-[300px] shrink-0 snap-start rounded-2xl p-2 ${COL_TONE[s]}`}>
                      <header className="flex items-center justify-between px-1 py-1">
                        <h2 className="font-sans text-sm font-bold">{STATUS_LABEL[s]}</h2>
                        <span className="rounded-full bg-white px-2 text-xs font-bold">{col.length}</span>
                      </header>
                      {col.length > 1 && ACTION[s] && s !== 'ready' && <BulkAdvance orders={col} label={ACTION[s]!} />}
                      <div className="mt-1 space-y-2">
                        {col.length === 0 ? (
                          <p className="px-1 py-6 text-center text-xs text-ink-muted">No orders</p>
                        ) : (
                          col.map((o) => <OrderTile key={o.id} order={o} onCancel={() => setCancelling(o)} />)
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
              {cancelled.length > 0 && (
                <p className="px-4 text-xs text-ink-muted">
                  {cancelled.length} cancelled: {cancelled.map((o) => o.number).join(', ')}
                </p>
              )}
            </>
          );
        }}
      </QueryView>
      <CancelSheet order={cancelling} onClose={() => setCancelling(null)} />
    </div>
  );
}

function OrderTile({ order, onCancel }: { order: Order; onCancel: () => void }) {
  const now = useNow(30_000);
  const [busy, setBusy] = useState(false);
  const action = ACTION[order.status];
  const advance = async () => {
    setBusy(true);
    try {
      const o = await advanceOrder(order.id);
      toast.success(`${o.number} → ${STATUS_LABEL[o.status]}`);
    } catch (e) {
      toast.error('Couldn’t update', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const last = order.statusHistory[order.statusHistory.length - 1];
  return (
    <article className="rounded-xl bg-white p-3 shadow-card" aria-label={`Order ${order.number}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold">
            {order.number} <span className="font-normal text-ink-muted">· {order.customerName.split(' ')[0]}</span>
          </p>
          <p className="text-xs text-ink-muted">
            {MEAL_EMOJI[order.mealType]} {order.slot.label}
          </p>
        </div>
        {order.source === 'subscription' ? <Badge tone="brand">Plan</Badge> : <Badge>₹{order.total}</Badge>}
      </div>
      <ul className="mt-2 space-y-0.5 text-sm">
        {order.items.map((i, k) => (
          <li key={k}>
            <span className="font-semibold">{i.qty}×</span> {i.box ? `Box: ${i.box.base.name}` : i.name.replace(' (plan)', '')}
            {i.box && i.box.addons.length > 0 && <span className="block pl-5 text-xs text-ink-muted">+ {i.box.addons.map((a) => a.name).join(', ')}</span>}
          </li>
        ))}
      </ul>
      {order.note && <p className="mt-2 rounded-md bg-turmeric-100 px-2 py-1 text-xs">📝 {order.note}</p>}
      {order.cookedAt && (
        <div className="mt-2">
          <ProofLabel order={order} compact />
        </div>
      )}
      <p className="mt-2 text-[11px] text-ink-muted">
        {STATUS_LABEL[last.status]} {timeAgo(last.at, now)} · code {order.pickupCode}
      </p>
      {action && (
        <div className="mt-2 flex gap-2">
          <Button size="sm" variant={order.status === 'packed' || order.status === 'ready' ? 'success' : 'primary'} className="flex-1" loading={busy} onClick={advance}>
            {action} →
          </Button>
          {order.status !== 'ready' && (
            <Button size="sm" variant="ghost" onClick={onCancel} aria-label={`Cancel ${order.number}`}>
              ✕
            </Button>
          )}
        </div>
      )}
      {order.status === 'picked_up' && <p className="mt-1 text-xs text-leaf-700">✓ Picked up {time12(last.at)}</p>}
    </article>
  );
}

function BulkAdvance({ orders, label }: { orders: Order[]; label: string }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    let ok = 0;
    for (const o of orders) {
      try {
        await advanceOrder(o.id);
        ok++;
      } catch {
        /* skip orders that changed meanwhile */
      }
    }
    setBusy(false);
    toast.success(`${label}: ${ok} order${ok === 1 ? '' : 's'}`, nextStatus(orders[0].status) ? `Moved to ${STATUS_LABEL[nextStatus(orders[0].status)!]}` : undefined);
  };
  return (
    <Button size="sm" variant="secondary" className="mb-1 w-full" loading={busy} onClick={run}>
      {label} all ({orders.length})
    </Button>
  );
}

const REASONS = ['Item ran out', 'Kitchen issue', 'Customer requested by phone', 'Duplicate order'];

function CancelSheet({ order, onClose }: { order: Order | null; onClose: () => void }) {
  const [reason, setReason] = useState(REASONS[0]);
  const [busy, setBusy] = useState(false);
  return (
    <Sheet
      open={!!order}
      onClose={onClose}
      title={order ? `Cancel ${order.number}?` : ''}
      footer={
        <Button
          variant="danger"
          size="lg"
          loading={busy}
          onClick={async () => {
            if (!order) return;
            setBusy(true);
            try {
              await cancelOrder(order.id, 'kitchen', reason);
              toast.success(`${order.number} cancelled`, order.paymentState === 'paid' ? `₹${order.total} refunded to customer wallet` : undefined);
              onClose();
            } catch (e) {
              toast.error('Couldn’t cancel', (e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Cancel order{order?.paymentState === 'paid' ? ` & refund ₹${order.total}` : ''}
        </Button>
      }
    >
      <p className="text-sm text-ink-soft">The customer is notified immediately{order?.paymentState === 'paid' ? ' and refunded to their wallet' : ''}.</p>
      <fieldset className="mt-3 space-y-2">
        <legend className="label">Reason</legend>
        {REASONS.map((r) => (
          <label key={r} className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-line bg-white px-4">
            <input type="radio" name="kreason" checked={reason === r} onChange={() => setReason(r)} className="h-4 w-4 accent-brand-600" />
            {r}
          </label>
        ))}
      </fieldset>
    </Sheet>
  );
}
