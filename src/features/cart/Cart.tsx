import { useNavigate } from 'react-router-dom';
import { useCart } from '@/store/cart';
import { useCatalog, type Catalog } from '@/hooks/useCatalog';
import { useNow } from '@/hooks/useNow';
import { cutoffAt, isOrderable, nextOrderableDate } from '@/lib/cutoff';
import { MEAL_EMOJI, MEAL_LABEL, relativeDay, rupees, time12 } from '@/lib/format';
import { cartSubtotal, lineUnitPrice } from '@/lib/pricing';
import { CountdownChip } from '@/components/CountdownChip';
import { Button, ButtonLink } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { Badge, PageHeader, Stepper } from '@/components/ui/Misc';
import { EmptyState, ListSkeleton, QueryView } from '@/components/ui/States';

export default function Cart() {
  const catalog = useCatalog();
  const lines = useCart((s) => s.lines);
  return (
    <div className="pb-36">
      <PageHeader title="Your cart" back />
      {lines.length === 0 ? (
        <EmptyState emoji="🛒" title="Your cart is empty" body="Pre-book tomorrow's breakfast or today's thali in a few taps." action={<ButtonLink to="/menu">Browse menu</ButtonLink>} />
      ) : (
        <QueryView q={catalog} skeleton={<div className="p-4"><ListSkeleton /></div>}>
          {(c) => <CartBody catalog={c} />}
        </QueryView>
      )}
    </div>
  );
}

function CartBody({ catalog }: { catalog: Catalog }) {
  const now = useNow(10_000);
  const navigate = useNavigate();
  const cart = useCart();
  const { windows } = catalog.settings;
  const meal = cart.mealType!;
  const date = cart.date!;
  const open = isOrderable(meal, date, now, windows);
  const nextDate = nextOrderableDate(meal, now, windows);
  const subtotal = cartSubtotal(cart.lines, catalog.index);
  const soldOut = cart.lines.filter((l) => (l.box ? [l.box.baseId, ...l.box.addonIds] : [l.itemId]).some((id) => !catalog.index[id] || catalog.index[id].soldOut));

  return (
    <div className="space-y-4 px-4 pt-4">
      <section className={`rounded-2xl p-4 ${open ? 'bg-white ring-1 ring-line' : 'bg-red-50 ring-1 ring-red-200'}`} aria-label="Pickup">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Pickup</p>
            <p className="text-lg font-bold">
              {MEAL_EMOJI[meal]} {MEAL_LABEL[meal]} · {relativeDay(date, now)}
            </p>
          </div>
          {open && <CountdownChip remainingMs={cutoffAt(meal, date, windows) - now} />}
        </div>
        {!open && (
          <div className="mt-2" role="alert">
            <p className="text-sm text-red-800">
              Orders for this meal closed at {time12(cutoffAt(meal, date, windows))}. Move your cart to {relativeDay(nextDate, now)} instead?
            </p>
            <Button size="sm" className="mt-2" onClick={() => cart.moveTo(nextDate)}>
              Move to {relativeDay(nextDate, now)}
            </Button>
          </div>
        )}
      </section>

      <ul className="card divide-y divide-line" aria-label="Items">
        {cart.lines.map((l) => {
          const unit = lineUnitPrice(l, catalog.index) ?? 0;
          const item = catalog.index[l.box?.baseId ?? l.itemId];
          const bad = soldOut.includes(l);
          return (
            <li key={l.id} className="flex gap-3 p-4">
              <span className="text-3xl" aria-hidden="true">{item?.emoji ?? '🍽️'}</span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{l.box ? `Breakfast Box: ${item?.name}` : item?.name ?? 'Unavailable item'}</p>
                {l.box && (
                  <p className="text-xs text-ink-muted">
                    {l.box.addonIds.length ? `+ ${l.box.addonIds.map((id) => catalog.index[id]?.name).join(', ')}` : 'No add-ons'}
                  </p>
                )}
                <p className="text-xs text-ink-muted">{rupees(unit)} each</p>
                {bad && <Badge tone="red" className="mt-1">Sold out, please remove</Badge>}
                <div className="mt-2 flex items-center justify-between">
                  <Stepper value={l.qty} onChange={(n) => cart.setQty(l.id, n)} label={item?.name ?? 'item'} />
                  <span className="font-bold">{rupees(unit * l.qty)}</span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={() => {
          cart.setBrowse(meal, date);
          navigate(meal === 'breakfast' ? '/menu' : '/menu');
        }}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-brand-300 py-3 font-semibold text-brand-700"
      >
        <Icon name="plus" className="h-4 w-4" /> Add more items
      </button>

      <TextArea
        label="Note to the cook (optional)"
        placeholder="e.g. less oil, no onion, extra chutney"
        value={cart.note}
        maxLength={200}
        onChange={(e) => cart.setNote(e.target.value)}
        hint={`${cart.note.length}/200 · Tai reads every note`}
      />

      <div className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-screen-sm items-center gap-3">
          <div className="flex-1">
            <p className="text-xs text-ink-muted">Subtotal</p>
            <p className="text-xl font-bold">{rupees(subtotal)}</p>
          </div>
          <Button size="lg" className="!w-auto flex-[2]" disabled={!open || soldOut.length > 0} onClick={() => navigate('/checkout')}>
            Checkout <Icon name="chevron" className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
