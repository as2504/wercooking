import type { ISODate, MealType } from '@/types/models';
import { slotBookings } from '@/api/orders';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { slotAvailability, slotsFor, type Windows } from '@/lib/cutoff';
import { Skeleton } from './ui/States';

/** 30-minute pickup slots with live remaining capacity. */
export function SlotPicker({
  meal,
  date,
  windows,
  value,
  onChange,
  nowMs,
  error,
}: {
  meal: MealType;
  date: ISODate;
  windows: Windows;
  value: string | null;
  onChange: (slotId: string) => void;
  nowMs: number;
  error?: string | null;
}) {
  const bookings = useLiveQuery(() => slotBookings(meal, date), ['orders'], [meal, date]);
  const slots = slotsFor(meal, windows);
  return (
    <fieldset>
      <legend className="sr-only">Pickup slot</legend>
      {!bookings.data ? (
        <div className="grid grid-cols-2 gap-2">
          {slots.map((s) => (
            <Skeleton key={s.id} className="h-16" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Pickup slot">
          {slots.map((s) => {
            const a = slotAvailability(s, date, bookings.data![s.id] ?? 0, nowMs, windows);
            const on = value === s.id;
            return (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={!a.open}
                onClick={() => onChange(s.id)}
                className={`rounded-xl border-2 px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${on ? 'border-brand-600 bg-brand-50' : 'border-line bg-white hover:border-brand-200'}`}
              >
                <span className="block text-sm font-bold">{s.label}</span>
                <span className={`block text-xs font-semibold ${!a.open ? 'text-ink-muted' : a.left <= 3 ? 'text-red-700' : 'text-leaf-700'}`}>
                  {!a.open ? a.reason : a.left <= 3 ? `Only ${a.left} left` : `${a.left} left`}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {error && <p className="mt-2 text-sm font-medium text-red-700" role="alert">{error}</p>}
    </fieldset>
  );
}
