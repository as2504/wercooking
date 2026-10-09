import { Link, useNavigate } from 'react-router-dom';
import type { MealType } from '@/types/models';
import { useUser } from '@/store/session';
import { useCart, cartCount } from '@/store/cart';
import { useCatalog } from '@/hooks/useCatalog';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { useNow } from '@/hooks/useNow';
import { useReorder } from '@/hooks/useReorder';
import { listMyOrders } from '@/api/orders';
import { listUpdates } from '@/api/kitchenUpdates';
import { listNotifications } from '@/api/notifications';
import { listMySubscriptions } from '@/api/subscriptions';
import { MEALS, cutoffAt, nextCutoff, nextOrderableDate } from '@/lib/cutoff';
import { MEAL_EMOJI, MEAL_LABEL, duration, relativeDay, rupees, time12 } from '@/lib/format';
import { mealLineup } from '@/lib/menu';
import { isActiveOrder, itemsSummary } from '@/lib/orders';
import { planQuote } from '@/lib/pricing';
import { CountdownChip } from '@/components/CountdownChip';
import { KitchenUpdateCard } from '@/components/KitchenUpdateCard';
import { OrderCard } from '@/components/OrderBits';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { SectionTitle } from '@/components/ui/Misc';
import { CardSkeleton, ErrorState, Skeleton } from '@/components/ui/States';
import { InstallBanner } from '@/components/InstallPrompt';

export default function Home() {
  const user = useUser();
  const now = useNow(15_000);
  const navigate = useNavigate();
  const reorder = useReorder();
  const catalog = useCatalog();
  const orders = useLiveQuery(() => listMyOrders(user.id), ['orders'], [user.id]);
  const updates = useLiveQuery(listUpdates, ['kitchenUpdates']);
  const notes = useLiveQuery(() => listNotifications(user.id), ['notifications'], [user.id]);
  const subs = useLiveQuery(() => listMySubscriptions(user.id), ['subscriptions'], [user.id]);
  const lines = useCart((s) => s.lines);
  const setBrowse = useCart((s) => s.setBrowse);
  const unread = notes.data?.filter((n) => !n.read).length ?? 0;
  const count = cartCount(lines);

  const openMeal = (meal: MealType, date: string) => {
    setBrowse(meal, date);
    navigate(meal === 'breakfast' ? '/menu/box' : '/menu');
  };

  const active = (orders.data ?? []).filter((o) => isActiveOrder(o) && o.paymentState !== 'unpaid');
  const past = (orders.data ?? []).filter((o) => o.status === 'picked_up' && o.source === 'single').slice(0, 2);
  const latestUpdate = updates.data?.[0];
  const activePlan = subs.data?.find((s) => s.status === 'active' || s.status === 'paused');

  return (
    <div>
      <header className="safe-top bg-gradient-to-b from-brand-50 to-cream px-4 pb-2">
        <div className="flex min-h-[64px] items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-ink-muted">Namaste 🙏</p>
            <h1 className="truncate text-2xl font-bold">{user.name.split(' ')[0]}</h1>
          </div>
          <Link to="/notifications" className="relative grid h-11 w-11 place-items-center rounded-full bg-white shadow-card" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
            <Icon name="bell" className="h-5 w-5" />
            {unread > 0 && <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-brand-600 ring-2 ring-white" />}
          </Link>
          <Link to="/cart" className="relative grid h-11 w-11 place-items-center rounded-full bg-white shadow-card" aria-label={`Cart, ${count} items`}>
            <Icon name="cart" className="h-5 w-5" />
            {count > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-[20px] rounded-full bg-brand-600 px-1 text-center text-[11px] font-bold leading-5 text-white">{count}</span>}
          </Link>
        </div>
        <p className="flex items-center gap-1 text-xs text-ink-muted">
          📍 {user.area} · Pickup only
        </p>
      </header>

      <div className="px-4">
        {catalog.error ? (
          <ErrorState error={catalog.error} onRetry={catalog.reload} />
        ) : !catalog.data ? (
          <Skeleton className="mt-3 h-44" />
        ) : (
          (() => {
            const { windows } = catalog.data.settings;
            const nc = nextCutoff(now, windows);
            return (
              <>
                <section className="mt-3 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 p-5 text-white shadow-card" aria-labelledby="next-meal">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-brand-100">
                      {MEAL_EMOJI[nc.meal]} Next up · {relativeDay(nc.date, now)}
                    </p>
                    <CountdownChip remainingMs={nc.remainingMs} />
                  </div>
                  <h2 id="next-meal" className="mt-2 text-2xl font-bold">
                    {MEAL_LABEL[nc.meal]} {nc.meal === 'breakfast' ? 'Box' : 'Thali'}
                  </h2>
                  <p className="mt-1 text-sm text-brand-100">{mealLineup(nc.meal, nc.date, catalog.data.weekly, catalog.data.index)}</p>
                  <p className="mt-1 text-xs text-brand-100/80">Orders close at {time12(nc.cutoff)}</p>
                  <Button variant="secondary" className="mt-4 !border-0 !text-brand-800" onClick={() => openMeal(nc.meal, nc.date)}>
                    {nc.meal === 'breakfast' ? 'Build my box' : `Order ${MEAL_LABEL[nc.meal].toLowerCase()}`} <Icon name="chevron" className="h-4 w-4" />
                  </Button>
                </section>

                <div className="mt-3 grid grid-cols-3 gap-2" aria-label="Meals">
                  {MEALS.map((m) => {
                    const d = nextOrderableDate(m, now, windows);
                    const left = cutoffAt(m, d, windows) - now;
                    return (
                      <button key={m} type="button" aria-label={`${MEAL_LABEL[m]} for ${relativeDay(d, now)}, closes in ${duration(left)}`} onClick={() => openMeal(m, d)} className="card flex flex-col items-start p-3 text-left transition hover:border-brand-300">
                        <span className="text-2xl" aria-hidden="true">{MEAL_EMOJI[m]}</span>
                        <span className="mt-1 text-sm font-bold">{MEAL_LABEL[m]}</span>
                        <span className="text-[11px] text-ink-muted">{relativeDay(d, now)}</span>
                        <span className="text-[11px] font-semibold text-brand-700">closes in {duration(left)}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            );
          })()
        )}

        {active.length > 0 && (
          <>
            <SectionTitle>Your active orders</SectionTitle>
            <div className="space-y-3">
              {active.slice(0, 3).map((o) => (
                <OrderCard key={o.id} order={o} nowMs={now} action={o.status === 'ready' ? <p className="text-sm font-semibold text-leaf-700">Show code <span className="font-mono text-lg">{o.pickupCode}</span> at the counter</p> : undefined} />
              ))}
            </div>
          </>
        )}

        <InstallBanner />

        {subs.data && !activePlan && catalog.data && (
          <Link to="/plans/new" className="mt-4 flex items-center gap-4 rounded-2xl border border-leaf-500/30 bg-leaf-50 p-4">
            <span className="text-3xl" aria-hidden="true">📅</span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold text-leaf-700">No daily hassle. Subscribe & save.</span>
              <span className="block text-sm text-ink-soft">
                Monthly lunch at {rupees(catalog.data.settings.planPrices.monthly.lunch)}/meal · save {rupees(planQuote('monthly', 'lunch', catalog.data.settings.planPrices).savings)}
              </span>
            </span>
            <Icon name="chevron" className="h-5 w-5 text-leaf-700" />
          </Link>
        )}
        {activePlan && (
          <Link to={`/plans/${activePlan.id}`} className="mt-4 flex items-center gap-4 rounded-2xl border border-leaf-500/30 bg-leaf-50 p-4">
            <span className="text-3xl" aria-hidden="true">✅</span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold text-leaf-700">{activePlan.status === 'paused' ? 'Your plan is paused' : 'Your plan is active'}</span>
              <span className="block text-sm text-ink-soft">
                {activePlan.days.filter((d) => d.state === 'upcoming').length} meals upcoming · skip or pause before cutoff
              </span>
            </span>
            <Icon name="chevron" className="h-5 w-5 text-leaf-700" />
          </Link>
        )}

        <SectionTitle action={<Link to="/updates" className="text-sm font-semibold text-brand-700">See all</Link>}>Today in the kitchen</SectionTitle>
        {updates.error ? (
          <ErrorState error={updates.error} onRetry={updates.reload} />
        ) : !updates.data ? (
          <CardSkeleton />
        ) : latestUpdate ? (
          <Link to="/updates" className="block">
            <KitchenUpdateCard update={latestUpdate} nowMs={now} userId={user.id} compact />
          </Link>
        ) : (
          <p className="card p-4 text-sm text-ink-muted">Tai posts the day's kitchen update by 10:30 AM.</p>
        )}

        {past.length > 0 && (
          <>
            <SectionTitle>Order again</SectionTitle>
            <div className="space-y-2">
              {past.map((o) => (
                <div key={o.id} className="card flex items-center gap-3 p-3">
                  <span className="text-3xl" aria-hidden="true">{o.items[0]?.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{itemsSummary(o.items)}</p>
                    <p className="text-xs text-ink-muted">{MEAL_LABEL[o.mealType]} · {rupees(o.total)}</p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => reorder(o)}>
                    <Icon name="refresh" className="h-4 w-4" /> Reorder
                  </Button>
                </div>
              ))}
            </div>
          </>
        )}
        <p className="mt-8 text-center text-xs text-ink-muted">Prototype · all data, OTP & payments are simulated</p>
      </div>
    </div>
  );
}
