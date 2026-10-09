import { useCallback, useRef, useState, type FormEvent } from 'react';
import type { Order } from '@/types/models';
import { toast } from '@/store/toast';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { useNow } from '@/hooks/useNow';
import { findByPickupCode, getOrder, setOrderStatus } from '@/api/orders';
import { ordersForDate } from '@/api/admin';
import { MEAL_EMOJI, MEAL_LABEL, STATUS_LABEL, rupees, time12 } from '@/lib/format';
import { istDate } from '@/lib/time';
import { QRScanner } from '@/components/QRScanner';
import { StatusBadge } from '@/components/OrderBits';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Badge, SectionTitle } from '@/components/ui/Misc';
import { AdminHeader } from './common';

export default function Pickup() {
  const now = useNow(30_000);
  const today = istDate(now);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const ready = useLiveQuery(async () => (await ordersForDate(today)).filter((o) => o.status === 'ready'), ['orders'], [today]);

  const lookup = async (value: string) => {
    setError(null);
    setOrder(null);
    setBusy(true);
    try {
      setOrder(await findByPickupCode(value, today));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(code)) return setError('Enter the 4-digit pickup code.');
    void lookup(code);
  };

  const onScan = useCallback(
    async (text: string) => {
      setScanning(false);
      const [tag, id, c] = text.split('|');
      if (tag !== 'WAC' || !id || !c) return setError('That QR code isn’t a WeAreCooking pickup code.');
      setCode(c);
      try {
        const o = await getOrder(id);
        if (o.pickupCode !== c) throw new Error('QR code doesn’t match the order.');
        if (o.pickupDate !== today) throw new Error(`This order is for ${o.pickupDate}, not today.`);
        setOrder(o);
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [today],
  );

  const handOver = async () => {
    if (!order) return;
    setBusy(true);
    try {
      const o = await setOrderStatus(order.id, 'picked_up');
      toast.success(`${o.number} handed over ✅`, `${o.customerName} · ${MEAL_LABEL[o.mealType]}`);
      setOrder(null);
      setCode('');
      input.current?.focus();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const notReady = order && order.status !== 'ready';

  return (
    <div>
      <AdminHeader title="Pickup counter" subtitle="Verify code, hand over meal" />
      <div className="space-y-4 px-4 pt-4">
        {scanning ? (
          <QRScanner onResult={onScan} onClose={() => setScanning(false)} />
        ) : (
          <form onSubmit={submit} className="card p-4" noValidate>
            <label htmlFor="pcode" className="label">
              Customer’s pickup code
            </label>
            <div className="flex gap-2">
              <input
                id="pcode"
                ref={input}
                inputMode="numeric"
                autoComplete="off"
                maxLength={4}
                value={code}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setCode(v);
                  setError(null);
                  if (v.length === 4) void lookup(v);
                }}
                className={`input flex-1 text-center font-mono text-3xl font-bold tracking-[0.4em] ${error ? 'input-error' : ''}`}
                placeholder="••••"
                aria-invalid={!!error}
                aria-describedby={error ? 'pcode-err' : undefined}
                autoFocus
              />
              <Button type="button" variant="secondary" onClick={() => setScanning(true)} aria-label="Scan QR with camera">
                <Icon name="scan" className="h-5 w-5" />
              </Button>
            </div>
            {error && (
              <p id="pcode-err" className="mt-2 text-sm font-medium text-red-700" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="mt-3" loading={busy && !order}>
              Find order
            </Button>
          </form>
        )}

        {order && (
          <section className={`rounded-2xl p-4 ring-2 ${notReady ? 'bg-turmeric-100 ring-amber-400' : 'bg-leaf-50 ring-leaf-500'}`} aria-live="polite">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-lg font-bold">
                  {order.number} · {order.customerName}
                </p>
                <p className="text-sm text-ink-soft">
                  {MEAL_EMOJI[order.mealType]} {MEAL_LABEL[order.mealType]} · {order.slot.label}
                </p>
              </div>
              <StatusBadge order={order} />
            </div>
            <ul className="mt-3 space-y-1 text-sm">
              {order.items.map((i, k) => (
                <li key={k}>
                  <strong>{i.qty}×</strong> {i.name}
                  {i.box && i.box.addons.length > 0 && <span className="text-ink-muted"> + {i.box.addons.map((a) => a.name).join(', ')}</span>}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm">{order.source === 'subscription' ? <Badge tone="brand">Prepaid plan</Badge> : <Badge tone="green">Paid {rupees(order.total)}</Badge>}</p>
            {notReady && <p className="mt-3 text-sm font-semibold text-amber-900">Status is “{STATUS_LABEL[order.status]}”, not “Ready”. Hand over only if the meal is packed.</p>}
            <Button size="lg" variant="success" className="mt-4" loading={busy} onClick={handOver} disabled={order.status === 'placed' || order.status === 'accepted'}>
              ✓ Mark picked up
            </Button>
          </section>
        )}

        <SectionTitle>Ready at the counter</SectionTitle>
        {ready.data && ready.data.length === 0 && <p className="text-sm text-ink-muted">Nothing waiting right now.</p>}
        <ul className="space-y-2">
          {ready.data?.map((o) => (
            <li key={o.id}>
              <button type="button" onClick={() => { setCode(o.pickupCode); setOrder(o); setError(null); }} className="card flex w-full items-center gap-3 p-3 text-left">
                <span className="font-mono text-lg font-bold">{o.pickupCode}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{o.customerName}</span>
                  <span className="block text-xs text-ink-muted">
                    {o.number} · {o.slot.label} · ready since {time12(o.statusHistory.at(-1)!.at)}
                  </span>
                </span>
                <Icon name="chevron" className="h-4 w-4 text-ink-muted" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
