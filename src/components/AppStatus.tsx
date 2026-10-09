import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from './ui/Button';

/** "New version available" prompt from the service worker, plus an offline notice. */
export function AppStatus() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // Check for a new deploy every hour while the app stays open.
      if (reg) setInterval(() => void reg.update(), 60 * 60 * 1000);
    },
  });
  const online = useOnline();

  useEffect(() => {
    if (!offlineReady) return;
    const t = setTimeout(() => setOfflineReady(false), 4000);
    return () => clearTimeout(t);
  }, [offlineReady, setOfflineReady]);

  return (
    <>
      {!online && (
        <div className="safe-top fixed inset-x-0 top-0 z-[55] bg-ink px-4 py-1.5 text-center text-xs font-semibold text-white" role="status">
          You’re offline. Everything still works on this device. Real sync would resume when you’re back online.
        </div>
      )}
      {(needRefresh || offlineReady) && (
        <div className="fixed inset-x-3 bottom-[calc(76px+env(safe-area-inset-bottom))] z-[55] mx-auto flex max-w-sm items-center gap-3 rounded-2xl bg-ink p-3 text-white shadow-xl" role="status">
          <p className="flex-1 text-sm">{needRefresh ? 'A new version of WeAreCooking is ready.' : 'Ready to work offline ✓'}</p>
          {needRefresh && (
            <Button size="sm" onClick={() => void updateServiceWorker(true)}>
              Update
            </Button>
          )}
          <button
            type="button"
            className="px-2 text-sm text-white/80"
            onClick={() => {
              setNeedRefresh(false);
              setOfflineReady(false);
            }}
          >
            {needRefresh ? 'Later' : 'OK'}
          </button>
        </div>
      )}
    </>
  );
}

function useOnline() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}
