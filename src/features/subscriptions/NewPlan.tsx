import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ISODate, MealType, PlanLength, PlanMeal } from '@/types/models';
import { useUser } from '@/store/session';
import { useCatalog, type Catalog } from '@/hooks/useCatalog';
import { useNow } from '@/hooks/useNow';
import { createSubscription } from '@/api/subscriptions';
import { cutoffAt, isServiceDay, slotsFor } from '@/lib/cutoff';
import { MEAL_EMOJI, MEAL_LABEL, dateShort, relativeDay, rupees, time12 } from '@/lib/format';
import { PLAN_DAYS, SINGLE_REFERENCE, planQuote } from '@/lib/pricing';
import { earliestStartDate, mealsOf, serviceDates } from '@/lib/subscription';
import { addDays } from '@/lib/time';
import { Button } from '@/components/ui/Button';
import { Badge, PageHeader, SectionTitle } from '@/components/ui/Misc';
import { ListSkeleton, QueryView } from '@/components/ui/States';

const PLAN_MEALS: { value: PlanMeal; label: string; emoji: string; body: string }[] = [
  { value: 'lunch', label: 'Lunch', emoji: '☀️', body: 'Regular thali, Mon–Sat' },
  { value: 'dinner', label: 'Dinner', emoji: '🌙', body: 'Regular thali, Mon–Sat' },
  { value: 'breakfast', label: 'Breakfast', emoji: '🌅', body: 'Day’s special breakfast box' },
  { value: 'combo', label: 'Combo', emoji: '🍱', body: 'Lunch + dinner thali' },
];

export default function NewPlan() {
  const catalog = useCatalog();
  return (
    <div className="pb-40">
      <PageHeader title="Choose a plan" subtitle="Prepaid · no daily hassle" back />
      <QueryView q={catalog} skeleton={<div className="p-4"><ListSkeleton count={3} /></div>}>
        {(c) => <PlanForm catalog={c} />}
      </QueryView>
    </div>
  );
}

function PlanForm({ catalog }: { catalog: Catalog }) {
  const user = useUser();
  const now = useNow(30_000);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialMeal = (['lunch', 'dinner', 'breakfast', 'combo'] as PlanMeal[]).find((m) => m === params.get('meal')) ?? 'lunch';
  const [meal, setMeal] = useState<PlanMeal>(initialMeal);
  const [plan, setPlan] = useState<PlanLength>('monthly');
  const { windows, planPrices } = catalog.settings;
  const earliest = earliestStartDate(meal, now, windows);
  const startOptions = serviceDates(earliest, 6);
  const [start, setStart] = useState<ISODate>(earliest);
  const [slots, setSlots] = useState<Partial<Record<MealType, string>>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // Keep the chosen start date valid when the meal (and so the earliest date) changes.
  useEffect(() => {
    if (!startOptions.includes(start)) setStart(startOptions[0]);
  }, [meal, earliest]); // eslint-disable-line react-hooks/exhaustive-deps

  const quote = planQuote(plan, meal, planPrices);
  const lastDate = serviceDates(start, PLAN_DAYS[plan]).at(-1)!;

  const submit = async () => {
    const errs: Record<string, string> = {};
    for (const m of mealsOf(meal)) if (!slots[m]) errs[m] = `Pick a ${MEAL_LABEL[m].toLowerCase()} pickup slot.`;
    if (!isServiceDay(start)) errs.start = 'Choose a Monday–Saturday start date.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const sub = await createSubscription(user, { plan, meal, startDate: start, slots });
      navigate(`/pay/subscription/${sub.id}`);
    } catch (e) {
      setErrors({ form: (e as Error).message });
      setBusy(false);
    }
  };

  return (
    <div className="px-4 pt-3">
      <SectionTitle>1. Which meal?</SectionTitle>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Meal">
        {PLAN_MEALS.map((m) => (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={meal === m.value}
            onClick={() => setMeal(m.value)}
            className={`rounded-2xl border-2 p-3 text-left transition ${meal === m.value ? 'border-brand-600 bg-brand-50' : 'border-line bg-white'}`}
          >
            <span className="text-2xl" aria-hidden="true">{m.emoji}</span>
            <span className="block font-bold">{m.label}</span>
            <span className="block text-xs text-ink-muted">{m.body}</span>
            <span className="mt-1 block text-sm font-semibold text-brand-700">from {rupees(planPrices.monthly[m.value])}/day</span>
          </button>
        ))}
      </div>

      <SectionTitle>2. How long?</SectionTitle>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Plan length">
        {(['weekly', 'monthly'] as PlanLength[]).map((p) => {
          const q = planQuote(p, meal, planPrices);
          return (
            <button key={p} type="button" role="radio" aria-checked={plan === p} onClick={() => setPlan(p)} className={`relative rounded-2xl border-2 p-3 text-left ${plan === p ? 'border-brand-600 bg-brand-50' : 'border-line bg-white'}`}>
              {p === 'monthly' && <Badge tone="green" className="absolute right-2 top-2">Best value</Badge>}
              <span className="block font-bold">{p === 'weekly' ? 'Weekly' : 'Monthly'}</span>
              <span className="block text-xs text-ink-muted">{q.days} days (Mon–Sat)</span>
              <span className="mt-1 block text-lg font-bold">{rupees(q.total)}</span>
              <span className="block text-xs font-semibold text-leaf-700">save {rupees(q.savings)}</span>
            </button>
          );
        })}
      </div>

      <SectionTitle>3. Start date</SectionTitle>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" role="radiogroup" aria-label="Start date">
        {startOptions.map((d) => (
          <button key={d} type="button" role="radio" aria-checked={start === d} onClick={() => setStart(d)} className={`chip shrink-0 ${start === d ? 'chip-on' : 'chip-off'}`}>
            {relativeDay(d, now)}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        Earliest start: {dateShort(earliest)} (first cutoff {time12(cutoffAt(mealsOf(meal)[0], earliest, windows))}). Runs {dateShort(start)} → {dateShort(lastDate)}, Sundays off.
      </p>
      {errors.start && <p className="mt-1 text-sm font-medium text-red-700" role="alert">{errors.start}</p>}

      <SectionTitle>4. Daily pickup slot</SectionTitle>
      <div className="space-y-3">
        {mealsOf(meal).map((m) => (
          <fieldset key={m}>
            <legend className="label">
              {MEAL_EMOJI[m]} {MEAL_LABEL[m]}
            </legend>
            <div className="flex flex-wrap gap-2">
              {slotsFor(m, windows).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={slots[m] === s.id}
                  onClick={() => {
                    setSlots((cur) => ({ ...cur, [m]: s.id }));
                    setErrors((e) => {
                      const next = { ...e };
                      delete next[m];
                      return next;
                    });
                  }}
                  className={`chip ${slots[m] === s.id ? 'chip-on' : 'chip-off'}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {errors[m] && <p className="mt-1 text-sm font-medium text-red-700" role="alert">{errors[m]}</p>}
          </fieldset>
        ))}
      </div>

      <section className="card mt-6 p-4" aria-label="Plan summary">
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt>{quote.days} days × {rupees(quote.pricePerDay)}</dt>
            <dd className="font-semibold">{rupees(quote.total)}</dd>
          </div>
          <div className="flex justify-between text-ink-muted">
            <dt>Same meals as single orders</dt>
            <dd className="line-through">{rupees(quote.singleTotal)}</dd>
          </div>
          <div className="flex justify-between font-semibold text-leaf-700">
            <dt>You save</dt>
            <dd>{rupees(quote.savings)}</dd>
          </div>
        </dl>
        <ul className="mt-3 space-y-1 border-t border-line pt-3 text-xs text-ink-soft">
          <li>✓ Skip any day before its cutoff: {rupees(meal === 'combo' ? quote.pricePerDay / 2 : quote.pricePerDay)} per meal rolls over to your wallet</li>
          <li>✓ Pause anytime: paused meals move to the end of your plan</li>
          <li>✓ Cancel anytime: unused meals refunded to wallet</li>
          {meal === 'breakfast' && <li>✓ Breakfast = the day’s special box (single price ref. {rupees(SINGLE_REFERENCE.breakfast)})</li>}
        </ul>
      </section>
      {errors.form && <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{errors.form}</p>}

      <div className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-screen-sm">
          <Button size="lg" variant="success" loading={busy} onClick={submit}>
            Pay {rupees(quote.total)} & start {relativeDay(start, now).toLowerCase() === 'tomorrow' ? 'tomorrow' : dateShort(start)}
          </Button>
          <p className="mt-1 text-center text-[11px] text-ink-muted">Last meal {dateShort(addDays(lastDate, 0))} · simulated payment</p>
        </div>
      </div>
    </div>
  );
}
