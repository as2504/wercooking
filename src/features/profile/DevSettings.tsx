import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTimeOffset, setTimeOffset } from '@/lib/clock';
import { dateTime } from '@/lib/format';
import { istAt, istDate, addDays } from '@/lib/time';
import { resetDemoData } from '@/api/demo';
import { runJobs } from '@/api/engine';
import { useNow } from '@/hooks/useNow';
import { useSession } from '@/store/session';
import { useCart } from '@/store/cart';
import { toast } from '@/store/toast';
import { notificationPermission, requestNotificationPermission } from '@/lib/notify';
import { Button } from '@/components/ui/Button';
import { PageHeader, SectionTitle, SimulationBadge } from '@/components/ui/Misc';
import { Sheet } from '@/components/ui/Sheet';

const H = 3_600_000;

export default function DevSettings() {
  const now = useNow(1000);
  const navigate = useNavigate();
  const refresh = useSession((s) => s.refresh);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState('');
  const [perm, setPerm] = useState(notificationPermission());
  const offset = getTimeOffset();

  const shift = (ms: number) => {
    setTimeOffset(getTimeOffset() + ms);
    void runJobs();
  };
  /** Jump to an IST wall-clock time on a date relative to the simulated today. */
  const jumpTo = (time: string, dayOffset = 0) => {
    const target = istAt(addDays(istDate(now), dayOffset), time);
    setTimeOffset(target - Date.now());
    void runJobs();
    toast.info('Time travelled', dateTime(target));
  };

  return (
    <div>
      <PageHeader title="Settings & demo tools" back />
      <div className="mx-auto max-w-screen-sm space-y-2 px-4 pb-10 pt-3">
        <section className="card p-4" aria-labelledby="tt">
          <div className="flex items-center justify-between">
            <h2 id="tt" className="font-sans text-lg font-bold">⏱ Time travel</h2>
            <SimulationBadge />
          </div>
          <p className="mt-1 text-sm text-ink-muted">Dev-only. Moves the app clock (IST) for every tab, to test cutoffs and subscriptions.</p>
          <p className="mt-3 rounded-xl bg-cream px-4 py-3 font-mono text-lg font-bold" aria-live="polite">
            {dateTime(now)}
          </p>
          <p className="mt-1 text-xs text-ink-muted">{offset === 0 ? 'Real time' : `Offset: ${(offset / H).toFixed(2)} h`}</p>
          <div className="mt-3 grid grid-cols-4 gap-2">
            <Button size="sm" variant="secondary" onClick={() => shift(-H)}>−1h</Button>
            <Button size="sm" variant="secondary" onClick={() => shift(H)}>+1h</Button>
            <Button size="sm" variant="secondary" onClick={() => shift(3 * H)}>+3h</Button>
            <Button size="sm" variant="secondary" onClick={() => shift(24 * H)}>+1 day</Button>
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink-muted">Jump to (today)</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button size="sm" variant="secondary" onClick={() => jumpTo('08:55')}>8:55 AM · lunch cutoff soon</Button>
            <Button size="sm" variant="secondary" onClick={() => jumpTo('12:00')}>12:00 PM · lunch cooking</Button>
            <Button size="sm" variant="secondary" onClick={() => jumpTo('15:55')}>3:55 PM · dinner cutoff soon</Button>
            <Button size="sm" variant="secondary" onClick={() => jumpTo('20:55')}>8:55 PM · breakfast cutoff soon</Button>
            <Button size="sm" variant="secondary" onClick={() => jumpTo('07:00', 1)}>Tomorrow 7:00 AM</Button>
            <Button size="sm" variant="secondary" onClick={() => jumpTo('12:30', 1)}>Tomorrow 12:30 PM</Button>
          </div>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!custom) return;
              const [d, t] = custom.split('T');
              setTimeOffset(istAt(d, t) - Date.now());
              void runJobs();
            }}
          >
            <label htmlFor="custom-time" className="sr-only">Custom IST date and time</label>
            <input id="custom-time" type="datetime-local" className="input flex-1" value={custom} onChange={(e) => setCustom(e.target.value)} />
            <Button type="submit" variant="secondary">Go</Button>
          </form>
          <Button variant="ghost" className="mt-2 w-full" disabled={offset === 0} onClick={() => setTimeOffset(0)}>
            Back to real time
          </Button>
        </section>

        <SectionTitle>Notifications</SectionTitle>
        <div className="card flex items-center gap-3 p-4">
          <p className="flex-1 text-sm">
            System notifications: <strong>{perm}</strong>
          </p>
          {perm === 'default' && (
            <Button size="sm" onClick={async () => setPerm(await requestNotificationPermission())}>
              Enable
            </Button>
          )}
        </div>

        <SectionTitle>Demo data</SectionTitle>
        <div className="card p-4">
          <p className="text-sm text-ink-soft">Wipes all orders, payments, plans, wallet and your account, then re-seeds a week of realistic data.</p>
          <Button variant="danger" className="mt-3 w-full" onClick={() => setConfirm(true)}>
            Reset demo data
          </Button>
        </div>
      </div>

      <Sheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Reset all demo data?"
        footer={
          <Button
            variant="danger"
            size="lg"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              await resetDemoData();
              setTimeOffset(0);
              useCart.getState().clear();
              await refresh();
              setBusy(false);
              setConfirm(false);
              toast.success('Demo data reset');
              navigate('/welcome', { replace: true });
            }}
          >
            Yes, reset everything
          </Button>
        }
      >
        <p className="text-ink-soft">You’ll be signed out and the clock returns to real time. This can’t be undone.</p>
      </Sheet>
    </div>
  );
}
