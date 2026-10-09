import { useLiveQuery } from '@/hooks/useLiveQuery';
import { getSettings } from '@/api/menu';
import { hhmm12 } from '@/lib/format';
import { MEALS } from '@/lib/cutoff';
import { MEAL_LABEL } from '@/lib/format';
import { Badge, PageHeader } from '@/components/ui/Misc';
import { CardSkeleton, QueryView } from '@/components/ui/States';
import { ButtonLink } from '@/components/ui/Button';

const FAQ: [string, string][] = [
  ['How does pickup work?', 'Choose a 30-minute slot at checkout. Come to the kitchen counter in that slot and show your 4-digit pickup code or QR. That’s it.'],
  ['What are the cutoff times?', 'Breakfast: 9 PM the night before. Lunch: 9 AM the same day. Dinner: 4 PM the same day. Pre-booking lets Tai cook exactly what’s needed, so nothing is reheated or wasted.'],
  ['Can I cancel an order?', 'Yes, until the cutoff for that meal. The full amount is refunded to your WeAreCooking wallet instantly.'],
  ['How do subscriptions work?', 'Pick a weekly (6 meals) or monthly (26 meals) plan for breakfast, lunch, dinner or lunch + dinner combo. Pay once. Skip any day before its cutoff and the value rolls over as wallet credit. Pause and resume anytime.'],
  ['What does “Cooked at… packed at…” mean?', 'Our “Proof, not promise” label. When Tai starts cooking and packing your order, the kitchen app records the exact time. You see it on your order, so you know your food is fresh.'],
  ['Is it really home-style?', 'Yes. One home cook, small batches, cold-pressed or sunflower oil (we post exactly which, every day), no colours, no ajinomoto.'],
  ['Do you deliver?', 'Not yet. Delivery to nearby PGs is coming soon. For now it’s pickup only, which keeps prices low.'],
  ['Is my payment real?', 'No. This is a prototype: OTP, UPI and wallet are all simulated and no money moves.'],
];

export function Help() {
  return (
    <div>
      <PageHeader title="Help & FAQ" back="/profile" />
      <div className="space-y-2 px-4 pb-10 pt-3">
        {FAQ.map(([q, a]) => (
          <details key={q} className="card group p-4 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex min-h-[28px] cursor-pointer list-none items-center justify-between gap-3 font-semibold">
              {q}
              <span className="text-brand-700 transition group-open:rotate-45" aria-hidden="true">＋</span>
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{a}</p>
          </details>
        ))}
        <div className="card mt-4 p-4 text-sm">
          <p className="font-semibold">Still need help?</p>
          <p className="text-ink-soft">WhatsApp or call the kitchen, 8 AM to 9 PM (demo number, not connected).</p>
          <p className="mt-2 font-mono">+91 90000 00000</p>
        </div>
      </div>
    </div>
  );
}

const CLEAN: [string, string, string][] = [
  ['🧼', 'Washed, then washed again', 'All vegetables are soaked in potassium permanganate solution, then rinsed in filtered water before chopping.'],
  ['💧', 'RO water only', 'Every dal, rice and roti dough is made with RO-filtered water. Drinking water is tested monthly.'],
  ['🧤', 'Gloves, caps, aprons', 'Tai and the helper wear hair caps, aprons and gloves while packing. Hands are washed every 30 minutes.'],
  ['🫗', 'Oil is never reused', 'Fresh oil every day, and we post exactly which oil and how much in the daily Kitchen Update.'],
  ['🧊', 'Cooked to order', 'Pre-booking means we cook exact quantities close to your slot. No overnight storage, no reheating.'],
  ['📦', 'Food-grade packaging', 'BPA-free, leak-proof containers, sealed at packing time. The packed-at time is on your order.'],
  ['🧹', 'Deep clean nightly', 'Counters, stove and floor are deep-cleaned every night. Pest control every month.'],
];

export function Hygiene() {
  return (
    <div>
      <PageHeader title="How we keep it clean" back />
      <div className="space-y-3 px-4 pb-10 pt-3">
        <p className="text-ink-soft">Hygiene isn’t a poster on our wall. Here is exactly what happens in the kitchen every day.</p>
        {CLEAN.map(([e, t, b]) => (
          <div key={t} className="card flex gap-3 p-4">
            <span className="text-3xl" aria-hidden="true">{e}</span>
            <div>
              <h2 className="font-sans font-bold">{t}</h2>
              <p className="text-sm text-ink-soft">{b}</p>
            </div>
          </div>
        ))}
        <ButtonLink to="/updates" variant="secondary" size="lg">
          See today’s kitchen update
        </ButtonLink>
      </div>
    </div>
  );
}

export function Fssai() {
  const q = useLiveQuery(getSettings, ['settings']);
  return (
    <div>
      <PageHeader title="FSSAI & kitchen info" back="/profile" />
      <div className="space-y-3 px-4 pb-10 pt-3">
        <QueryView q={q} skeleton={<CardSkeleton lines={4} />}>
          {(s) => (
            <>
              <div className="card p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">FSSAI registration</p>
                <p className="mt-1 font-mono text-lg font-bold">{s.fssaiNumber}</p>
                <Badge tone="amber" className="mt-2">Demo number, not a real licence</Badge>
                <p className="mt-2 text-sm text-ink-soft">A home kitchen with turnover under ₹12 lakh needs FSSAI Basic Registration (Form A). The certificate is displayed at the pickup counter.</p>
              </div>
              <div className="card p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Kitchen</p>
                <p className="mt-1">{s.kitchenAddress}</p>
                <p className="mt-1 text-sm text-ink-soft">Cook: {s.cookName} · Pickup only</p>
              </div>
              <div className="card p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Timings & cutoffs</p>
                <table className="mt-2 w-full text-sm">
                  <thead>
                    <tr className="text-left text-ink-muted">
                      <th className="py-1 font-semibold">Meal</th>
                      <th className="py-1 font-semibold">Pickup</th>
                      <th className="py-1 font-semibold">Order by</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MEALS.map((m) => {
                      const w = s.windows[m];
                      return (
                        <tr key={m} className="border-t border-line">
                          <td className="py-2 font-semibold">{MEAL_LABEL[m]}</td>
                          <td className="py-2">{hhmm12(w.slotStart)}–{hhmm12(w.slotEnd)}</td>
                          <td className="py-2">{hhmm12(w.cutoffTime)}{w.cutoffDayOffset === -1 ? ' (prev. day)' : ''}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-ink-muted">Open Monday to Saturday. Sunday closed.</p>
              </div>
            </>
          )}
        </QueryView>
      </div>
    </div>
  );
}

export function Delivery() {
  return (
    <div>
      <PageHeader title="Delivery" back="/profile" />
      <div className="px-4 pt-10 text-center">
        <p className="text-6xl" aria-hidden="true">🛵</p>
        <h2 className="mt-4 text-2xl font-bold">Delivery is coming soon</h2>
        <p className="mx-auto mt-2 max-w-xs text-ink-soft">We’re starting with PGs within 2 km of Akurdi station. For now, pickup keeps meals hot and prices low.</p>
        <Badge tone="amber" className="mt-4">Coming soon</Badge>
      </div>
    </div>
  );
}
