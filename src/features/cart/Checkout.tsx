import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useUser } from '@/store/session';
import { useCart } from '@/store/cart';
import { toast } from '@/store/toast';
import { useCatalog, type Catalog } from '@/hooks/useCatalog';
import { useNow } from '@/hooks/useNow';
import { createOrderFromCart } from '@/api/orders';
import { ApiError } from '@/api/base';
import { cutoffAt, isOrderable } from '@/lib/cutoff';
import { MEAL_EMOJI, MEAL_LABEL, relativeDay, rupees, time12 } from '@/lib/format';
import { cartTotals, evaluateCoupon, lineUnitPrice, planQuote } from '@/lib/pricing';
import { SlotPicker } from '@/components/SlotPicker';
import { CountdownChip } from '@/components/CountdownChip';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Badge, PageHeader, SectionTitle, Segmented, SimulationBadge } from '@/components/ui/Misc';
import { ListSkeleton, QueryView } from '@/components/ui/States';

export default function Checkout() {
  const catalog = useCatalog();
  const lines = useCart((s) => s.lines);
  if (lines.length === 0) return <Navigate to="/cart" replace />;
  return (
    <div className="pb-40">
      <PageHeader title="Checkout" back="/cart" action={<SimulationBadge />} />
      <QueryView q={catalog} skeleton={<div className="p-4"><ListSkeleton count={4} /></div>}>
        {(c) => <CheckoutBody catalog={c} />}
      </QueryView>
    </div>
  );
}

function CheckoutBody({ catalog }: { catalog: Catalog }) {
  const user = useUser();
  const now = useNow(10_000);
  const navigate = useNavigate();
  const cart = useCart();
  const [mode, setMode] = useState<'single' | 'plan'>('single');
  const [couponInput, setCouponInput] = useState(cart.couponCode ?? '');
  const [couponError, setCouponError] = useState<string | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);

  const meal = cart.mealType!;
  const date = cart.date!;
  const { windows, planPrices } = catalog.settings;
  const open = isOrderable(meal, date, now, windows);
  const totals = cartTotals(cart.lines, cart.couponCode, catalog.index, catalog.coupons, user);

  const applyCoupon = () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return setCouponError('Enter a coupon code.');
    const res = evaluateCoupon(code, totals.subtotal, catalog.coupons, user);
    if (res.error) {
      setCouponError(res.error);
      cart.setCoupon(null);
    } else {
      setCouponError(null);
      cart.setCoupon(code);
      toast.success(`${code} applied`, `You saved ${rupees(res.discount)}`);
    }
  };

  const place = async () => {
    setFormError(null);
    if (!cart.slotId) {
      setSlotError('Pick a pickup slot.');
      document.getElementById('slots')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setPlacing(true);
    try {
      const order = await createOrderFromCart(user, cart);
      navigate(`/pay/order/${order.id}`, { replace: true });
      // Clear after leaving, otherwise this screen sees an empty cart and redirects to /cart.
      setTimeout(() => useCart.getState().clear(), 0);
    } catch (e) {
      const err = e as ApiError;
      if (err.code === 'slot_full') {
        cart.setSlot(null);
        setSlotError(err.message);
      } else if (err.code === 'coupon') {
        cart.setCoupon(null);
        setCouponError(err.message);
      } else setFormError(err.message);
      setPlacing(false);
    }
  };

  const planMeal = meal === 'breakfast' ? 'breakfast' : meal;
  const quote = planQuote('monthly', planMeal, planPrices);

  return (
    <div className="space-y-2 px-4 pt-3">
      <Segmented
        label="Order type"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'single', label: 'One-time order' },
          { value: 'plan', label: 'Subscribe & save' },
        ]}
      />

      {mode === 'plan' ? (
        <section className="card mt-3 p-5" aria-label="Subscription">
          <p className="text-xs font-bold uppercase tracking-wide text-leaf-700">Monthly {MEAL_LABEL[meal]} plan</p>
          <p className="mt-1 text-3xl font-bold">
            {rupees(quote.pricePerDay)}
            <span className="text-base font-normal text-ink-muted"> / meal</span>
          </p>
          <p className="text-sm text-ink-soft">
            {quote.days} meals for {rupees(quote.total)} · you save <strong className="text-leaf-700">{rupees(quote.savings)}</strong>
          </p>
          <ul className="mt-3 space-y-1 text-sm text-ink-soft">
            <li>✓ Prepaid, no daily ordering</li>
            <li>✓ Skip a day before cutoff, value rolls over as wallet credit</li>
            <li>✓ Pause or cancel anytime, unused meals refunded to wallet</li>
          </ul>
          <Button size="lg" variant="success" className="mt-4" onClick={() => navigate(`/plans/new?meal=${planMeal}`)}>
            See plans
          </Button>
          <p className="mt-2 text-center text-xs text-ink-muted">Your current cart stays saved.</p>
        </section>
      ) : (
        <>
          <SectionTitle>Pickup</SectionTitle>
          <div className="card p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold">
                {MEAL_EMOJI[meal]} {MEAL_LABEL[meal]} · {relativeDay(date, now)}
              </p>
              {open && <CountdownChip remainingMs={cutoffAt(meal, date, windows) - now} label="Closes in" />}
            </div>
            <p className="mt-1 text-xs text-ink-muted">📍 {catalog.settings.kitchenAddress}</p>
            <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Fulfilment">
              <div role="radio" aria-checked="true" className="rounded-xl border-2 border-brand-600 bg-brand-50 px-3 py-2">
                <p className="text-sm font-bold">🏃 Pickup</p>
                <p className="text-xs text-ink-muted">From the kitchen</p>
              </div>
              <div role="radio" aria-checked="false" aria-disabled="true" className="rounded-xl border-2 border-dashed border-line px-3 py-2 opacity-70">
                <p className="text-sm font-bold">🛵 Delivery</p>
                <Badge tone="amber">Coming soon</Badge>
              </div>
            </div>
          </div>

          <div id="slots">
            <SectionTitle>Pickup slot</SectionTitle>
            <SlotPicker
              meal={meal}
              date={date}
              windows={windows}
              value={cart.slotId}
              nowMs={now}
              error={slotError}
              onChange={(id) => {
                cart.setSlot(id);
                setSlotError(null);
              }}
            />
          </div>

          <SectionTitle>Coupon</SectionTitle>
          {cart.couponCode && !totals.couponError ? (
            <div className="flex items-center justify-between rounded-xl border border-leaf-500/40 bg-leaf-50 px-4 py-3">
              <p className="text-sm">
                <strong className="font-mono">{cart.couponCode}</strong> applied · −{rupees(totals.discount)}
              </p>
              <button
                type="button"
                className="min-h-[40px] px-2 text-sm font-semibold text-red-700"
                onClick={() => {
                  cart.setCoupon(null);
                  setCouponInput('');
                }}
              >
                Remove
              </button>
            </div>
          ) : (
            <div>
              <div className="flex gap-2">
                <label htmlFor="coupon" className="sr-only">
                  Coupon code
                </label>
                <input
                  id="coupon"
                  className={`input flex-1 font-mono uppercase ${couponError ? 'input-error' : ''}`}
                  placeholder="Enter code"
                  value={couponInput}
                  onChange={(e) => {
                    setCouponInput(e.target.value.toUpperCase().replace(/\s/g, ''));
                    setCouponError(null);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && applyCoupon()}
                  aria-invalid={!!couponError}
                  aria-describedby={couponError ? 'coupon-err' : undefined}
                  maxLength={16}
                />
                <Button variant="secondary" onClick={applyCoupon}>
                  Apply
                </Button>
              </div>
              {couponError && (
                <p id="coupon-err" className="mt-1.5 text-sm font-medium text-red-700" role="alert">
                  {couponError}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                {catalog.coupons
                  .filter((c) => c.active && !(c.firstOrderOnly && user.hasOrdered))
                  .map((c) => (
                    <button key={c.code} type="button" className="chip chip-off !min-h-[36px] text-xs" onClick={() => setCouponInput(c.code)}>
                      🏷️ <span className="font-mono font-bold">{c.code}</span> · {c.description}
                    </button>
                  ))}
              </div>
            </div>
          )}

          <SectionTitle>Order summary</SectionTitle>
          <div className="card p-4">
            <ul className="space-y-2 text-sm">
              {cart.lines.map((l) => {
                const item = catalog.index[l.box?.baseId ?? l.itemId];
                return (
                  <li key={l.id} className="flex justify-between gap-3">
                    <span>
                      {l.qty}× {l.box ? `Box: ${item?.name}` : item?.name}
                      {l.box && l.box.addonIds.length > 0 && <span className="block text-xs text-ink-muted">+ {l.box.addonIds.map((id) => catalog.index[id]?.name).join(', ')}</span>}
                    </span>
                    <span className="font-semibold">{rupees((lineUnitPrice(l, catalog.index) ?? 0) * l.qty)}</span>
                  </li>
                );
              })}
            </ul>
            <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd>{rupees(totals.subtotal)}</dd>
              </div>
              {totals.discount > 0 && (
                <div className="flex justify-between text-leaf-700">
                  <dt>Coupon ({cart.couponCode})</dt>
                  <dd>−{rupees(totals.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt>Packaging & taxes</dt>
                <dd className="text-leaf-700">₹0</dd>
              </div>
              <div className="flex justify-between pt-1 text-base font-bold">
                <dt>To pay</dt>
                <dd>{rupees(totals.total)}</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-ink-muted">Simple pricing: no GST, no packaging fee, no surprises.</p>
            {cart.note && <p className="mt-2 rounded-lg bg-cream px-3 py-2 text-xs">📝 Note to cook: {cart.note}</p>}
          </div>
          {!open && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
              Ordering closed at {time12(cutoffAt(meal, date, windows))}. <Link to="/cart" className="font-semibold underline">Go back to cart</Link> to move it to the next day.
            </p>
          )}
          {formError && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
              {formError}
            </p>
          )}

          <div className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 px-4 py-3 backdrop-blur">
            <div className="mx-auto max-w-screen-sm">
              <Button size="lg" loading={placing} disabled={!open} onClick={place}>
                <Icon name="lock" className="h-4 w-4" /> Proceed to pay {rupees(totals.total)}
              </Button>
              <p className="mt-1 text-center text-[11px] text-ink-muted">Slot is held for 10 minutes while you pay</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
