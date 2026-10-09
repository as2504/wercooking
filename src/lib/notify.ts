// System notifications via the Notifications API (through the service worker when available,
// which is required on Android). Falls back silently; the caller always shows an in-app toast too.

export type Perm = NotificationPermission | 'unsupported';

export function notificationPermission(): Perm {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
}

export async function requestNotificationPermission(): Promise<Perm> {
  if (typeof Notification === 'undefined') return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export async function showSystemNotification(title: string, body: string, url?: string): Promise<boolean> {
  if (notificationPermission() !== 'granted') return false;
  const options: NotificationOptions = { body, icon: '/pwa-192.png', badge: '/pwa-192.png', data: { url }, tag: `${title}-${body}`.slice(0, 60) };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(title, options);
      return true;
    }
    new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}
