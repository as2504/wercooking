import { useEffect } from 'react';
import { runJobs } from '@/api/engine';
import { onClockChange } from '@/lib/clock';

/** Runs the simulated "server jobs" every 30 s and whenever time travel changes the clock. */
export function JobRunner() {
  useEffect(() => {
    void runJobs();
    const id = setInterval(() => void runJobs(), 30_000);
    const off = onClockChange(() => void runJobs());
    return () => {
      clearInterval(id);
      off();
    };
  }, []);
  return null;
}
