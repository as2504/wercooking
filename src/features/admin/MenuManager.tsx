import { useState } from 'react';
import type { DayMenu, KitchenSettings, MealType, MealWindow, MenuCategory, MenuItem, PlanLength, PlanMeal } from '@/types/models';
import { toast } from '@/store/toast';
import { useCatalog, type Catalog } from '@/hooks/useCatalog';
import { updateDayMenu, updateMenuItem, updateSettings } from '@/api/menu';
import { MEALS } from '@/lib/cutoff';
import { MEAL_LABEL, dayLong, rupees } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Misc';
import { ListSkeleton, QueryView } from '@/components/ui/States';
import { AdminHeader } from './common';

type Tab = 'items' | 'week' | 'capacity' | 'plans';

const CATEGORY_LABEL: Record<MenuCategory, string> = {
  thali: 'Thalis',
  meal_addon: 'Lunch & dinner add-ons',
  breakfast_base: 'Breakfast box bases',
  breakfast_addon: 'Breakfast box add-ons',
  breakfast_item: 'Breakfast quick picks',
};

export default function MenuManager() {
  const catalog = useCatalog();
  const [tab, setTab] = useState<Tab>('items');
  return (
    <div>
      <AdminHeader title="Menu manager" subtitle="Changes go live for customers instantly" />
      <div className="px-4 pt-3">
        <Segmented
          label="Menu section"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'items', label: 'Items' },
            { value: 'week', label: 'Weekly' },
            { value: 'capacity', label: 'Capacity' },
            { value: 'plans', label: 'Plans' },
          ]}
        />
        <div className="mt-4">
          <QueryView q={catalog} skeleton={<ListSkeleton count={4} />}>
            {(c) =>
              tab === 'items' ? <Items catalog={c} /> : tab === 'week' ? <Week catalog={c} /> : tab === 'capacity' ? <Capacity settings={c.settings} /> : <Plans settings={c.settings} />
            }
          </QueryView>
        </div>
      </div>
    </div>
  );
}

function Items({ catalog }: { catalog: Catalog }) {
  const groups = Object.keys(CATEGORY_LABEL) as MenuCategory[];
  return (
    <div className="space-y-5 pb-6">
      {groups.map((g) => (
        <section key={g}>
          <h2 className="mb-2 text-base font-semibold">{CATEGORY_LABEL[g]}</h2>
          <ul className="space-y-2">
            {catalog.items
              .filter((i) => i.category === g)
              .map((i) => (
                <ItemRow key={i.id} item={i} />
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ItemRow({ item }: { item: MenuItem }) {
  const [price, setPrice] = useState(String(item.price));
  const [name, setName] = useState(item.name);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dirty = price !== String(item.price) || name !== item.name;

  const save = async () => {
    const n = Number(price);
    if (!name.trim()) return setError('Name is required.');
    if (!Number.isInteger(n) || n < 1 || n > 2000) return setError('Price must be a whole number from ₹1 to ₹2000.');
    setBusy(true);
    try {
      await updateMenuItem(item.id, { price: n, name: name.trim() });
      toast.success(`${name.trim()} saved`, rupees(n));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggleSoldOut = async () => {
    try {
      await updateMenuItem(item.id, { soldOut: !item.soldOut });
      toast.info(item.soldOut ? `${item.name} is back on the menu` : `${item.name} marked sold out`);
    } catch (e) {
      toast.error('Couldn’t update', (e as Error).message);
    }
  };

  return (
    <li className={`card p-3 ${item.soldOut ? 'opacity-75' : ''}`}>
      <div className="flex items-center gap-2">
        <span className="text-2xl" aria-hidden="true">{item.emoji}</span>
        <label className="sr-only" htmlFor={`n-${item.id}`}>Name</label>
        <input id={`n-${item.id}`} value={name} onChange={(e) => setName(e.target.value)} className="input min-w-0 flex-1 !py-2 font-semibold" />
        <label className="sr-only" htmlFor={`p-${item.id}`}>Price in rupees</label>
        <div className="relative w-24">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted">₹</span>
          <input id={`p-${item.id}`} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, '').slice(0, 4))} className={`input !py-2 pl-7 text-right ${error ? 'input-error' : ''}`} />
        </div>
      </div>
      {error && <p className="mt-1 text-sm font-medium text-red-700" role="alert">{error}</p>}
      <div className="mt-2 flex items-center gap-2">
        <label className="flex min-h-[40px] flex-1 cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" role="switch" checked={item.soldOut} onChange={toggleSoldOut} className="h-5 w-5 accent-red-600" />
          <span className={item.soldOut ? 'font-semibold text-red-700' : 'text-ink-soft'}>{item.soldOut ? 'Sold out' : 'Available'}</span>
        </label>
        {item.subPrice && <span className="text-xs text-ink-muted">plan {rupees(item.subPrice)}</span>}
        <Button size="sm" disabled={!dirty} loading={busy} onClick={save}>
          Save
        </Button>
      </div>
    </li>
  );
}

function Week({ catalog }: { catalog: Catalog }) {
  const bases = catalog.items.filter((i) => i.category === 'breakfast_base');
  return (
    <ul className="space-y-3 pb-6">
      {catalog.weekly.days.map((d) => (
        <DayRow key={d.day} day={d} bases={bases} />
      ))}
      <p className="text-xs text-ink-muted">Sunday is a kitchen holiday. Plans and ordering skip it automatically.</p>
    </ul>
  );
}

function DayRow({ day, bases }: { day: DayMenu; bases: MenuItem[] }) {
  const [form, setForm] = useState(day);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = JSON.stringify(form) !== JSON.stringify(day);
  const field = (k: 'sabji' | 'dal' | 'dinnerSabji', label: string) => (
    <div>
      <label htmlFor={`${k}-${day.day}`} className="text-xs font-semibold text-ink-muted">{label}</label>
      <input id={`${k}-${day.day}`} className="input !py-2" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
    </div>
  );
  return (
    <li className="card space-y-2 p-4">
      <h3 className="font-semibold">{dayLong(day.day)}</h3>
      <div className="grid grid-cols-2 gap-2">
        {field('sabji', 'Lunch sabji')}
        {field('dal', 'Dal')}
        {field('dinnerSabji', 'Dinner sabji')}
        <div>
          <label htmlFor={`bf-${day.day}`} className="text-xs font-semibold text-ink-muted">Breakfast special</label>
          <select id={`bf-${day.day}`} className="input !py-2" value={form.breakfastSpecial} onChange={(e) => setForm({ ...form, breakfastSpecial: e.target.value })}>
            {bases.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>
      {error && <p className="text-sm font-medium text-red-700" role="alert">{error}</p>}
      <Button
        size="sm"
        disabled={!dirty}
        loading={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await updateDayMenu({ ...form, sabji: form.sabji.trim(), dal: form.dal.trim(), dinnerSabji: form.dinnerSabji.trim() });
            setError(null);
            toast.success(`${dayLong(day.day)} menu saved`);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        Save {dayLong(day.day)}
      </Button>
    </li>
  );
}

const TIME_RE = /^([01]\d|2[0-3]):(00|30)$/;

function Capacity({ settings }: { settings: KitchenSettings }) {
  const [windows, setWindows] = useState(settings.windows);
  const [cook, setCook] = useState(settings.cookName);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (m: MealType, patch: Partial<MealWindow>) => setWindows((w) => ({ ...w, [m]: { ...w[m], ...patch } }));

  const save = async () => {
    const errs: Record<string, string> = {};
    for (const m of MEALS) {
      const w = windows[m];
      if (!TIME_RE.test(w.cutoffTime)) errs[m] = 'Cutoff must be on the hour or half hour (HH:00 or HH:30).';
      else if (!TIME_RE.test(w.slotStart) || !TIME_RE.test(w.slotEnd) || w.slotEnd <= w.slotStart) errs[m] = 'Pickup window must be HH:00/HH:30 and end after it starts.';
      else if (w.slotCapacity < 1 || w.slotCapacity > 100) errs[m] = 'Slot capacity must be 1–100.';
      else if (w.dailyCapacity < w.slotCapacity) errs[m] = 'Daily capacity can’t be less than one slot’s capacity.';
      else if (w.cutoffDayOffset === 0 && w.cutoffTime >= w.slotStart) errs[m] = 'Same-day cutoff must be before pickup starts.';
    }
    if (!cook.trim()) errs.cook = 'Cook name is required (shown on proof labels).';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await updateSettings({ windows, cookName: cook.trim() });
      toast.success('Capacity & cutoffs saved', 'Customers see the new times right away.');
    } catch (e) {
      toast.error('Couldn’t save', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const num = (m: MealType, k: 'slotCapacity' | 'dailyCapacity', label: string) => (
    <div>
      <label htmlFor={`${k}-${m}`} className="text-xs font-semibold text-ink-muted">{label}</label>
      <input id={`${k}-${m}`} inputMode="numeric" className="input !py-2" value={windows[m][k]} onChange={(e) => set(m, { [k]: Number(e.target.value.replace(/\D/g, '').slice(0, 3)) || 0 })} />
    </div>
  );
  const time = (m: MealType, k: 'cutoffTime' | 'slotStart' | 'slotEnd', label: string) => (
    <div>
      <label htmlFor={`${k}-${m}`} className="text-xs font-semibold text-ink-muted">{label}</label>
      <input id={`${k}-${m}`} type="time" step={1800} className="input !py-2" value={windows[m][k]} onChange={(e) => set(m, { [k]: e.target.value })} />
    </div>
  );

  return (
    <div className="space-y-3 pb-6">
      {MEALS.map((m) => (
        <section key={m} className="card space-y-2 p-4" aria-label={MEAL_LABEL[m]}>
          <h3 className="font-semibold">{MEAL_LABEL[m]}</h3>
          <div className="grid grid-cols-2 gap-2">
            {num(m, 'slotCapacity', 'Orders per 30-min slot')}
            {num(m, 'dailyCapacity', 'Max orders per day')}
            {time(m, 'slotStart', 'Pickup from')}
            {time(m, 'slotEnd', 'Pickup until')}
            {time(m, 'cutoffTime', 'Order cutoff')}
            <div>
              <label htmlFor={`off-${m}`} className="text-xs font-semibold text-ink-muted">Cutoff day</label>
              <select id={`off-${m}`} className="input !py-2" value={windows[m].cutoffDayOffset} onChange={(e) => set(m, { cutoffDayOffset: Number(e.target.value) })}>
                <option value={-1}>Night before</option>
                <option value={0}>Same day</option>
              </select>
            </div>
          </div>
          {errors[m] && <p className="text-sm font-medium text-red-700" role="alert">{errors[m]}</p>}
        </section>
      ))}
      <div className="card p-4">
        <label htmlFor="cook" className="label">Cook name on proof labels</label>
        <input id="cook" className={`input ${errors.cook ? 'input-error' : ''}`} value={cook} onChange={(e) => setCook(e.target.value)} />
        {errors.cook && <p className="mt-1 text-sm font-medium text-red-700" role="alert">{errors.cook}</p>}
      </div>
      <Button size="lg" loading={busy} onClick={save}>
        Save capacity & cutoffs
      </Button>
    </div>
  );
}

function Plans({ settings }: { settings: KitchenSettings }) {
  const [prices, setPrices] = useState(settings.planPrices);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const meals: PlanMeal[] = ['breakfast', 'lunch', 'dinner', 'combo'];
  const lengths: PlanLength[] = ['weekly', 'monthly'];
  return (
    <div className="space-y-3 pb-6">
      <p className="text-sm text-ink-muted">Price per service day. New plans use these prices; existing plans keep what they paid.</p>
      <table className="card w-full overflow-hidden text-sm">
        <thead>
          <tr className="bg-cream text-left">
            <th className="p-3 font-semibold">Plan</th>
            {lengths.map((l) => (
              <th key={l} className="p-3 font-semibold capitalize">{l}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {meals.map((m) => (
            <tr key={m} className="border-t border-line">
              <th scope="row" className="p-3 text-left font-medium capitalize">{m}</th>
              {lengths.map((l) => (
                <td key={l} className="p-2">
                  <label className="sr-only" htmlFor={`pp-${m}-${l}`}>{`${l} ${m} price per day`}</label>
                  <input
                    id={`pp-${m}-${l}`}
                    inputMode="numeric"
                    className="input !py-2"
                    value={prices[l][m]}
                    onChange={(e) => setPrices((p) => ({ ...p, [l]: { ...p[l], [m]: Number(e.target.value.replace(/\D/g, '').slice(0, 4)) || 0 } }))}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {error && <p className="text-sm font-medium text-red-700" role="alert">{error}</p>}
      <Button
        size="lg"
        loading={busy}
        onClick={async () => {
          if (meals.some((m) => lengths.some((l) => prices[l][m] < 10))) return setError('Every plan price must be at least ₹10.');
          if (meals.some((m) => prices.monthly[m] > prices.weekly[m])) return setError('Monthly should not cost more per day than weekly.');
          setError(null);
          setBusy(true);
          try {
            await updateSettings({ planPrices: prices });
            toast.success('Plan prices saved');
          } finally {
            setBusy(false);
          }
        }}
      >
        Save plan prices
      </Button>
    </div>
  );
}
