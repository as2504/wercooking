import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { WalletTxn } from '@/types/models';
import { useUser } from '@/store/session';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { useNow } from '@/hooks/useNow';
import { listWalletTxns } from '@/api/wallet';
import { listMyPayments, MAX_TOPUP, MIN_TOPUP } from '@/api/payments';
import { rupees, timeAgo } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { PageHeader, SectionTitle, SimulationBadge } from '@/components/ui/Misc';
import { EmptyState, ListSkeleton, QueryView } from '@/components/ui/States';

const TXN_ICON: Record<WalletTxn['type'], string> = { topup: '➕', payment: '🧾', refund: '↩️', rollover: '📅' };
const PRESETS = [100, 200, 500, 1000];

export default function Wallet() {
  const user = useUser();
  const now = useNow(60_000);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [amount, setAmount] = useState(params.get('add') ?? '');
  const [error, setError] = useState<string | null>(null);
  const txns = useLiveQuery(() => listWalletTxns(user.id), ['walletTxns'], [user.id]);
  const payments = useLiveQuery(() => listMyPayments(user.id), ['payments'], [user.id]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = Number(amount);
    if (!Number.isInteger(n) || n < MIN_TOPUP || n > MAX_TOPUP) return setError(`Enter a whole amount between ${rupees(MIN_TOPUP)} and ${rupees(MAX_TOPUP)}.`);
    navigate(`/pay/topup/${n}`);
  };

  return (
    <div className="pb-10">
      <PageHeader title="Wallet" back="/profile" action={<SimulationBadge />} />
      <div className="space-y-3 px-4 pt-3">
        <section className="rounded-3xl bg-gradient-to-br from-leaf-600 to-leaf-700 p-5 text-white">
          <p className="text-sm text-white/80">Available balance</p>
          <p className="text-4xl font-bold">{rupees(user.walletBalance)}</p>
          <p className="mt-1 text-xs text-white/80">Refunds and skipped plan meals land here instantly. Use it at checkout.</p>
        </section>

        <form onSubmit={submit} className="card p-4" noValidate>
          <label htmlFor="amt" className="label">
            Add money
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-ink-muted">₹</span>
            <input
              id="amt"
              inputMode="numeric"
              className={`input pl-9 text-lg font-semibold ${error ? 'input-error' : ''}`}
              placeholder="Amount"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value.replace(/\D/g, '').slice(0, 5));
                setError(null);
              }}
              aria-invalid={!!error}
              aria-describedby="amt-help"
            />
          </div>
          <p id="amt-help" className={`mt-1.5 text-sm ${error ? 'font-medium text-red-700' : 'text-ink-muted'}`} role={error ? 'alert' : undefined}>
            {error ?? `Min ${rupees(MIN_TOPUP)}, max ${rupees(MAX_TOPUP)} · paid via simulated UPI`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button key={p} type="button" onClick={() => setAmount(String(p))} className={`chip ${amount === String(p) ? 'chip-on' : 'chip-off'}`}>
                +{rupees(p)}
              </button>
            ))}
          </div>
          <Button type="submit" size="lg" className="mt-4">
            Proceed to add {amount ? rupees(Number(amount)) : 'money'}
          </Button>
        </form>

        <SectionTitle>Wallet activity</SectionTitle>
        <QueryView q={txns} skeleton={<ListSkeleton count={3} lines={1} />}>
          {(list) =>
            list.length === 0 ? (
              <EmptyState emoji="👛" title="No wallet activity yet" body="Top-ups, refunds and plan credits will show here." />
            ) : (
              <ul className="card divide-y divide-line">
                {list.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 p-4">
                    <span className="text-xl" aria-hidden="true">{TXN_ICON[t.type]}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{t.note}</p>
                      <p className="text-xs text-ink-muted">
                        {timeAgo(t.createdAt, now)} · balance {rupees(t.balanceAfter)}
                      </p>
                    </div>
                    <span className={`font-bold ${t.amount >= 0 ? 'text-leaf-700' : 'text-ink'}`}>
                      {t.amount >= 0 ? '+' : '−'}
                      {rupees(Math.abs(t.amount))}
                    </span>
                  </li>
                ))}
              </ul>
            )
          }
        </QueryView>

        <SectionTitle>All payments</SectionTitle>
        <QueryView q={payments} skeleton={<ListSkeleton count={2} lines={1} />}>
          {(list) =>
            list.length === 0 ? (
              <p className="text-sm text-ink-muted">No payments yet.</p>
            ) : (
              <ul className="card divide-y divide-line">
                {list.map((p) => {
                  const row = (
                    <>
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-xs">{p.txnId}</p>
                        <p className="text-xs text-ink-muted">
                          {p.purpose === 'wallet_topup' ? 'Wallet top-up' : p.purpose === 'subscription' ? 'Plan' : 'Order'} · {timeAgo(p.createdAt, now)}
                        </p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${p.status === 'success' ? 'bg-leaf-100 text-leaf-700' : p.status === 'pending' || p.status === 'processing' ? 'bg-turmeric-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
                        {p.status}
                      </span>
                      <span className="w-16 text-right font-semibold">{rupees(p.amount)}</span>
                    </>
                  );
                  return (
                    <li key={p.id}>
                      {p.status === 'success' ? (
                        <Link to={`/receipt/${p.id}`} className="flex items-center gap-3 p-4">{row}</Link>
                      ) : (
                        <div className="flex items-center gap-3 p-4">{row}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )
          }
        </QueryView>
      </div>
    </div>
  );
}
