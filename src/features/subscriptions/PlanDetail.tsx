import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { ISODate, SubDay, SubDayState, Subscription } from '@/types/models';
import { useSession, useUser } from '@/store/session';
import { toast } from '@/store/toast';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { useCatalog } from '@/hooks/useCatalog';
import { useNow } from '@/hooks/useNow';
import { cancelPreview, cancelSubscription, getSubscription, pauseSubscription, resumeSubscription, skipPlanDate, unskipPlanDate } from '@/api/subscriptions';
import { cutoffAt, type Windows } from '@/lib/cutoff';
import { MEAL_EMOJI, MEAL_LABEL, dateShort, dateTime, relativeDay, rupees } from '@/lib/format';
import { canModifyDay, perMealValue, planSummary } from '@/lib/subscription';
import { addDays, istDate, istParts, istAt, startOfWeek } from '@/lib/time';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Badge, PageHeader, SectionTitle } from '@/components/ui/Misc';
import { Sheet } from '@/components/ui/Sheet';
import { CardSkeleton, ErrorState, QueryView } from '@/components/ui/States';
import { PLAN_STATUS, planName } from './PlansTab';

const STATE_STYLE: Record<SubDayState, { cell: string; label: string; dot: string }> = {
  upcoming: { cell: 'bg-white ring-2 ring-brand-300', label: 'Upcoming', dot: 'bg-brand-500' },
  ordered: { cell: 'bg-turmeric-100 ring-1 ring-amber-300', label: 'Being prepared', dot: 'bg-amber-500' },
  delivered: { cell: 'bg-leaf-600 text-white', label: 'Picked up', dot: 'bg-leaf-600' },
  skipped: { cell: 'bg-stone-200 text-ink-muted line-through', label: 'Skipped (credited)', dot: 'bg-stone-400' },
  paused: { cell: 'bg-sky-100 text-sky-900 ring-1 ring-sky-300', label: 'Paused', dot: 'bg-sky-500' },
  cancelled: { cell: 'bg-red-50 text-red-700 line-through', label: 'Cancelled (refunded)', dot: 'bg-red-400' },
  missed: { cell: 'bg-red-100 text-red-800', label: 'Missed', dot: 'bg-red-600' },
};

export default function PlanDetail() {
  const { id = '' } = useParams();
  const q = useLiveQuery(() => getSubscription(id), ['subscriptions'], [id]);
  const catalog = useCatalog();
  return (
    <div className="pb-10">
      <PageHeader title="My plan" back="/orders?tab=plans" />
      <div className="px-4 pt-3">
        <QueryView q={q} skeleton={<CardSkeleton lines={6} />}>
          {(sub) => (catalog.data ? <PlanBody sub={sub} windows={catalog.data.settings.windows} /> : <CardSkeleton lines={6} />)}
        </QueryView>
      </div>
    </div>
  );
}

function PlanBody({ sub, windows }: { sub: Subscription; windows: Windows }) {
  const user = useUser();
  const now = useNow(30_000);
  const [day, setDay] = useState<ISODate | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  if (sub.userId !== user.id) return <ErrorState error={new Error('This plan belongs to another account.')} />;
  const sum = planSummary(sub);
  const value = perMealValue(sub);
  const next = sub.days.find((d) => d.state === 'upcoming' || d.state === 'ordered');

  const run = async (key: string, fn: () => Promise<unknown>, ok: string, body?: string) => {
    setBusy(key);
    try {
      await fn();
      await useSession.getState().refresh();
      toast.success(ok, body);
      return true;
    } catch (e) {
      toast.error('Couldn’t update plan', (e as Error).message);
      return false;
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      {sub.status === 'pending_payment' && (
        <div className="rounded-2xl border border-amber-300 bg-turmeric-100 p-4" role="alert">
          <p className="font-bold text-amber-900">Payment pending</p>
          <ButtonLink to={`/pay/subscription/${sub.id}`} className="mt-2">Complete payment · {rupees(sub.amount)}</ButtonLink>
        </div>
      )}
      <section className="rounded-3xl bg-gradient-to-br from-leaf-600 to-leaf-700 p-5 text-white">
        <div className="flex items-center justify-between">
          <p className="text-sm text-white/80">{sub.serviceDays} days · {rupees(sub.pricePerDay)}/day</p>
          <Badge tone={PLAN_STATUS[sub.status].tone}>{PLAN_STATUS[sub.status].label}</Badge>
        </div>
        <h2 className="mt-1 text-2xl font-bold">{planName(sub)}</h2>
        {next && (
          <p className="mt-1 text-sm text-white/90">
            Next: {MEAL_EMOJI[next.meal]} {MEAL_LABEL[next.meal]} {relativeDay(next.date, now)}
            {next.state === 'upcoming' && ` · skip before ${dateTime(cutoffAt(next.meal, next.date, windows))}`}
          </p>
        )}
        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          {[
            ['Picked up', sum.delivered],
            ['Upcoming', sum.upcoming],
            ['Skipped', sum.skipped],
            ['Paused', sum.paused],
          ].map(([l, n]) => (
            <div key={l} className="rounded-xl bg-white/15 py-2">
              <p className="text-xl font-bold">{n}</p>
              <p className="text-[11px] text-white/80">{l}</p>
            </div>
          ))}
        </div>
        {sub.creditedBack > 0 && <p className="mt-3 text-xs text-white/90">💰 {rupees(sub.creditedBack)} rolled over to your wallet so far</p>}
      </section>

      <section aria-label="Plan calendar">
        <SectionTitle>Calendar</SectionTitle>
        <PlanCalendar sub={sub} nowMs={now} onPick={setDay} />
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
          {(['upcoming', 'ordered', 'delivered', 'skipped', 'paused'] as SubDayState[]).map((s) => (
            <li key={s} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${STATE_STYLE[s].dot}`} aria-hidden="true" />
              {STATE_STYLE[s].label}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-ink-muted">Tap a day to skip it. Each skipped meal credits {rupees(value)} to your wallet.</p>
      </section>

      <div className="flex flex-col gap-2">
        {sub.status === 'active' && (
          <Button variant="secondary" size="lg" loading={busy === 'pause'} onClick={() => run('pause', () => pauseSubscription(sub.id, user.id), 'Plan paused', 'Upcoming meals are on hold. Resume anytime.')}>
            ⏸ Pause plan
          </Button>
        )}
        {sub.status === 'paused' && (
          <Button size="lg" variant="success" loading={busy === 'resume'} onClick={() => run('resume', () => resumeSubscription(sub.id, user.id), 'Plan resumed', 'Paused meals are rescheduled from the next available day.')}>
            ▶ Resume plan
          </Button>
        )}
        {(sub.status === 'active' || sub.status === 'paused') && (
          <Button variant="ghost" size="lg" className="!text-red-700" onClick={() => setCancelOpen(true)}>
            Cancel plan
          </Button>
        )}
      </div>

      <DaySheet sub={sub} date={day} windows={windows} nowMs={now} onClose={() => setDay(null)} busy={busy} run={run} />

      <Sheet
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel this plan?"
        footer={
          <Button
            variant="danger"
            size="lg"
            loading={busy === 'cancel'}
            onClick={async () => {
              const ok = await run('cancel', () => cancelSubscription(sub.id, user.id), 'Plan cancelled', 'Unused meals refunded to your wallet.');
              if (ok) setCancelOpen(false);
            }}
          >
            Cancel & refund {rupees(cancelPreview(sub, windows))}
          </Button>
        }
      >
        <p className="text-ink-soft">
          Meals whose cutoff hasn’t passed (and paused meals) are refunded to your wallet at {rupees(value)} each. Meals already being prepared will still be ready for pickup.
        </p>
      </Sheet>
    </div>
  );
}

function PlanCalendar({ sub, nowMs, onPick }: { sub: Subscription; nowMs: number; onPick: (d: ISODate) => void }) {
  const byDate = new Map<ISODate, SubDay[]>();
  for (const d of sub.days) byDate.set(d.date, [...(byDate.get(d.date) ?? []), d]);
  const dates = [...byDate.keys()].sort();
  const today = istDate(nowMs);
  const first = startOfWeek(dates[0]);
  const last = dates[dates.length - 1];
  const weeks: ISODate[][] = [];
  for (let w = first; w <= last; w = addDays(w, 7)) weeks.push(Array.from({ length: 7 }, (_, i) => addDays(w, i)));

  return (
    <div className="card p-3">
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-ink-muted" aria-hidden="true">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="mt-1 space-y-1" role="grid" aria-label="Plan days">
        {weeks.map((week) => (
          <div key={week[0]} className="grid grid-cols-7 gap-1" role="row">
            {week.map((d) => {
              const days = byDate.get(d);
              const p = istParts(istAt(d, '12:00'));
              const label = p.day === 1 || d === week[0] ? `${p.day}/${p.month}` : String(p.day);
              if (!days)
                return (
                  <span key={d} role="gridcell" className={`grid h-11 place-items-center rounded-lg text-xs ${d === today ? 'font-bold text-brand-700' : 'text-stone-300'}`}>
                    {label}
                  </span>
                );
              const style = STATE_STYLE[days[0].state];
              return (
                <button
                  key={d}
                  type="button"
                  role="gridcell"
                  onClick={() => onPick(d)}
                  aria-label={`${dateShort(d)}: ${days.map((x) => `${MEAL_LABEL[x.meal]} ${STATE_STYLE[x.state].label}`).join(', ')}`}
                  className={`relative flex h-11 flex-col items-center justify-center rounded-lg text-xs font-semibold ${style.cell} ${d === today ? 'outline outline-2 outline-offset-1 outline-ink' : ''}`}
                >
                  {label}
                  {days.length > 1 && (
                    <span className="mt-0.5 flex gap-0.5" aria-hidden="true">
                      {days.map((x) => (
                        <span key={x.meal} className={`h-1.5 w-1.5 rounded-full ${STATE_STYLE[x.state].dot} ring-1 ring-white`} />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function DaySheet({
  sub, date, windows, nowMs, onClose, busy, run,
}: {
  sub: Subscription;
  date: ISODate | null;
  windows: Windows;
  nowMs: number;
  onClose: () => void;
  busy: string | null;
  run: (key: string, fn: () => Promise<unknown>, ok: string, body?: string) => Promise<boolean>;
}) {
  const user = useUser();
  const days = date ? sub.days.filter((d) => d.date === date) : [];
  const skippable = days.some((d) => canModifyDay(d, nowMs, windows)) && sub.status === 'active';
  const restorable = days.some((d) => d.state === 'skipped' && nowMs < cutoffAt(d.meal, d.date, windows));
  const value = perMealValue(sub);
  const credit = days.filter((d) => canModifyDay(d, nowMs, windows)).length * value;
  return (
    <Sheet open={!!date} onClose={onClose} title={date ? dateShort(date) : ''}>
      <ul className="space-y-2">
        {days.map((d) => (
          <li key={d.meal} className="flex items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-line">
            <span className="text-2xl" aria-hidden="true">{MEAL_EMOJI[d.meal]}</span>
            <div className="flex-1">
              <p className="font-semibold">{MEAL_LABEL[d.meal]}</p>
              <p className="text-xs text-ink-muted">
                {STATE_STYLE[d.state].label}
                {d.state === 'upcoming' && ` · cutoff ${dateTime(cutoffAt(d.meal, d.date, windows))}`}
              </p>
            </div>
            {d.orderId && (
              <Link to={`/orders/${d.orderId}`} className="text-sm font-semibold text-brand-700">
                View order
              </Link>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-4 space-y-2">
        {skippable && (
          <Button
            size="lg"
            loading={busy === 'skip'}
            onClick={async () => {
              if (await run('skip', () => skipPlanDate(sub.id, user.id, date!), 'Day skipped', `${rupees(credit)} added to your wallet.`)) onClose();
            }}
          >
            Skip this day · +{rupees(credit)} credit
          </Button>
        )}
        {restorable && (
          <Button
            size="lg"
            variant="secondary"
            loading={busy === 'unskip'}
            onClick={async () => {
              if (await run('unskip', () => unskipPlanDate(sub.id, user.id, date!), 'Day restored', 'The credit was taken back from your wallet.')) onClose();
            }}
          >
            Undo skip
          </Button>
        )}
        {!skippable && !restorable && days.some((d) => d.state === 'upcoming' || d.state === 'ordered') && (
          <p className="text-sm text-ink-muted">Cutoff has passed for this day, so it can no longer be changed.</p>
        )}
        {sub.status === 'paused' && days.some((d) => d.state === 'paused') && <p className="text-sm text-ink-muted">This day is paused. Resume the plan to reschedule it.</p>}
      </div>
    </Sheet>
  );
}
