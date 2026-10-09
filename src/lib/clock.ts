// Single source of "now" for all business logic. Adds the dev-only time-travel offset,
// which is persisted in localStorage so every tab (customer + admin) agrees on the time.
import type { Millis } from '@/types/models';

const KEY = 'wac:timeOffsetMs';
const listeners = new Set<() => void>();

function readOffset(): number {
  try {
    return Number(localStorage.getItem(KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

let offset = typeof localStorage === 'undefined' ? 0 : readOffset();

export function now(): Millis {
  return Date.now() + offset;
}

export function getTimeOffset(): number {
  return offset;
}

export function setTimeOffset(ms: number): void {
  offset = ms;
  try {
    localStorage.setItem(KEY, String(ms));
  } catch {
    /* storage unavailable: offset stays in memory */
  }
  listeners.forEach((l) => l());
}

export function onClockChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      offset = readOffset();
      listeners.forEach((l) => l());
    }
  });
}
