import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MenuItem } from '@/types/models';
import { useUser } from '@/store/session';
import { useCart } from '@/store/cart';
import { toast } from '@/store/toast';
import { useCatalog, type Catalog } from '@/hooks/useCatalog';
import { useNow } from '@/hooks/useNow';
import { cutoffAt, orderableDates } from '@/lib/cutoff';
import { relativeDay, rupees, time12 } from '@/lib/format';
import { dayMenuFor } from '@/lib/menu';
import { boxPrice } from '@/lib/pricing';
import { useCartGuard } from '@/components/CartGuard';
import { CountdownChip } from '@/components/CountdownChip';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Badge, PageHeader, Stepper } from '@/components/ui/Misc';
import { ListSkeleton, QueryView } from '@/components/ui/States';

export default function BoxBuilder() {
  const catalog = useCatalog();
  return (
    <div className="pb-40">
      <PageHeader title="Build your breakfast box" subtitle="Healthy · Fresh every morning" back />
      <QueryView q={catalog} skeleton={<div className="p-4"><ListSkeleton count={4} /></div>}>
        {(c) => <Builder catalog={c} />}
      </QueryView>
    </div>
  );
}

function Builder({ catalog }: { catalog: Catalog }) {
  const user = useUser();
  const now = useNow(15_000);
  const navigate = useNavigate();
  const { browseMeal, browseDate, setBrowse, addBox } = useCart();
  const { guard, sheet } = useCartGuard();
  const { windows } = catalog.settings;
  const dates = orderableDates('breakfast', now, windows, 6);
  const date = browseMeal === 'breakfast' && browseDate && dates.includes(browseDate) ? browseDate : dates[0];
  const special = dayMenuFor(date, catalog.weekly)?.breakfastSpecial;

  const bases = catalog.items.filter((i) => i.category === 'breakfast_base');
  const addons = catalog.items.filter((i) => i.category === 'breakfast_addon');
  const [baseId, setBaseId] = useState<string | null>(() => bases.find((b) => b.id === special && !b.soldOut)?.id ?? null);
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const base = baseId ? catalog.index[baseId] : null;
  const chosenAddons = addonIds.map((id) => catalog.index[id]).filter(Boolean) as MenuItem[];
  const unit = base ? boxPrice(base, chosenAddons) : 0;
  const total = unit * qty;

  const toggleAddon = (id: string) => setAddonIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const breakdown = useMemo(
    () => (base ? [`${base.name} ${rupees(base.price)}`, ...chosenAddons.map((a) => `${a.name} ${rupees(a.price)}`)].join(' + ') : 'Choose a base to see the price'),
    [base, chosenAddons],
  );

  const add = () => {
    if (!base) {
      setError('Pick a base for your box.');
      document.getElementById('bases')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    guard('breakfast', date, () => {
      addBox('breakfast', date, { baseId: base.id, addonIds }, qty);
      setBrowse('breakfast', date);
      toast.success('Box added to cart', `${base.name}${chosenAddons.length ? ` + ${chosenAddons.length} add-on${chosenAddons.length > 1 ? 's' : ''}` : ''}`);
      navigate('/cart');
    });
  };

  return (
    <div className="px-4 pt-3">
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" role="radiogroup" aria-label="Breakfast date">
        {dates.map((d) => (
          <button key={d} type="button" role="radio" aria-checked={d === date} onClick={() => setBrowse('breakfast', d)} className={`chip shrink-0 ${d === date ? 'chip-on' : 'chip-off'}`}>
            {relativeDay(d, now)}
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
        <CountdownChip remainingMs={cutoffAt('breakfast', date, windows) - now} />
        <span>Orders close {time12(cutoffAt('breakfast', date, windows))} the night before</span>
      </div>

      <fieldset id="bases" className="mt-5">
        <legend className="text-lg font-semibold">
          <span className="mr-2 inline-grid h-7 w-7 place-items-center rounded-full bg-brand-600 text-sm text-white">1</span>
          Choose a base
        </legend>
        {error && <p className="mt-1 text-sm font-medium text-red-700" role="alert">{error}</p>}
        <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Base">
          {bases.map((b) => {
            const on = baseId === b.id;
            return (
              <button
                key={b.id}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={b.soldOut}
                onClick={() => {
                  setBaseId(b.id);
                  setError(null);
                }}
                className={`relative flex flex-col items-start rounded-2xl border-2 p-3 text-left transition disabled:opacity-50 ${on ? 'border-brand-600 bg-brand-50' : 'border-line bg-white hover:border-brand-200'}`}
              >
                {b.id === special && <Badge tone="brand" className="absolute right-2 top-2">Today's pick</Badge>}
                <span className="text-3xl" aria-hidden="true">{b.emoji}</span>
                <span className="mt-1 font-bold">{b.name}</span>
                <span className="line-clamp-2 text-xs text-ink-muted">{b.description}</span>
                <span className="mt-1 font-bold text-brand-700">{b.soldOut ? 'Sold out' : rupees(b.price)}</span>
                {on && <Icon name="check" className="absolute bottom-3 right-3 h-5 w-5 text-brand-600" />}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="mt-6">
        <legend className="text-lg font-semibold">
          <span className="mr-2 inline-grid h-7 w-7 place-items-center rounded-full bg-brand-600 text-sm text-white">2</span>
          Add protein & extras
        </legend>
        <div className="mt-3 space-y-2">
          {addons.map((a) => {
            const on = addonIds.includes(a.id);
            return (
              <button
                key={a.id}
                type="button"
                role="checkbox"
                aria-checked={on}
                disabled={a.soldOut}
                onClick={() => toggleAddon(a.id)}
                className={`flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition disabled:opacity-50 ${on ? 'border-leaf-600 bg-leaf-50' : 'border-line bg-white'}`}
              >
                <span className="text-2xl" aria-hidden="true">{a.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 font-semibold">
                    {a.name} {a.diet === 'egg' && user.diet === 'veg' && <Badge tone="amber">Egg</Badge>}
                  </span>
                  <span className="block text-xs text-ink-muted">{a.unitLabel} · {a.description}</span>
                </span>
                <span className="font-bold">{a.soldOut ? 'Sold out' : `+${rupees(a.price)}`}</span>
                <span className={`grid h-6 w-6 place-items-center rounded-md border-2 ${on ? 'border-leaf-600 bg-leaf-600 text-white' : 'border-line'}`} aria-hidden="true">
                  {on && <Icon name="check" className="h-4 w-4" />}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-6 flex items-center justify-between">
        <span className="text-lg font-semibold">How many boxes?</span>
        <Stepper value={qty} onChange={setQty} min={1} max={10} label="Boxes" />
      </div>

      <div className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-screen-sm">
          <p className="truncate text-xs text-ink-muted" aria-live="polite">
            {breakdown}
            {base && qty > 1 ? ` × ${qty}` : ''}
          </p>
          <Button size="lg" className="mt-2" onClick={add}>
            Add to cart · <span aria-live="polite">{rupees(total)}</span>
          </Button>
        </div>
      </div>
      {sheet}
    </div>
  );
}
