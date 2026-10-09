import type { AppNotification } from '@/types/models';
import { now } from '@/lib/clock';
import { uid } from '@/lib/id';
import { latency, read, write } from './base';

/** Stores an in-app notification. The UI (NotificationWatcher) turns new ones into
 * system notifications or toasts in the tab where that audience is signed in. */
export async function pushNotification(audience: string, title: string, body: string, link?: string): Promise<AppNotification> {
  const n: AppNotification = { id: uid('n'), audience, title, body, link, read: false, createdAt: now() };
  await write('notifications', (all) => [n, ...all].slice(0, 300));
  return n;
}

export async function listNotifications(audience: string): Promise<AppNotification[]> {
  await latency(60, 160);
  return (await read('notifications')).filter((n) => n.audience === audience);
}

export async function markAllRead(audience: string): Promise<void> {
  await write('notifications', (all) => all.map((n) => (n.audience === audience ? { ...n, read: true } : n)));
}
