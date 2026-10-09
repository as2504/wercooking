import { Link } from 'react-router-dom';
import type { Subscription } from '@/types/models';
import { useUser } from '@/store/session';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { listMySubscriptions } from '@/api/subscriptions';
import { dateShort, rupees } from '@/lib/format';
import { planSummary } from '@/lib/subscription';
import { ButtonLink } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Badge, SectionTitle } from '@/components/ui/Misc';
import { EmptyState, ListSkeleton, QueryView } from '@/components/ui/States';

export const PLAN_STATUS: Record<Subscription['status'], { label: string; tone: 'green' | 'blue' | 'amber' | 'red' | 'neutral' }> = {
  active: { label: 'Active', tone: 'green' },
  paused: { label: 'Paused', tone: 'blue' },
  pending_payment: { label: 'Awaiting payment', tone: 'amber' },
  cancelled: { label: 'Cancelled', tone: 'red' },
  completed: { label: 'Completed', tone: 'neutral' },
};

export function planName(s: Pick<Subscription, 'plan' | 'meal'>) {
  return `${s.plan === 'weekly' ? 'Weekly' : 'Monthly'} ${s.meal === 'combo' ? 'Combo (lunch + dinner)' : s.meal[0].toUpperCase() + s.meal.slice(1)}`;
}

export default function PlansTab() {
  const user = useUser();
  const q = useLiveQuery(() => listMySubscriptions(user.id), ['subscriptions'], [user.id]);
  return (
    <div className="mt-2">
      <QueryView q={q} skeleton={<div className="mt-4"><ListSkeleton count={2} /></div>}>
        {(subs) => {
          if (subs.length === 0)
            return <EmptyState emoji="📅" title="No plan yet" body="Subscribe to a weekly or monthly plan and stop ordering every day." action={<ButtonLink to="/plans/new">See plans</ButtonLink>} />;
          const live = subs.filter((s) => s.status === 'active' || s.status === 'paused' || s.status === 'pending_payment');
          const past = subs.filter((s) => !live.includes(s));
          return (
            <>
              {live.length > 0 && <SectionTitle>Current</SectionTitle>}
              <div className="space-y-3">
                {live.map((s) => (
                  <PlanCard key={s.id} sub={s} />
                ))}
              </div>
              <ButtonLink to="/plans/new" variant="secondary" size="lg" className="mt-4">
                <Icon name="plus" className="h-4 w-4" /> New plan
              </ButtonLink>
              {past.length > 0 && (
                <>
                  <SectionTitle>Past plans</SectionTitle>
                  <div className="space-y-3">
                    {past.map((s) => (
                      <PlanCard key={s.id} sub={s} />
                    ))}
                  </div>
                </>
              )}
            </>
          );
        }}
      </QueryView>
    </div>
  );
}

function PlanCard({ sub }: { sub: Subscription }) {
  const sum = planSummary(sub);
  const done = sum.delivered + sum.skipped + sum.cancelled + sum.missed;
  return (
    <Link to={sub.status === 'pending_payment' ? `/pay/subscription/${sub.id}` : `/plans/${sub.id}`} className="card block p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold">{planName(sub)}</p>
          <p className="text-xs text-ink-muted">
            From {dateShort(sub.startDate)} · {rupees(sub.amount)}
          </p>
        </div>
        <Badge tone={PLAN_STATUS[sub.status].tone}>{PLAN_STATUS[sub.status].label}</Badge>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-100" role="progressbar" aria-valuemin={0} aria-valuemax={sum.total} aria-valuenow={done} aria-label="Plan progress">
        <div className="h-full bg-leaf-600" style={{ width: `${(done / sum.total) * 100}%` }} />
      </div>
      <p className="mt-2 text-xs text-ink-soft">
        {sum.delivered} delivered · {sum.skipped} skipped · {sum.upcoming} upcoming{sum.paused ? ` · ${sum.paused} paused` : ''}
      </p>
    </Link>
  );
}
