import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ISODate, MealType } from '@/types/models';
import { useCart, cartCount } from '@/store/cart';
import { MEAL_LABEL, relativeDay, rupees } from '@/lib/format';
import { cartSubtotal, type ItemIndex } from '@/lib/pricing';
import { now } from '@/lib/clock';
import { Button } from './ui/Button';
import { Sheet } from './ui/Sheet';
import { Icon } from './ui/Icon';

/** One cart = one pickup (meal + date). Asks before replacing a cart for a different pickup. */
export function useCartGuard() {
  const [pending, setPending] = useState<{ meal: MealType; date: ISODate; run: () => void } | null>(null);
  const cart = useCart();

  const guard = (meal: MealType, date: ISODate, run: () => void) => {
    if (cart.canAdd(meal, date)) run();
    else setPending({ meal, date, run });
  };

  const sheet = (
    <Sheet
      open={!!pending}
      onClose={() => setPending(null)}
      title="Start a new cart?"
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setPending(null)}>
            Keep current
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              cart.clear();
              pending?.run();
              setPending(null);
            }}
          >
            Replace cart
          </Button>
        </div>
      }
    >
      {pending && cart.mealType && cart.date && (
        <p className="text-ink-soft">
          Your cart has <strong>{MEAL_LABEL[cart.mealType]}</strong> for <strong>{relativeDay(cart.date, now())}</strong>. Each order is one pickup, so adding{' '}
          <strong>{MEAL_LABEL[pending.meal]}</strong> for <strong>{relativeDay(pending.date, now())}</strong> will clear it.
        </p>
      )}
    </Sheet>
  );
  return { guard, sheet };
}

/** Sticky "View cart" bar shown above the bottom nav while the cart has items. */
export function CartBar({ index, aboveNav = true }: { index: ItemIndex | undefined; aboveNav?: boolean }) {
  const lines = useCart((s) => s.lines);
  const meal = useCart((s) => s.mealType);
  const date = useCart((s) => s.date);
  if (!lines.length || !index || !meal || !date) return null;
  return (
    <div className={`fixed inset-x-0 z-20 px-3 ${aboveNav ? 'bottom-[calc(68px+env(safe-area-inset-bottom))]' : 'bottom-[calc(12px+env(safe-area-inset-bottom))]'}`}>
      <Link to="/cart" className="mx-auto flex max-w-screen-sm items-center gap-3 rounded-2xl bg-leaf-700 px-4 py-3 text-white shadow-xl">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-white/15">
          <Icon name="cart" className="h-5 w-5" />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-bold">
            {cartCount(lines)} item{cartCount(lines) > 1 ? 's' : ''} · {rupees(cartSubtotal(lines, index))}
          </span>
          <span className="block text-xs text-white/80">
            {MEAL_LABEL[meal]} · {relativeDay(date, now())}
          </span>
        </span>
        <span className="flex items-center gap-1 font-semibold">
          View cart <Icon name="chevron" className="h-4 w-4" />
        </span>
      </Link>
    </div>
  );
}
