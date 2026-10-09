import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { useNow } from '@/hooks/useNow';
import { listNotifications, markAllRead } from '@/api/notifications';
import { timeAgo } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/Misc';
import { EmptyState, ListSkeleton, QueryView } from '@/components/ui/States';
import { notificationPermission, requestNotificationPermission } from '@/lib/notify';

/** Shared by the customer (audience = user id) and the kitchen admin (audience = "admin"). */
export default function Notifications({ audience, back = '/' }: { audience: string; back?: string }) {
  const now = useNow(30_000);
  const q = useLiveQuery(() => listNotifications(audience), ['notifications'], [audience]);
  const [perm, setPerm] = useState(notificationPermission());

  useEffect(() => {
    const t = setTimeout(() => void markAllRead(audience), 1500);
    return () => clearTimeout(t);
  }, [audience]);

  return (
    <div>
      <PageHeader title="Notifications" back={back} />
      <div className="space-y-3 px-4 pt-3">
        {perm === 'default' && (
          <div className="card flex items-center gap-3 p-4">
            <span className="text-2xl" aria-hidden="true">🔔</span>
            <p className="flex-1 text-sm">Get order updates even when the app is in the background.</p>
            <Button size="sm" onClick={async () => setPerm(await requestNotificationPermission())}>
              Enable
            </Button>
          </div>
        )}
        {perm === 'denied' && <p className="text-xs text-ink-muted">System notifications are blocked in your browser settings. You'll still see in-app alerts.</p>}
        <QueryView q={q} skeleton={<ListSkeleton count={4} lines={1} />}>
          {(items) =>
            items.length === 0 ? (
              <EmptyState emoji="🔕" title="All quiet" body="Order updates and kitchen news will appear here." />
            ) : (
              <ul className="card divide-y divide-line">
                {items.map((n) => {
                  const body = (
                    <div className="flex gap-3 p-4">
                      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${n.read ? 'bg-transparent' : 'bg-brand-600'}`} aria-label={n.read ? undefined : 'Unread'} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{n.title}</p>
                        <p className="text-sm text-ink-soft">{n.body}</p>
                        <p className="mt-1 text-xs text-ink-muted">{timeAgo(n.createdAt, now)}</p>
                      </div>
                    </div>
                  );
                  return <li key={n.id}>{n.link ? <Link to={n.link}>{body}</Link> : body}</li>;
                })}
              </ul>
            )
          }
        </QueryView>
      </div>
    </div>
  );
}
