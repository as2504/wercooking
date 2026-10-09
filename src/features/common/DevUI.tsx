// Design-system and data-layer check page (/dev/ui). Not linked from the customer app.
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ChoiceChips, TextField } from '@/components/ui/Field';
import { Badge, PageHeader, Segmented, SimulationBadge, Stepper } from '@/components/ui/Misc';
import { Sheet } from '@/components/ui/Sheet';
import { CardSkeleton, EmptyState, ErrorState, QueryView } from '@/components/ui/States';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { useNow } from '@/hooks/useNow';
import { read } from '@/api/base';
import { toast } from '@/store/toast';
import { MEALS, nextCutoff, nextOrderableDate, cutoffAt } from '@/lib/cutoff';
import { dateTime, duration, MEAL_LABEL, relativeDay, rupees } from '@/lib/format';
import { DEFAULT_WINDOWS } from '@/lib/cutoff';

export default function DevUI() {
  const [qty, setQty] = useState(1);
  const [seg, setSeg] = useState<'a' | 'b'>('a');
  const [diet, setDiet] = useState<'veg' | 'egg' | null>(null);
  const [open, setOpen] = useState(false);
  const now = useNow();
  const counts = useLiveQuery(
    async () => {
      const [orders, users, updates, subs, reviews] = await Promise.all([read('orders'), read('users'), read('kitchenUpdates'), read('subscriptions'), read('reviews')]);
      return { orders: orders.length, users: users.length, updates: updates.length, subs: subs.length, reviews: reviews.length };
    },
    ['orders', 'users', 'kitchenUpdates', 'subscriptions', 'reviews'],
  );
  const nc = nextCutoff(now, DEFAULT_WINDOWS);

  return (
    <div className="mx-auto max-w-screen-sm pb-16">
      <PageHeader title="Design system" subtitle="Dev check page" back="/" />
      <div className="space-y-5 p-4">
        <section className="card space-y-2 p-4">
          <h2 className="font-semibold">Clock (IST)</h2>
          <p className="text-sm">Now: {dateTime(now)}</p>
          <p className="text-sm">
            Next cutoff: {MEAL_LABEL[nc.meal]} for {relativeDay(nc.date, now)}, in {duration(nc.remainingMs)}
          </p>
          {MEALS.map((m) => {
            const d = nextOrderableDate(m, now, DEFAULT_WINDOWS);
            return (
              <p key={m} className="text-sm text-ink-muted">
                {MEAL_LABEL[m]}: next orderable {relativeDay(d, now)} (cutoff {dateTime(cutoffAt(m, d, DEFAULT_WINDOWS))})
              </p>
            );
          })}
        </section>
        <section className="card p-4">
          <h2 className="mb-2 font-semibold">Seeded data</h2>
          <QueryView q={counts} skeleton={<CardSkeleton lines={2} />}>
            {(c) => <p className="text-sm">{Object.entries(c).map(([k, v]) => `${k}: ${v}`).join(' · ')}</p>}
          </QueryView>
        </section>
        <div className="flex flex-wrap gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="success">Success</Button>
          <Button variant="danger">Danger</Button>
          <Button loading>Loading</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>Neutral</Badge>
          <Badge tone="brand">Brand</Badge>
          <Badge tone="green">Fresh</Badge>
          <Badge tone="amber">3 left</Badge>
          <Badge tone="red">Sold out</Badge>
          <SimulationBadge />
        </div>
        <Stepper value={qty} onChange={setQty} label="Thali" min={1} />
        <p className="text-sm">Total: {rupees(qty * 110)}</p>
        <Segmented label="demo" value={seg} onChange={setSeg} options={[{ value: 'a', label: 'Single order' }, { value: 'b', label: 'Subscription' }]} />
        <ChoiceChips label="Diet" value={diet} onChange={setDiet} options={[{ value: 'veg', label: '🟢 Veg' }, { value: 'egg', label: '🥚 Egg' }]} error={diet ? null : 'Pick one'} />
        <TextField label="Phone" prefix="+91" inputMode="numeric" placeholder="98XXXXXXXX" hint="We'll send a code" />
        <TextField label="With error" error="This field is required" />
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setOpen(true)}>Open sheet</Button>
          <Button variant="secondary" onClick={() => toast.success('Saved', 'Your changes are saved.')}>Toast</Button>
          <Button variant="secondary" onClick={() => toast.error('Payment failed', 'Insufficient balance')}>Error toast</Button>
        </div>
        <CardSkeleton />
        <EmptyState title="No orders yet" body="Your first thali is a tap away." emoji="🍛" />
        <ErrorState error={new Error('Network unavailable')} onRetry={() => toast.info('Retrying')} />
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title="Bottom sheet" footer={<Button size="lg" onClick={() => setOpen(false)}>Done</Button>}>
        <p>Sheet content. Press Esc to close.</p>
      </Sheet>
    </div>
  );
}
