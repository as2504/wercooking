import { Link, useNavigate } from 'react-router-dom';
import { lockAdmin } from '@/api/session';
import { useSession } from '@/store/session';
import { Icon, type IconName } from '@/components/ui/Icon';
import { AdminHeader } from './common';

const LINKS: { to: string; icon: IconName; label: string; body: string }[] = [
  { to: '/admin/updates/new', icon: 'camera', label: 'Post kitchen update', body: 'Photo, note, oil used, vegetables' },
  { to: '/admin/subscribers', icon: 'users', label: 'Subscribers', body: 'Plans, status, meals owed' },
  { to: '/admin/reports', icon: 'chart', label: 'Reports', body: 'Last 7 days: orders, revenue, top items, ratings' },
  { to: '/admin/notifications', icon: 'bell', label: 'Kitchen notifications', body: 'New orders, cancellations, ratings' },
  { to: '/settings', icon: 'settings', label: 'Demo tools', body: 'Time travel, reset demo data' },
];

export default function More() {
  const navigate = useNavigate();
  const user = useSession((s) => s.user);
  return (
    <div>
      <AdminHeader title="More" />
      <ul className="card mx-4 mt-3 divide-y divide-line overflow-hidden">
        {LINKS.map((l) => (
          <li key={l.to}>
            <Link to={l.to} className="flex min-h-[64px] items-center gap-3 px-4 hover:bg-black/[.02]">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700">
                <Icon name={l.icon} className="h-5 w-5" />
              </span>
              <span className="flex-1">
                <span className="block font-semibold">{l.label}</span>
                <span className="block text-xs text-ink-muted">{l.body}</span>
              </span>
              <Icon name="chevron" className="h-4 w-4 text-ink-muted" />
            </Link>
          </li>
        ))}
      </ul>
      <div className="mx-4 mt-4">
        <button
          type="button"
          onClick={() => {
            lockAdmin();
            navigate(user ? '/profile' : '/welcome', { replace: true });
          }}
          className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-xl border border-line bg-white font-semibold text-ink-soft"
        >
          <Icon name="logout" className="h-5 w-5" /> Exit Kitchen Admin
        </button>
        <p className="mt-3 text-center text-xs text-ink-muted">Tip: open the customer app in another tab to watch status changes arrive live.</p>
      </div>
    </div>
  );
}
