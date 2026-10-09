import { useEffect, useState } from 'react';
import { now, onClockChange } from '@/lib/clock';

/** Current (time-travel aware) time, re-rendering every `intervalMs`. */
export function useNow(intervalMs = 1000): number {
  const [t, setT] = useState(now);
  useEffect(() => {
    const tick = () => setT(now());
    const id = setInterval(tick, intervalMs);
    const off = onClockChange(tick);
    return () => {
      clearInterval(id);
      off();
    };
  }, [intervalMs]);
  return t;
}
