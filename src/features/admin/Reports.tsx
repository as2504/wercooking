import { useLiveQuery } from '@/hooks/useLiveQuery';
import { useNow } from '@/hooks/useNow';
import { weeklyReport } from '@/api/admin';
import { MEAL_LABEL, dateShort, dayShort, rupees, timeAgo } from '@/lib/format';
import { istDate, weekdayOf } from '@/lib/time';
import { BarChart } from '@/components/BarChart';
import { PageHeader, SectionTitle } from '@/components/ui/Misc';
import { EmptyState, ListSkeleton, QueryView } from '@/components/ui/States';
import { Stat } from './common';

export default function Reports() {
  const now = useNow(60_000);
  const today = istDate(now);
  const q = useLiveQuery(() => weeklyReport(today), ['orders', 'reviews'], [today]);
  return (
    <div className="pb-10">
      <PageHeader title="Reports" subtitle="Last 7 days, including today" back="/admin/more" />
      <div className="space-y-2 px-4 pt-3">
        <QueryView q={q} skeleton={<ListSkeleton count={3} lines={4} />}>
          {(r) =>
            r.totalOrders === 0 ? (
              <EmptyState emoji="📊" title="No orders in the last 7 days" />
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <Stat label="Orders" value={r.totalOrders} sub={`~${Math.round(r.totalOrders / 6)}/service day`} />
                  <Stat label="Revenue" value={rupees(r.totalRevenue)} tone="green" />
                  <Stat label="Rating" value={r.avgRating ? `${r.avgRating.toFixed(1)}★` : '–'} sub={`${r.reviews.length} reviews`} tone="brand" />
                </div>
                <p className="text-xs text-ink-muted">
                  By meal: {(['breakfast', 'lunch', 'dinner'] as const).map((m) => `${MEAL_LABEL[m]} ${r.byMeal[m]}`).join(' · ')}
                </p>

                <SectionTitle>Orders per day</SectionTitle>
                <div className="card p-4">
                  <BarChart title="Orders per day" data={r.days.map((d) => ({ label: dayShort(weekdayOf(d.date)), detail: dateShort(d.date), value: d.orders }))} />
                </div>

                <SectionTitle>Revenue per day</SectionTitle>
                <div className="card p-4">
                  <BarChart title="Revenue per day" color="#2F7A3B" format={rupees} data={r.days.map((d) => ({ label: dayShort(weekdayOf(d.date)), detail: dateShort(d.date), value: d.revenue }))} />
                  <p className="mt-2 text-xs text-ink-muted">Paid single orders + plan meals at their per-meal value. Sundays are closed.</p>
                </div>

                <SectionTitle>Top items</SectionTitle>
                <ol className="card divide-y divide-line">
                  {r.topItems.map((it, i) => {
                    const pct = (it.qty / r.topItems[0].qty) * 100;
                    return (
                      <li key={it.name} className="flex items-center gap-3 p-3">
                        <span className="w-5 text-sm font-bold text-ink-muted">{i + 1}</span>
                        <span className="text-xl" aria-hidden="true">{it.emoji}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{it.name}</p>
                          <div className="mt-1 h-1.5 rounded-full bg-stone-100" aria-hidden="true">
                            <div className="h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        <span className="w-10 text-right font-bold tabular-nums">{it.qty}</span>
                      </li>
                    );
                  })}
                </ol>

                <SectionTitle>Ratings</SectionTitle>
                <div className="card p-4">
                  <ul className="space-y-1.5" aria-label="Rating distribution">
                    {[5, 4, 3, 2, 1].map((s) => {
                      const n = r.ratingCounts[s - 1];
                      const max = Math.max(1, ...r.ratingCounts);
                      return (
                        <li key={s} className="flex items-center gap-2 text-sm">
                          <span className="w-8 tabular-nums">{s}★</span>
                          <div className="h-2.5 flex-1 rounded-full bg-stone-100" aria-hidden="true">
                            <div className="h-full rounded-full bg-turmeric-500" style={{ width: `${(n / max) * 100}%` }} />
                          </div>
                          <span className="w-8 text-right tabular-nums">{n}</span>
                        </li>
                      );
                    })}
                  </ul>
                  <ul className="mt-4 space-y-2 border-t border-line pt-3">
                    {r.reviews.filter((x) => x.comment).slice(0, 6).map((rv) => (
                      <li key={rv.id} className="text-sm">
                        <p>
                          <span className="font-semibold">{'★'.repeat(rv.stars)}</span> “{rv.comment}”
                        </p>
                        <p className="text-xs text-ink-muted">
                          {rv.userName} · {MEAL_LABEL[rv.mealType]} · {timeAgo(rv.createdAt, now)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )
          }
        </QueryView>
      </div>
    </div>
  );
}
