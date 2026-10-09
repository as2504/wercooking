import { Link } from 'react-router-dom';
import { create } from 'zustand';
import type { ISODate } from '@/types/models';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { useNow } from '@/hooks/useNow';
import { listNotifications } from '@/api/notifications';
import { relativeDay } from '@/lib/format';
import { addDays, istDate } from '@/lib/time';
import { Icon } from '@/components/ui/Icon';

/** Date the admin is looking at (shared across admin screens). null = today. */
export const useAdminDate = create<{ date: ISODate | null; set: (d: ISODate | null) => void }>((set) => ({ date: null, set: (date) => set({ date }) }));

export function useSelectedDate(): ISODate {
  const now = useNow(60_000);
  const d = useAdminDate((s) => s.date);
  return d ?? istDate(now);
}

export function DateStepper() {
  const now = useNow(60_000);
  const date = useSelectedDate();
  const set = useAdminDate((s) => s.set);
  const today = istDate(now);
  return (
    <div className="flex items-center gap-1 rounded-xl bg-white p-1 ring-1 ring-line">
      <button type="button" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-black/5" onClick={() => set(addDays(date, -1))} aria-label="Previous day">
        <Icon name="back" className="h-4 w-4" />
      </button>
      <button type="button" className="min-w-[96px] text-sm font-bold" onClick={() => set(null)} aria-label="Jump to today">
        {relativeDay(date, now)}
        {date !== today && <span className="block text-[10px] font-semibold text-brand-700">tap for today</span>}
      </button>
      <button type="button" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-black/5" onClick={() => set(addDays(date, 1))} aria-label="Next day">
        <Icon name="chevron" className="h-4 w-4" />
      </button>
    </div>
  );
}

export function AdminHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  const notes = useLiveQuery(() => listNotifications('admin'), ['notifications']);
  const unread = notes.data?.filter((n) => !n.read).length ?? 0;
  return (
    <header className="sticky top-0 z-20 border-b border-line/70 bg-cream/95 backdrop-blur">
      <div className="mx-auto flex min-h-[60px] max-w-screen-md items-center gap-2 px-4">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold">{title}</h1>
          {subtitle && <p className="truncate text-xs text-ink-muted">{subtitle}</p>}
        </div>
        {action}
        <Link to="/admin/notifications" className="relative grid h-11 w-11 place-items-center rounded-full hover:bg-black/5" aria-label={`Kitchen notifications${unread ? `, ${unread} unread` : ''}`}>
          <Icon name="bell" className="h-5 w-5" />
          {unread > 0 && <span className="absolute right-1 top-1 min-w-[18px] rounded-full bg-brand-600 px-1 text-center text-[10px] font-bold leading-[18px] text-white">{unread > 9 ? '9+' : unread}</span>}
        </Link>
      </div>
    </header>
  );
}

export function Stat({ label, value, sub, tone = 'default' }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: 'default' | 'green' | 'brand' }) {
  const tones = { default: 'bg-white ring-1 ring-line', green: 'bg-leaf-50 ring-1 ring-leaf-500/30', brand: 'bg-brand-50 ring-1 ring-brand-200' };
  return (
    <div className={`rounded-2xl p-3 ${tones[tone]}`}>
      <p className="text-xs font-semibold text-ink-muted">{label}</p>
      <p className="mt-0.5 text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-ink-soft">{sub}</p>}
    </div>
  );
}
