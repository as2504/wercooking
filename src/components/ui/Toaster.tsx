import { useNavigate } from 'react-router-dom';
import { useToasts } from '@/store/toast';
import { Icon } from './Icon';

export function Toaster() {
  const { toasts, dismiss } = useToasts();
  const navigate = useNavigate();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-3 pt-[max(12px,env(safe-area-inset-top))]" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === 'error' ? 'alert' : 'status'}
          className={`pointer-events-auto flex w-full max-w-sm animate-pop items-start gap-3 rounded-2xl border p-3 shadow-lg ${
            t.kind === 'error' ? 'border-red-200 bg-red-50' : t.kind === 'success' ? 'border-leaf-100 bg-leaf-50' : 'border-line bg-white'
          }`}
        >
          <span className="mt-0.5 text-lg" aria-hidden="true">
            {t.kind === 'error' ? '⚠️' : t.kind === 'success' ? '✅' : '🔔'}
          </span>
          <button
            type="button"
            className="min-w-0 flex-1 text-left"
            onClick={() => {
              if (t.link) navigate(t.link);
              dismiss(t.id);
            }}
          >
            <p className="text-sm font-semibold">{t.title}</p>
            {t.body && <p className="text-sm text-ink-soft">{t.body}</p>}
          </button>
          <button type="button" onClick={() => dismiss(t.id)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-black/5" aria-label="Dismiss">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
