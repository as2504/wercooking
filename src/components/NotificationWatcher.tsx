import { useEffect, useRef } from 'react';
import { listNotifications } from '@/api/notifications';
import { onChange } from '@/api/sync';
import { showSystemNotification } from '@/lib/notify';
import { toast } from '@/store/toast';

/**
 * Watches the notification store for this audience and surfaces new entries:
 * a system notification when the tab is hidden (if permitted), otherwise an in-app toast.
 */
export function NotificationWatcher({ audience }: { audience: string }) {
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      const list = await listNotifications(audience).catch(() => []);
      if (!alive) return;
      if (!seen.current) {
        seen.current = new Set(list.map((n) => n.id));
        return;
      }
      const fresh = list.filter((n) => !seen.current!.has(n.id)).reverse();
      for (const n of fresh) {
        seen.current.add(n.id);
        const shown = document.visibilityState === 'hidden' && (await showSystemNotification(n.title, n.body, n.link));
        if (!shown) toast.info(n.title, n.body, n.link);
      }
    };
    void check();
    const off = onChange((c) => c.includes('notifications') && void check());
    return () => {
      alive = false;
      off();
    };
  }, [audience]);

  return null;
}
