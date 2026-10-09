import { duration } from '@/lib/format';

/** "Order within 2h 15m". Turns urgent under 1 hour. */
export function CountdownChip({ remainingMs, label = 'Order within' }: { remainingMs: number; label?: string }) {
  const urgent = remainingMs < 3_600_000;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${urgent ? 'bg-red-100 text-red-800' : 'bg-turmeric-100 text-amber-900'}`}
      role="timer"
      aria-live="off"
    >
      <span className={`h-2 w-2 rounded-full ${urgent ? 'animate-pulse bg-red-600' : 'bg-amber-500'}`} aria-hidden="true" />
      {label} {duration(remainingMs)}
    </span>
  );
}
