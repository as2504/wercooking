import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from './Icon';

export function Badge({ tone = 'neutral', children, className = '' }: { tone?: 'neutral' | 'brand' | 'green' | 'amber' | 'red' | 'blue'; children: ReactNode; className?: string }) {
  const tones = {
    neutral: 'bg-stone-100 text-stone-700',
    brand: 'bg-brand-100 text-brand-800',
    green: 'bg-leaf-100 text-leaf-700',
    amber: 'bg-turmeric-100 text-amber-800',
    red: 'bg-red-100 text-red-800',
    blue: 'bg-sky-100 text-sky-800',
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]} ${className}`}>{children}</span>;
}

export function Stepper({ value, onChange, min = 0, max = 20, label }: { value: number; onChange: (n: number) => void; min?: number; max?: number; label: string }) {
  return (
    <div className="inline-flex items-center rounded-xl border border-brand-200 bg-white" role="group" aria-label={`${label} quantity`}>
      <button type="button" className="grid h-10 w-10 place-items-center rounded-l-xl text-brand-700 hover:bg-brand-50 disabled:opacity-40" onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={`Decrease ${label}`}>
        <Icon name="minus" className="h-4 w-4" />
      </button>
      <span className="w-8 text-center font-semibold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button type="button" className="grid h-10 w-10 place-items-center rounded-r-xl text-brand-700 hover:bg-brand-50 disabled:opacity-40" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={`Increase ${label}`}>
        <Icon name="plus" className="h-4 w-4" />
      </button>
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex rounded-xl bg-stone-100 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`min-h-[40px] flex-1 rounded-lg px-2 text-sm font-semibold transition ${value === o.value ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-muted hover:text-ink'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function PageHeader({ title, subtitle, back, action }: { title: string; subtitle?: ReactNode; back?: boolean | string; action?: ReactNode }) {
  const navigate = useNavigate();
  return (
    <header className="safe-top sticky top-0 z-20 border-b border-line/70 bg-cream/95 backdrop-blur">
      <div className="mx-auto flex min-h-[60px] max-w-screen-sm items-center gap-2 px-4">
        {back && (
          <button
            type="button"
            onClick={() => (typeof back === 'string' ? navigate(back) : window.history.length > 1 ? navigate(-1) : navigate('/'))}
            className="-ml-2 grid h-11 w-11 place-items-center rounded-full hover:bg-black/5"
            aria-label="Go back"
          >
            <Icon name="back" className="h-5 w-5" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold">{title}</h1>
          {subtitle && <p className="truncate text-xs text-ink-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
    </header>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-end justify-between">
      <h2 className="text-lg font-semibold">{children}</h2>
      {action}
    </div>
  );
}

/** Persistent marker that payments / OTP / data are simulated. */
export function SimulationBadge({ className = '', onLongPress }: { className?: string; onLongPress?: () => void }) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const start = () => {
    if (onLongPress) timer = setTimeout(onLongPress, 700);
  };
  const stop = () => timer && clearTimeout(timer);
  return (
    <span
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onContextMenu={(e) => onLongPress && e.preventDefault()}
      className={`inline-flex select-none items-center gap-1 rounded-full border border-dashed border-amber-500 bg-turmeric-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-900 ${className}`}
    >
      ⚠ Simulation
    </span>
  );
}
