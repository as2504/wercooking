import { useEffect, useState } from 'react';
import { RouterProvider } from 'react-router-dom';
import { ensureSeeded } from '@/api/demo';
import { useSession } from '@/store/session';
import { Splash } from '@/components/Splash';
import { router } from '@/routes';

export default function App() {
  const ready = useSession((s) => s.ready);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    ensureSeeded()
      .then(() => useSession.getState().refresh())
      .catch((e: unknown) => setBootError(e instanceof Error ? e.message : String(e)));
  }, []);

  if (bootError)
    return (
      <div className="mx-auto max-w-sm p-6 pt-24 text-center" role="alert">
        <h1 className="text-xl font-semibold">Couldn't start the app</h1>
        <p className="mt-2 text-sm text-ink-muted">{bootError}</p>
        <button className="mt-4 underline" onClick={() => location.reload()}>
          Reload
        </button>
      </div>
    );
  if (!ready) return <Splash />;
  return <RouterProvider router={router} />;
}
