// Change notifications. Every api write calls emitChange(); listeners in this tab and in
// other tabs (via BroadcastChannel, with a localStorage-event fallback) refetch their data.
// A real backend would replace this with WebSockets / server-sent events.
import type { CollectionName } from '@/db/storage';

type Listener = (changed: CollectionName[]) => void;

const listeners = new Set<Listener>();
const CHANNEL = 'wac-sync';
const LS_KEY = 'wac:sync';

const channel: BroadcastChannel | null =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL) : null;

function notify(changed: CollectionName[]) {
  listeners.forEach((l) => l(changed));
}

export function emitChange(...changed: CollectionName[]) {
  notify(changed);
  if (channel) channel.postMessage(changed);
  else {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ changed, t: Date.now() }));
    } catch {
      /* ignore */
    }
  }
}

export function onChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

if (channel) {
  channel.onmessage = (e: MessageEvent<CollectionName[]>) => notify(e.data);
} else if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === LS_KEY && e.newValue) notify(JSON.parse(e.newValue).changed);
  });
}
