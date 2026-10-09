import { useState } from 'react';
import type { MealType } from '@/types/models';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { useCatalog } from '@/hooks/useCatalog';
import { useNow } from '@/hooks/useNow';
import { ordersForDate } from '@/api/admin';
import { MEALS, cutoffAt, slotsFor } from '@/lib/cutoff';
import { MEAL_EMOJI, MEAL_LABEL, dateShort, rupees, time12 } from '@/lib/format';
import { buildCookSheet, revenueOf, slotLoad } from '@/lib/kitchen';
import { Badge, SectionTitle } from '@/components/ui/Misc';
import { Button, ButtonLink } from '@/components/ui/Button';
import { EmptyState, ListSkeleton, QueryView } from '@/components/ui/States';
import { AdminHeader, DateStepper, Stat, useSelectedDate } from './common';

export default function Dashboard() {
  const date = useSelectedDate();
  const now = useNow(30_000);
  const catalog = useCatalog();
  const q = useLiveQuery(() => ordersForDate(date), ['orders'], [date]);
  const [meal, setMeal] = useState<MealType>('lunch');

  return (
    <div>
      <AdminHeader title="Kitchen" subtitle={dateShort(date)} action={<DateStepper />} />
      <div className="space-y-2 px-4 pt-3">
        <QueryView q={q} skeleton={<ListSkeleton count={3} />}>
          {(orders) => {
            const live = orders.filter((o) => o.status !== 'cancelled');
            const windows = catalog.data?.settings.windows;
            return (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Stat label="Revenue" value={rupees(revenueOf(orders))} sub="paid + plan meals" tone="green" />
                  <Stat label="Orders" value={live.length} sub={`${orders.length - live.length} cancelled`} />
                  <Stat label="To pick up" value={live.filter((o) => o.status !== 'picked_up').length} sub={`${live.filter((o) => o.status === 'ready').length} ready now`} tone="brand" />
                  <Stat label="Plan meals" value={live.filter((o) => o.source === 'subscription').length} sub="prepaid" />
                </div>

                <SectionTitle>By meal</SectionTitle>
                <div className="grid grid-cols-3 gap-2">
                  {MEALS.map((m) => {
                    const mo = live.filter((o) => o.mealType === m);
                    const cut = windows ? cutoffAt(m, date, windows) : 0;
                    return (
                      <button key={m} type="button" onClick={() => setMeal(m)} aria-pressed={meal === m} className={`rounded-2xl p-3 text-left ring-1 ${meal === m ? 'bg-ink text-white ring-ink' : 'bg-white ring-line'}`}>
                        <span className="text-xl" aria-hidden="true">{MEAL_EMOJI[m]}</span>
                        <span className="block text-sm font-semibold">{MEAL_LABEL[m]}</span>
                        <span className="block text-2xl font-bold">{mo.length}</span>
                        {windows && <span className={`block text-[11px] ${meal === m ? 'text-white/80' : 'text-ink-muted'}`}>{now >= cut ? 'Cutoff passed · locked' : `Open till ${time12(cut)}`}</span>}
                      </button>
                    );
                  })}
                </div>

                <CookSheetCard meal={meal} orders={orders} locked={!!windows && now >= cutoffAt(meal, date, windows)} />

                {windows && (
                  <>
                    <SectionTitle>Slot capacity · {MEAL_LABEL[meal]}</SectionTitle>
                    <div className="card space-y-2 p-4">
                      {slotsFor(meal, windows).map((s) => {
                        const load = slotLoad(orders, meal)[s.id] ?? 0;
                        const cap = windows[meal].slotCapacity;
                        const pct = Math.min(100, (load / cap) * 100);
                        return (
                          <div key={s.id} className="flex items-center gap-3 text-sm">
                            <span className="w-32 shrink-0 font-medium">{s.label}</span>
                            <div className="h-3 flex-1 overflow-hidden rounded-full bg-stone-100" role="meter" aria-valuemin={0} aria-valuemax={cap} aria-valuenow={load} aria-label={`${s.label} slot load`}>
                              <div className={`h-full rounded-full ${pct >= 100 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-leaf-600'}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="w-12 text-right tabular-nums">
                              {load}/{cap}
                            </span>
                          </div>
                        );
                      })}
                      <p className="pt-1 text-xs text-ink-muted">Daily cap {windows[meal].dailyCapacity} · change in Menu → Capacity</p>
                    </div>
                  </>
                )}
              </>
            );
          }}
        </QueryView>
      </div>
    </div>
  );
}

function CookSheetCard({ meal, orders, locked }: { meal: MealType; orders: Parameters<typeof buildCookSheet>[1]; locked: boolean }) {
  const sheet = buildCookSheet(meal, orders);
  return (
    <section className="card mt-4 p-4" aria-labelledby="cooksheet">
      <div className="flex items-center justify-between gap-2">
        <h2 id="cooksheet" className="text-lg font-semibold">
          🧑‍🍳 Cook sheet · {MEAL_LABEL[meal]}
        </h2>
        <Badge tone={locked ? 'green' : 'amber'}>{locked ? 'Final' : 'Still taking orders'}</Badge>
      </div>
      {sheet.orders === 0 ? (
        <EmptyState emoji="🍳" title="Nothing to cook yet" body={`No ${MEAL_LABEL[meal].toLowerCase()} orders for this day.`} />
      ) : (
        <>
          <p className="mt-1 text-sm text-ink-muted">{sheet.orders} orders</p>
          <ul className="mt-3 grid grid-cols-2 gap-2">
            {sheet.lines.map((l) => (
              <li key={l.key} className={`flex items-center gap-2 rounded-xl px-3 py-2 ${l.key.endsWith('_total') || l.key === 't_regular' ? 'bg-brand-50 ring-1 ring-brand-200' : 'bg-cream'}`}>
                <span className="text-xl" aria-hidden="true">{l.emoji}</span>
                <span className="min-w-0 flex-1 text-xs font-medium leading-tight">{l.label}</span>
                <span className="text-xl font-bold tabular-nums">{l.qty}</span>
              </li>
            ))}
          </ul>
          {sheet.notes.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Notes for the cook</p>
              <ul className="mt-1 space-y-1 text-sm">
                {sheet.notes.map((n) => (
                  <li key={n.number} className="rounded-lg bg-turmeric-100 px-3 py-1.5">
                    <strong>{n.number}</strong> {n.name}: {n.note}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <ButtonLink to="/admin/orders" variant="secondary" className="flex-1">
              Open orders board
            </ButtonLink>
            <Button variant="ghost" onClick={() => window.print()}>Print</Button>
          </div>
        </>
      )}
    </section>
  );
}

