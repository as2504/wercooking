import { useState } from 'react';
import type { Subscription } from '@/types/models';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { useNow } from '@/hooks/useNow';
import { listAllSubscriptions } from '@/api/subscriptions';
import { listUsers } from '@/api/users';
import { MEAL_EMOJI, MEAL_LABEL, dateShort, formatPhone, relativeDay, rupees } from '@/lib/format';
import { planSummary } from '@/lib/subscription';
import { Badge, PageHeader } from '@/components/ui/Misc';
import { EmptyState, ListSkeleton, QueryView } from '@/components/ui/States';
import { PLAN_STATUS, planName } from '@/features/subscriptions/PlansTab';
import { Stat } from './common';

type Filter = 'live' | 'all' | Subscription['status'];

export default function Subscribers() {
  const now = useNow(60_000);
  const q = useLiveQuery(async () => {
    const [subs, users] = await Promise.all([listAllSubscriptions(), listUsers()]);
    return { subs, users };
  }, ['subscriptions', 'users']);
  const [filter, setFilter] = useState<Filter>('live');

  return (
    <div className="pb-10">
      <PageHeader title="Subscribers" back="/admin/more" />
      <div className="space-y-3 px-4 pt-3">
        <QueryView q={q} skeleton={<ListSkeleton count={4} />}>
          {({ subs, users }) => {
            const live = subs.filter((s) => s.status === 'active' || s.status === 'paused');
            const visible = subs.filter((s) => (filter === 'all' ? true : filter === 'live' ? live.includes(s) : s.status === filter));
            const prepaid = live.reduce((sum, s) => sum + planSummary(s).upcoming * (s.meal === 'combo' ? s.pricePerDay / 2 : s.pricePerDay), 0);
            return (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <Stat label="Active" value={live.filter((s) => s.status === 'active').length} tone="green" />
                  <Stat label="Paused" value={live.filter((s) => s.status === 'paused').length} />
                  <Stat label="Meals owed" value={rupees(prepaid)} sub="prepaid, upcoming" tone="brand" />
                </div>
                <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" role="radiogroup" aria-label="Filter">
                  {(['live', 'active', 'paused', 'completed', 'cancelled', 'all'] as Filter[]).map((f) => (
                    <button key={f} type="button" role="radio" aria-checked={filter === f} onClick={() => setFilter(f)} className={`chip shrink-0 capitalize ${filter === f ? 'chip-on' : 'chip-off'}`}>
                      {f === 'live' ? 'Active + paused' : f}
                    </button>
                  ))}
                </div>
                {visible.length === 0 ? (
                  <EmptyState emoji="📅" title="No subscribers here" />
                ) : (
                  <ul className="space-y-2">
                    {visible.map((s) => {
                      const u = users.find((x) => x.id === s.userId);
                      const sum = planSummary(s);
                      const next = s.days.find((d) => d.state === 'upcoming' || d.state === 'ordered');
                      return (
                        <li key={s.id} className="card p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-bold">{s.customerName}</p>
                              <p className="text-xs text-ink-muted">
                                {u ? formatPhone(u.phone) : ''} · {u?.area}
                              </p>
                            </div>
                            <Badge tone={PLAN_STATUS[s.status].tone}>{PLAN_STATUS[s.status].label}</Badge>
                          </div>
                          <p className="mt-2 text-sm font-semibold">
                            {planName(s)} · {rupees(s.amount)}
                          </p>
                          <p className="text-xs text-ink-soft">
                            {dateShort(s.startDate)} → {dateShort(s.days.at(-1)!.date)} · {sum.delivered}/{sum.total} delivered · {sum.skipped} skipped
                            {sum.paused ? ` · ${sum.paused} paused` : ''}
                          </p>
                          {next && (
                            <p className="mt-1 text-xs">
                              Next: {MEAL_EMOJI[next.meal]} {MEAL_LABEL[next.meal]} {relativeDay(next.date, now)}
                            </p>
                          )}
                          {u?.allergies && <p className="mt-1 text-xs font-semibold text-red-700">⚠ Allergies: {u.allergies}</p>}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            );
          }}
        </QueryView>
      </div>
    </div>
  );
}
