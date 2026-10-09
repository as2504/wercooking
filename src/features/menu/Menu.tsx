import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ISODate, MealType, MenuItem } from '@/types/models';
import { useUser } from '@/store/session';
import { useCart } from '@/store/cart';
import { useCatalog, type Catalog } from '@/hooks/useCatalog';
import { useNow } from '@/hooks/useNow';
import { MEALS, cutoffAt, orderableDates } from '@/lib/cutoff';
import { MEAL_EMOJI, MEAL_LABEL, dayLong, hhmm12, relativeDay, rupees, time12 } from '@/lib/format';
import { dayMenuFor } from '@/lib/menu';
import { istDate, weekdayOf } from '@/lib/time';
import { CountdownChip } from '@/components/CountdownChip';
import { CartBar, useCartGuard } from '@/components/CartGuard';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Badge, PageHeader, SectionTitle, Segmented, Stepper } from '@/components/ui/Misc';
import { ListSkeleton, QueryView } from '@/components/ui/States';

export default function Menu() {
  const catalog = useCatalog();
  const [view, setView] = useState<'order' | 'week'>('order');
  return (
    <div className="pb-24">
      <PageHeader title="Menu" subtitle="Pre-book · Pickup from Akurdi kitchen" action={<CartLink />} />
      <div className="px-4 pt-3">
        <Segmented label="Menu view" value={view} onChange={setView} options={[{ value: 'order', label: 'Order' }, { value: 'week', label: 'This week’s menu' }]} />
        <QueryView q={catalog} skeleton={<div className="mt-4"><ListSkeleton count={3} /></div>}>
          {(c) => (view === 'order' ? <OrderView catalog={c} /> : <WeekView catalog={c} />)}
        </QueryView>
      </div>
      <CartBar index={catalog.data?.index} />
    </div>
  );
}

function CartLink() {
  const n = useCart((s) => s.lines.reduce((a, l) => a + l.qty, 0));
  return (
    <Link to="/cart" className="relative grid h-11 w-11 place-items-center rounded-full hover:bg-black/5" aria-label={`Cart, ${n} items`}>
      <Icon name="cart" className="h-5 w-5" />
      {n > 0 && <span className="absolute right-0.5 top-0.5 min-w-[18px] rounded-full bg-brand-600 px-1 text-center text-[10px] font-bold leading-[18px] text-white">{n}</span>}
    </Link>
  );
}

function OrderView({ catalog }: { catalog: Catalog }) {
  const now = useNow(15_000);
  const user = useUser();
  const { windows } = catalog.settings;
  const { browseMeal, browseDate, setBrowse } = useCart();
  const dates = orderableDates(browseMeal, now, windows, 6);
  const date: ISODate | undefined = browseDate && dates.includes(browseDate) ? browseDate : dates[0];

  useEffect(() => {
    if (date && date !== browseDate) setBrowse(browseMeal, date);
  }, [date, browseDate, browseMeal, setBrowse]);

  return (
    <div className="mt-4">
      <div role="tablist" aria-label="Meal" className="grid grid-cols-3 gap-2">
        {MEALS.map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={browseMeal === m}
            type="button"
            onClick={() => setBrowse(m, null)}
            className={`flex min-h-[56px] flex-col items-center justify-center rounded-2xl border text-sm font-bold transition ${browseMeal === m ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white text-ink-soft'}`}
          >
            <span aria-hidden="true">{MEAL_EMOJI[m]}</span>
            {MEAL_LABEL[m]}
          </button>
        ))}
      </div>

      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4" role="radiogroup" aria-label="Pickup date">
        {dates.map((d) => (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={d === date}
            onClick={() => setBrowse(browseMeal, d)}
            className={`shrink-0 rounded-xl border px-3 py-2 text-left ${d === date ? 'border-brand-600 bg-brand-50' : 'border-line bg-white'}`}
          >
            <span className="block text-sm font-bold">{relativeDay(d, now)}</span>
            <span className="block text-[11px] text-ink-muted">closes {time12(cutoffAt(browseMeal, d, windows))}</span>
          </button>
        ))}
      </div>

      {date && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
          <CountdownChip remainingMs={cutoffAt(browseMeal, date, windows) - now} />
          <span>
            Pickup {hhmm12(windows[browseMeal].slotStart)} – {hhmm12(windows[browseMeal].slotEnd)}
          </span>
        </div>
      )}

      {date && (browseMeal === 'breakfast' ? <BreakfastMenu catalog={catalog} date={date} /> : <ThaliMenu catalog={catalog} meal={browseMeal} date={date} diet={user.diet} />)}
    </div>
  );
}

function ItemRow({ item, meal, date, diet }: { item: MenuItem; meal: MealType; date: ISODate; diet: 'veg' | 'egg' }) {
  const qty = useCart((s) => (s.mealType === meal && s.date === date ? s.lines.find((l) => l.itemId === item.id && !l.box)?.qty ?? 0 : 0));
  const setItemQty = useCart((s) => s.setItemQty);
  const { guard, sheet } = useCartGuard();
  return (
    <div className={`card flex gap-3 p-3 ${item.soldOut ? 'opacity-60' : ''}`}>
      <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-brand-50 text-3xl" aria-hidden="true">{item.emoji}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 className="font-sans text-[15px] font-bold">{item.name}</h3>
          <span className={`h-3 w-3 rounded-sm border-2 ${item.diet === 'veg' ? 'border-leaf-600' : 'border-amber-700'}`} title={item.diet === 'veg' ? 'Vegetarian' : 'Contains egg'} aria-label={item.diet === 'veg' ? 'Vegetarian' : 'Contains egg'} />
          {item.diet === 'egg' && diet === 'veg' && <Badge tone="amber">Contains egg</Badge>}
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{item.description}</p>
        <div className="mt-2 flex items-center justify-between">
          <p className="font-bold">
            {rupees(item.price)}
            {item.unitLabel && <span className="ml-1 text-xs font-normal text-ink-muted">/ {item.unitLabel}</span>}
          </p>
          {item.soldOut ? (
            <Badge tone="red">Sold out</Badge>
          ) : qty > 0 ? (
            <Stepper value={qty} onChange={(n) => setItemQty(meal, date, item.id, n)} label={item.name} />
          ) : (
            <Button size="sm" variant="secondary" onClick={() => guard(meal, date, () => setItemQty(meal, date, item.id, 1))} aria-label={`Add ${item.name}`}>
              <Icon name="plus" className="h-4 w-4" /> Add
            </Button>
          )}
        </div>
      </div>
      {sheet}
    </div>
  );
}

function ThaliMenu({ catalog, meal, date, diet }: { catalog: Catalog; meal: MealType; date: ISODate; diet: 'veg' | 'egg' }) {
  const day = dayMenuFor(date, catalog.weekly);
  const thalis = catalog.items.filter((i) => i.category === 'thali' && i.meals.includes(meal));
  const addons = catalog.items.filter((i) => i.category === 'meal_addon' && i.meals.includes(meal));
  return (
    <>
      {day && (
        <section className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-line" aria-label="What's in the thali">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-700">{dayLong(weekdayOf(date))}'s {MEAL_LABEL[meal].toLowerCase()} thali</p>
          <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            <li>🥘 {meal === 'lunch' ? day.sabji : day.dinnerSabji}</li>
            <li>🍲 {day.dal}</li>
            <li>🫓 Phulka roti</li>
            <li>🍚 Jeera rice</li>
            <li>🥗 Salad</li>
            <li>🥭 Pickle</li>
          </ul>
        </section>
      )}
      <SectionTitle>Thalis</SectionTitle>
      <div className="space-y-3">
        {thalis.map((i) => (
          <ItemRow key={i.id} item={i} meal={meal} date={date} diet={diet} />
        ))}
      </div>
      <SectionTitle>Add-ons</SectionTitle>
      <div className="space-y-3">
        {addons.map((i) => (
          <ItemRow key={i.id} item={i} meal={meal} date={date} diet={diet} />
        ))}
      </div>
      <p className="mt-4 text-xs text-ink-muted">Add a note for the cook (less oil, no onion…) in your cart.</p>
    </>
  );
}

function BreakfastMenu({ catalog, date }: { catalog: Catalog; date: ISODate }) {
  const user = useUser();
  const day = dayMenuFor(date, catalog.weekly);
  const special = day ? catalog.index[day.breakfastSpecial] : undefined;
  const bases = catalog.items.filter((i) => i.category === 'breakfast_base');
  const min = Math.min(...bases.map((b) => b.price));
  const max = Math.max(...bases.map((b) => b.price));
  const singles = catalog.items.filter((i) => i.category === 'breakfast_item');
  return (
    <>
      <Link to="/menu/box" className="mt-4 block overflow-hidden rounded-3xl bg-gradient-to-br from-turmeric-100 to-brand-100 p-5 ring-1 ring-brand-200">
        <p className="text-xs font-bold uppercase tracking-wide text-brand-700">Healthy Breakfast Box</p>
        <h2 className="mt-1 text-2xl font-bold">Build your box</h2>
        <p className="mt-1 text-sm text-ink-soft">Pick a base, add eggs, sprouts, fruit or chikki. Live price as you build.</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-lg font-bold">
            {rupees(min)}–{rupees(max)} <span className="text-sm font-normal text-ink-muted">base</span>
          </span>
          <span className="flex items-center gap-1 rounded-xl bg-brand-600 px-4 py-2.5 font-semibold text-white">
            Start <Icon name="chevron" className="h-4 w-4" />
          </span>
        </div>
        <p className="mt-3 text-4xl tracking-widest" aria-hidden="true">🍚🥣🍥🫓🌾 + 🥚🌱🍉🥜</p>
      </Link>
      {special && (
        <p className="mt-3 rounded-xl bg-white px-4 py-3 text-sm ring-1 ring-line">
          ⭐ {dayLong(weekdayOf(date))}'s special: <strong>{special.name}</strong>
        </p>
      )}
      <SectionTitle>Quick picks</SectionTitle>
      <div className="space-y-3">
        {singles.map((i) => (
          <ItemRow key={i.id} item={i} meal="breakfast" date={date} diet={user.diet} />
        ))}
      </div>
    </>
  );
}

function WeekView({ catalog }: { catalog: Catalog }) {
  const now = useNow(60_000);
  const todayWd = weekdayOf(istDate(now));
  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm text-ink-muted">Fixed weekly menu, Monday to Saturday. Sunday is Tai's day off 🙏</p>
      {catalog.weekly.days.map((d) => (
        <section key={d.day} className={`card p-4 ${d.day === todayWd ? 'ring-2 ring-brand-500' : ''}`} aria-label={dayLong(d.day)}>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">{dayLong(d.day)}</h3>
            {d.day === todayWd && <Badge tone="brand">Today</Badge>}
          </div>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 font-semibold text-ink-muted">🌅 Breakfast</dt>
              <dd>{catalog.index[d.breakfastSpecial]?.name ?? '-'} special · build-a-box</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 font-semibold text-ink-muted">☀️ Lunch</dt>
              <dd>{d.sabji} · {d.dal}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 font-semibold text-ink-muted">🌙 Dinner</dt>
              <dd>{d.dinnerSabji} · {d.dal}</dd>
            </div>
          </dl>
        </section>
      ))}
    </div>
  );
}
