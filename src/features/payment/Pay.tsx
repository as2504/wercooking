import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Payment, PaymentMethod, PaymentPurpose, SimOutcome } from '@/types/models';
import { useSession, useUser } from '@/store/session';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import {
  PENDING_SETTLE_MS, UPI_ID_RE, getPayTarget, getSimOutcome, payWithWallet, resolvePayment, setSimOutcome, startUpiPayment, type PayTarget,
} from '@/api/payments';
import { rupees, rupees2 } from '@/lib/format';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { PageHeader, SimulationBadge } from '@/components/ui/Misc';
import { Sheet } from '@/components/ui/Sheet';
import { Spinner } from '@/components/ui/Spinner';
import { CardSkeleton, ErrorState } from '@/components/ui/States';
import { QR } from '@/components/QR';

const PURPOSES: PaymentPurpose[] = ['order', 'subscription', 'wallet_topup'];

export default function Pay() {
  const { purpose: rawPurpose = '', id = '' } = useParams();
  const purpose = (rawPurpose === 'topup' ? 'wallet_topup' : rawPurpose) as PaymentPurpose;
  const user = useUser();
  const target = useLiveQuery(() => getPayTarget(purpose, id, user.id), [], [purpose, id, user.id]);
  const [simOpen, setSimOpen] = useState(false);

  if (!PURPOSES.includes(purpose)) return <ErrorState error={new Error('Unknown payment link.')} />;

  return (
    <div className="min-h-[100dvh] pb-40">
      <PageHeader title="Payment" back action={<SimulationBadge onLongPress={() => setSimOpen(true)} />} />
      <div className="px-4 pt-3">
        {target.error ? (
          <div className="space-y-3">
            <ErrorState error={target.error} />
            <ButtonLink to="/orders" variant="secondary" size="lg">Go to my orders</ButtonLink>
          </div>
        ) : !target.data ? (
          <div className="space-y-3">
            <CardSkeleton lines={2} />
            <CardSkeleton lines={4} />
          </div>
        ) : (
          <PayFlow target={target.data} onOpenSim={() => setSimOpen(true)} />
        )}
      </div>
      <SimulatorSheet open={simOpen} onClose={() => setSimOpen(false)} />
    </div>
  );
}

type Stage = { kind: 'choose' } | { kind: 'processing'; payment: Payment } | { kind: 'pending'; payment: Payment } | { kind: 'result'; payment: Payment };

const APPS = [
  { label: 'Pay app', color: 'bg-violet-600' },
  { label: 'Bank app', color: 'bg-sky-600' },
  { label: 'Wallet app', color: 'bg-emerald-600' },
  { label: 'Other UPI app', color: 'bg-stone-600' },
];

function PayFlow({ target, onOpenSim }: { target: PayTarget; onOpenSim: () => void }) {
  const user = useUser();
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>({ kind: 'choose' });
  const [method, setMethod] = useState<PaymentMethod>('upi_app');
  const [app, setApp] = useState(APPS[0].label);
  const [upiId, setUpiId] = useState('');
  const [upiError, setUpiError] = useState<string | null>(null);
  const [verified, setVerified] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const outcome = useOutcome();

  // Already paid (e.g. opened an old link): go straight to the receipt.
  useEffect(() => {
    if (target.paidWith) navigate(`/receipt/${target.paidWith}`, { replace: true });
  }, [target.paidWith, navigate]);

  const isTopup = target.purpose === 'wallet_topup';
  const walletShort = Math.max(0, target.amount - user.walletBalance);

  const verifyUpi = async () => {
    if (!UPI_ID_RE.test(upiId)) {
      setUpiError('Enter a valid UPI ID, like name@bank.');
      return false;
    }
    setVerifying(true);
    await new Promise((r) => setTimeout(r, 600));
    setVerifying(false);
    setVerified(user.name.toUpperCase());
    return true;
  };

  const pay = async () => {
    setError(null);
    if (method === 'upi_id' && !verified && !(await verifyUpi())) return;
    setBusy(true);
    try {
      if (method === 'wallet') {
        const p = await payWithWallet(user.id, target);
        await useSession.getState().refresh();
        setStage({ kind: 'result', payment: p });
      } else {
        const p = await startUpiPayment({ userId: user.id, target, method, upiId: method === 'upi_id' ? upiId : undefined, appLabel: method === 'upi_app' ? app : undefined });
        setAttempts((a) => a + 1);
        setStage({ kind: 'processing', payment: p });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (stage.kind === 'processing')
    return (
      <Processing
        payment={stage.payment}
        method={method}
        onDone={async (p) => {
          if (p.status === 'pending') setStage({ kind: 'pending', payment: p });
          else {
            if (p.status === 'success') await useSession.getState().refresh();
            setStage({ kind: 'result', payment: p });
          }
        }}
      />
    );
  if (stage.kind === 'pending')
    return (
      <Pending
        payment={stage.payment}
        onDone={async (p) => {
          await useSession.getState().refresh();
          setStage({ kind: 'result', payment: p });
        }}
      />
    );
  if (stage.kind === 'result') return <Result payment={stage.payment} target={target} onRetry={() => setStage({ kind: 'choose' })} />;

  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-gradient-to-br from-ink to-stone-700 p-5 text-white" aria-label="Amount">
        <p className="text-sm text-white/70">Paying WeAreCooking Kitchen</p>
        <p className="mt-1 text-4xl font-bold">{rupees(target.amount)}</p>
        <p className="mt-1 text-sm text-white/80">
          {target.title} · {target.subtitle}
        </p>
        <p className="mt-3 inline-block rounded-full bg-turmeric-400/20 px-3 py-1 text-xs font-semibold text-turmeric-100">Simulated payment: no real money moves</p>
      </section>

      {attempts > 0 && <p className="rounded-xl bg-turmeric-100 px-4 py-2 text-sm text-amber-900">Attempt {attempts + 1}. Previous attempt didn't go through, nothing was charged.</p>}

      <fieldset className="space-y-2">
        <legend className="mb-2 text-lg font-semibold">Pay with UPI</legend>

        <MethodCard id="upi_app" method={method} setMethod={setMethod} title="UPI app on this phone" icon="📱">
          <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="UPI app">
            {APPS.map((a) => (
              <button key={a.label} type="button" role="radio" aria-checked={app === a.label} onClick={() => setApp(a.label)} className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-left text-sm font-semibold ${app === a.label ? 'border-brand-600 bg-brand-50' : 'border-line bg-white'}`}>
                <span className={`grid h-7 w-7 place-items-center rounded-lg text-xs font-bold text-white ${a.color}`} aria-hidden="true">
                  {a.label[0]}
                </span>
                {a.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-muted">Generic app chips. No real app will open.</p>
        </MethodCard>

        <MethodCard id="upi_id" method={method} setMethod={setMethod} title="Enter UPI ID" icon="🆔">
          <div className="mt-3">
            <label htmlFor="upi" className="sr-only">UPI ID</label>
            <div className="flex gap-2">
              <input
                id="upi"
                className={`input flex-1 ${upiError ? 'input-error' : ''}`}
                placeholder="yourname@bank"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={upiId}
                onChange={(e) => {
                  setUpiId(e.target.value.trim());
                  setUpiError(null);
                  setVerified(null);
                }}
                aria-invalid={!!upiError}
                aria-describedby="upi-help"
              />
              <Button variant="secondary" loading={verifying} onClick={verifyUpi}>
                Verify
              </Button>
            </div>
            <p id="upi-help" className={`mt-1.5 text-sm ${upiError ? 'font-medium text-red-700' : verified ? 'font-semibold text-leaf-700' : 'text-ink-muted'}`} role={upiError ? 'alert' : undefined}>
              {upiError ?? (verified ? `✓ ${verified} (simulated name lookup)` : 'e.g. rahul.patil@okbank. Any valid format works in the demo.')}
            </p>
          </div>
        </MethodCard>

        <MethodCard id="upi_qr" method={method} setMethod={setMethod} title="Scan QR from another phone" icon="🔳">
          <div className="mt-3 flex items-center gap-4">
            <div className="relative h-[140px] w-[140px] shrink-0">
              <QR value={`SIMULATION-ONLY|NOT-A-UPI-QR|WeAreCooking|${target.title}|INR ${target.amount}`} size={140} label="Mock payment QR code (simulation, not scannable for real payment)" />
              <span className="absolute inset-x-0 bottom-1 mx-auto w-fit rounded bg-turmeric-400 px-1.5 text-[10px] font-bold text-ink">MOCK</span>
            </div>
            <p className="text-sm text-ink-soft">Scan with any UPI app, then tap “I’ve paid”. This QR is a mock and can’t be paid for real.</p>
          </div>
        </MethodCard>
      </fieldset>

      {!isTopup && (
        <fieldset>
          <legend className="mb-2 text-lg font-semibold">Or use your wallet</legend>
          <MethodCard id="wallet" method={method} setMethod={setMethod} title={`WeAreCooking wallet · ${rupees(user.walletBalance)}`} icon="👛" disabled={walletShort > 0}>
            {walletShort > 0 && (
              <p className="mt-2 text-sm text-ink-soft">
                Short by {rupees(walletShort)}.{' '}
                <Link to={`/wallet?add=${Math.max(50, Math.ceil(walletShort / 50) * 50)}`} className="font-semibold text-brand-700 underline">
                  Add money
                </Link>
              </p>
            )}
          </MethodCard>
        </fieldset>
      )}

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}

      <div className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-screen-sm">
          <Button size="lg" loading={busy} onClick={pay} disabled={method === 'wallet' && walletShort > 0}>
            <Icon name="lock" className="h-4 w-4" />
            {method === 'upi_qr' ? `I’ve paid ${rupees(target.amount)}` : method === 'wallet' ? `Pay ${rupees(target.amount)} from wallet` : `Pay ${rupees(target.amount)}`}
          </Button>
          <button type="button" onClick={onOpenSim} className="mt-1 w-full text-center text-[11px] text-ink-muted">
            🧪 Simulator outcome: <strong>{OUTCOMES.find((o) => o.value === outcome)?.label}</strong> (long-press SIMULATION to change)
          </button>
        </div>
      </div>
    </div>
  );
}

function MethodCard({ id, method, setMethod, title, icon, children, disabled }: { id: PaymentMethod; method: PaymentMethod; setMethod: (m: PaymentMethod) => void; title: string; icon: string; children?: React.ReactNode; disabled?: boolean }) {
  const on = method === id;
  return (
    <div className={`rounded-2xl border-2 bg-white transition ${on ? 'border-brand-600' : 'border-line'} ${disabled ? 'opacity-70' : ''}`}>
      <label className="flex min-h-[56px] cursor-pointer items-center gap-3 px-4">
        <input type="radio" name="method" className="h-5 w-5 accent-brand-600" checked={on} disabled={disabled} onChange={() => setMethod(id)} />
        <span className="text-xl" aria-hidden="true">{icon}</span>
        <span className="flex-1 font-semibold">{title}</span>
      </label>
      {(on || disabled) && children && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function useOutcome(): SimOutcome {
  const [o, setO] = useState(getSimOutcome);
  useEffect(() => {
    const f = () => setO(getSimOutcome());
    window.addEventListener('wac-sim', f);
    window.addEventListener('storage', f);
    return () => {
      window.removeEventListener('wac-sim', f);
      window.removeEventListener('storage', f);
    };
  }, []);
  return o;
}

const OUTCOMES: { value: SimOutcome; label: string; body: string }[] = [
  { value: 'success', label: 'Success', body: 'Payment approved after ~2.5 s.' },
  { value: 'failed', label: 'Failed (insufficient balance)', body: 'Bank declines. Retry is offered.' },
  { value: 'pending', label: 'Pending → success in 5 s', body: 'Bank is slow; settles automatically.' },
  { value: 'timeout', label: 'Timeout', body: 'No response from bank after ~8 s.' },
];

function SimulatorSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const outcome = useOutcome();
  return (
    <Sheet open={open} onClose={onClose} title="🧪 Payment simulator" footer={<Button size="lg" onClick={onClose}>Done</Button>}>
      <p className="text-sm text-ink-soft">Choose what the next UPI payment will do. Wallet payments always succeed if the balance is enough.</p>
      <div className="mt-4 space-y-2" role="radiogroup" aria-label="Next payment outcome">
        {OUTCOMES.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={outcome === o.value}
            onClick={() => {
              setSimOutcome(o.value);
              window.dispatchEvent(new Event('wac-sim'));
            }}
            className={`w-full rounded-xl border-2 px-4 py-3 text-left ${outcome === o.value ? 'border-brand-600 bg-brand-50' : 'border-line bg-white'}`}
          >
            <span className="block font-semibold">{o.label}</span>
            <span className="block text-xs text-ink-muted">{o.body}</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

function Processing({ payment, method, onDone }: { payment: Payment; method: PaymentMethod; onDone: (p: Payment) => void }) {
  const [elapsed, setElapsed] = useState(0);
  const [cancelling, setCancelling] = useState(false);
  const done = useRef(false);
  const outcome = getSimOutcome();
  const waitMs = outcome === 'timeout' ? 8000 : 2500;

  useEffect(() => {
    const started = Date.now();
    const tick = setInterval(() => setElapsed(Date.now() - started), 250);
    const t = setTimeout(async () => {
      if (done.current) return;
      done.current = true;
      onDone(await resolvePayment(payment.id, outcome));
    }, waitMs);
    return () => {
      clearInterval(tick);
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payment.id]);

  const cancel = async () => {
    if (done.current) return;
    done.current = true;
    setCancelling(true);
    onDone(await resolvePayment(payment.id, 'failed', 'You cancelled the payment.'));
  };

  const left = Math.max(0, 300 - Math.floor(elapsed / 1000));
  return (
    <div className="flex flex-col items-center pt-10 text-center" role="status" aria-live="polite">
      <div className="relative grid h-28 w-28 place-items-center">
        <Spinner className="absolute h-28 w-28 text-brand-500" />
        <span className="text-4xl" aria-hidden="true">{method === 'upi_qr' ? '🔳' : '📱'}</span>
      </div>
      <h2 className="mt-6 text-2xl font-bold">{method === 'upi_qr' ? 'Checking for your payment…' : 'Approve in your UPI app'}</h2>
      <p className="mt-2 max-w-xs text-ink-soft">
        {method === 'upi_app' ? `Open ${payment.appLabel} and approve ${rupees2(payment.amount)}.` : method === 'upi_id' ? `A collect request for ${rupees2(payment.amount)} was sent to ${payment.upiId}.` : 'Waiting for the bank to confirm.'}
      </p>
      <p className="mt-1 text-xs text-ink-muted">(Simulated. Nothing is sent to any app or bank.)</p>
      <p className="mt-6 font-mono text-lg font-bold" aria-label={`Request expires in ${Math.floor(left / 60)} minutes ${left % 60} seconds`}>
        {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
      </p>
      <p className="text-xs text-ink-muted">Don’t close this screen or press back</p>
      <p className="mt-4 font-mono text-xs text-ink-muted">Txn {payment.txnId}</p>
      <Button variant="ghost" className="mt-8" loading={cancelling} onClick={cancel}>
        Cancel payment
      </Button>
    </div>
  );
}

function Pending({ payment, onDone }: { payment: Payment; onDone: (p: Payment) => void }) {
  const [left, setLeft] = useState(Math.ceil(PENDING_SETTLE_MS / 1000));
  useEffect(() => {
    const tick = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    const t = setTimeout(async () => onDone(await resolvePayment(payment.id, 'success')), PENDING_SETTLE_MS);
    return () => {
      clearInterval(tick);
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payment.id]);
  return (
    <div className="flex flex-col items-center pt-10 text-center" role="status" aria-live="polite">
      <div className="grid h-24 w-24 place-items-center rounded-full bg-turmeric-100 text-5xl" aria-hidden="true">⏳</div>
      <h2 className="mt-6 text-2xl font-bold">Payment pending</h2>
      <p className="mt-2 max-w-xs text-ink-soft">Your bank is taking a little longer. We’ll confirm automatically. Please don’t pay again.</p>
      <p className="mt-4 text-sm font-semibold text-amber-800">Checking again in {left}s…</p>
      <p className="mt-4 font-mono text-xs text-ink-muted">Txn {payment.txnId}</p>
    </div>
  );
}

function Result({ payment, target, onRetry }: { payment: Payment; target: PayTarget; onRetry: () => void }) {
  const ok = payment.status === 'success';
  const next =
    payment.purpose === 'order' && payment.refId
      ? { to: `/orders/${payment.refId}`, label: 'Track my order' }
      : payment.purpose === 'subscription' && payment.refId
        ? { to: `/plans/${payment.refId}`, label: 'View my plan' }
        : { to: '/wallet', label: 'Go to wallet' };
  return (
    <div className="flex flex-col items-center pt-8 text-center" role="status" aria-live="assertive">
      <div className={`grid h-24 w-24 animate-pop place-items-center rounded-full text-5xl ${ok ? 'bg-leaf-100' : payment.status === 'timeout' ? 'bg-turmeric-100' : 'bg-red-100'}`} aria-hidden="true">
        {ok ? '✅' : payment.status === 'timeout' ? '⌛' : '❌'}
      </div>
      <h2 className="mt-5 text-2xl font-bold">{ok ? 'Payment successful' : payment.status === 'timeout' ? 'Payment timed out' : 'Payment failed'}</h2>
      <p className="mt-1 text-3xl font-bold">{rupees(payment.amount)}</p>
      <p className="mt-2 max-w-xs text-ink-soft">
        {ok
          ? `${target.title} is confirmed.`
          : payment.status === 'timeout'
            ? `${payment.failureReason} If money was debited, it would be auto-refunded in 3–5 working days. (Simulated, nothing was debited.)`
            : `${payment.failureReason} No money was taken.`}
      </p>
      <dl className="card mt-6 w-full space-y-1 p-4 text-left text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-ink-muted">Transaction ID</dt>
          <dd className="font-mono">{payment.txnId}</dd>
        </div>
        {payment.upiRef && (
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">UPI ref (RRN)</dt>
            <dd className="font-mono">{payment.upiRef}</dd>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <dt className="text-ink-muted">Method</dt>
          <dd>{payment.method === 'wallet' ? 'Wallet' : payment.method === 'upi_id' ? `UPI · ${payment.upiId}` : payment.method === 'upi_app' ? `UPI · ${payment.appLabel}` : 'UPI QR'}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-muted">Attempt</dt>
          <dd>#{payment.attempt}</dd>
        </div>
      </dl>
      <div className="mt-6 w-full space-y-2">
        {ok ? (
          <>
            <ButtonLink to={next.to} size="lg" replace>
              {next.label}
            </ButtonLink>
            <ButtonLink to={`/receipt/${payment.id}`} variant="secondary" size="lg">
              View receipt & invoice
            </ButtonLink>
          </>
        ) : (
          <>
            <Button size="lg" onClick={onRetry}>
              <Icon name="refresh" className="h-4 w-4" /> Retry payment
            </Button>
            <p className="text-xs text-ink-muted">Tip: try another UPI method{payment.purpose === 'wallet_topup' ? '' : ' or your wallet'}.</p>
          </>
        )}
      </div>
    </div>
  );
}
