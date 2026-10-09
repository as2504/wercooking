import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { Button } from './ui/Button';
import { Icon } from './ui/Icon';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallState {
  deferred: BeforeInstallPromptEvent | null;
  installed: boolean;
}

export const useInstall = create<InstallState>(() => ({
  deferred: null,
  installed: typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true),
}));

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    useInstall.setState({ deferred: e as BeforeInstallPromptEvent });
  });
  window.addEventListener('appinstalled', () => useInstall.setState({ installed: true, deferred: null }));
}

export const isIOS = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

const DISMISS_KEY = 'wac:installDismissed';

export async function triggerInstall(): Promise<boolean> {
  const { deferred } = useInstall.getState();
  if (!deferred) return false;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  useInstall.setState({ deferred: null, installed: outcome === 'accepted' });
  return outcome === 'accepted';
}

/** Home-screen banner: native prompt on Android/desktop Chrome, instructions on iOS Safari. */
export function InstallBanner() {
  const { deferred, installed } = useInstall();
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === '1');
    } catch {
      setDismissed(false);
    }
  }, []);
  if (installed || dismissed || (!deferred && !isIOS())) return null;
  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="mt-4 flex items-start gap-3 rounded-2xl border border-brand-200 bg-white p-4 shadow-card">
      <img src="/pwa-192.png" alt="" className="h-12 w-12 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Install WeAreCooking</p>
        {deferred ? (
          <p className="text-sm text-ink-muted">One tap to your home screen. Works offline, opens instantly.</p>
        ) : (
          <p className="text-sm text-ink-muted">
            In Safari tap <Icon name="share" className="inline h-4 w-4" /> Share, then <strong>Add to Home Screen</strong>.
          </p>
        )}
        {deferred && (
          <Button size="sm" className="mt-2" onClick={() => void triggerInstall()}>
            Install app
          </Button>
        )}
      </div>
      <button type="button" onClick={dismiss} className="-mr-2 -mt-2 grid h-10 w-10 place-items-center rounded-full hover:bg-black/5" aria-label="Dismiss install banner">
        <Icon name="x" className="h-4 w-4" />
      </button>
    </div>
  );
}
