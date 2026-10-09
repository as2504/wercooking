import { Link, useNavigate } from 'react-router-dom';
import { useSession, useUser } from '@/store/session';
import { logout } from '@/api/session';
import { formatPhone, rupees } from '@/lib/format';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Badge, PageHeader } from '@/components/ui/Misc';
import { triggerInstall, useInstall, isIOS } from '@/components/InstallPrompt';
import { toast } from '@/store/toast';

function Row({ to, icon, label, detail, onClick }: { to?: string; icon: IconName; label: string; detail?: React.ReactNode; onClick?: () => void }) {
  const inner = (
    <>
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <span className="flex-1 font-medium">{label}</span>
      {detail && <span className="text-sm text-ink-muted">{detail}</span>}
      <Icon name="chevron" className="h-4 w-4 text-ink-muted" />
    </>
  );
  const cls = 'flex min-h-[60px] w-full items-center gap-3 px-4 text-left hover:bg-black/[.02]';
  return <li>{to ? <Link to={to} className={cls}>{inner}</Link> : <button type="button" onClick={onClick} className={cls}>{inner}</button>}</li>;
}

export default function Profile() {
  const user = useUser();
  const refresh = useSession((s) => s.refresh);
  const navigate = useNavigate();
  const { deferred, installed } = useInstall();

  return (
    <div>
      <PageHeader title="Profile" />
      <div className="space-y-4 px-4 pt-3">
        <section className="card flex items-center gap-4 p-4">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-brand-600 text-xl font-bold text-white" aria-hidden="true">
            {user.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold">{user.name}</p>
            <p className="text-sm text-ink-muted">{formatPhone(user.phone)}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              <Badge tone={user.diet === 'veg' ? 'green' : 'amber'}>{user.diet === 'veg' ? '🟢 Veg' : '🥚 Veg + Egg'}</Badge>
              <Badge>🌶 {user.spice}</Badge>
            </div>
          </div>
          <Link to="/profile/edit" className="grid h-11 w-11 place-items-center rounded-full hover:bg-black/5" aria-label="Edit profile">
            <Icon name="edit" className="h-5 w-5" />
          </Link>
        </section>

        <Link to="/wallet" className="flex items-center gap-4 rounded-2xl bg-gradient-to-r from-leaf-600 to-leaf-700 p-4 text-white shadow-card">
          <Icon name="wallet" className="h-7 w-7" />
          <div className="flex-1">
            <p className="text-sm text-white/80">Wallet balance</p>
            <p className="text-2xl font-bold">{rupees(user.walletBalance)}</p>
          </div>
          <span className="text-sm font-semibold">Add money →</span>
        </Link>

        <ul className="card divide-y divide-line overflow-hidden">
          <Row to="/orders?tab=plans" icon="calendar" label="My plans" />
          <Row to="/notifications" icon="bell" label="Notifications" />
          <Row to="/profile/edit" icon="user" label="Preferences" detail={user.area} />
          {!installed && (deferred || isIOS()) && (
            <Row
              icon="download"
              label="Install app"
              onClick={async () => {
                if (deferred) await triggerInstall();
                else toast.info('Add to Home Screen', 'In Safari tap Share, then “Add to Home Screen”.');
              }}
            />
          )}
        </ul>

        <ul className="card divide-y divide-line overflow-hidden">
          <Row to="/hygiene" icon="shield" label="How we keep it clean" />
          <Row to="/fssai" icon="info" label="FSSAI & kitchen info" />
          <Row to="/help" icon="help" label="Help & FAQ" />
          <Row to="/delivery" icon="truck" label="Delivery" detail={<Badge tone="amber">Coming soon</Badge>} />
        </ul>

        <ul className="card divide-y divide-line overflow-hidden">
          <Row to="/settings" icon="settings" label="Settings & demo tools" detail="Time travel, reset" />
          <Row to="/admin/unlock" icon="chef" label="Switch to Kitchen Admin" detail="PIN" />
          <Row
            icon="logout"
            label="Log out"
            onClick={async () => {
              logout();
              await refresh();
              navigate('/welcome', { replace: true });
            }}
          />
        </ul>
        <p className="pb-4 text-center text-xs text-ink-muted">WeAreCooking prototype v0.1 · all data stays on this device</p>
      </div>
    </div>
  );
}
