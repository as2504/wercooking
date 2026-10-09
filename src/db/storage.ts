// Storage adapter. The api/ layer is the only consumer. Swap this (or the api/ modules)
// for HTTP calls when a real backend exists.
import { createStore, get, set, update, clear, type UseStore } from 'idb-keyval';
import type {
  AppNotification, Coupon, KitchenSettings, KitchenUpdate, MenuItem, Order, Payment,
  Review, Subscription, User, WalletTxn, WeeklyMenu,
} from '@/types/models';

export interface Meta {
  schemaVersion: number;
  seededAt: number;
  orderCounter: number;
  invoiceCounter: number;
}

/** Every persisted collection and its type. */
export interface Collections {
  meta: Meta;
  settings: KitchenSettings;
  users: User[];
  menuItems: MenuItem[];
  weeklyMenu: WeeklyMenu;
  coupons: Coupon[];
  orders: Order[];
  payments: Payment[];
  subscriptions: Subscription[];
  walletTxns: WalletTxn[];
  kitchenUpdates: KitchenUpdate[];
  reviews: Review[];
  notifications: AppNotification[];
}

export type CollectionName = keyof Collections;

export interface StorageAdapter {
  get<K extends CollectionName>(key: K): Promise<Collections[K] | undefined>;
  set<K extends CollectionName>(key: K, value: Collections[K]): Promise<void>;
  /** Atomic read-modify-write. */
  update<K extends CollectionName>(key: K, fn: (v: Collections[K] | undefined) => Collections[K]): Promise<Collections[K]>;
  clear(): Promise<void>;
}

function idbAdapter(store: UseStore): StorageAdapter {
  return {
    get: (key) => get(key, store),
    set: (key, value) => set(key, value, store),
    async update(key, fn) {
      let result!: Collections[typeof key];
      await update(key, (v) => (result = fn(v)), store);
      return result;
    },
    clear: () => clear(store),
  };
}

/** Used when IndexedDB is unavailable (some private modes) and in tests. */
export function memoryAdapter(backing?: Storage): StorageAdapter {
  const mem = new Map<string, unknown>();
  const read = (k: string) => {
    if (backing) {
      const raw = backing.getItem(`wac:db:${k}`);
      return raw ? JSON.parse(raw) : undefined;
    }
    return structuredClone(mem.get(k));
  };
  const write = (k: string, v: unknown) => {
    if (backing) backing.setItem(`wac:db:${k}`, JSON.stringify(v));
    else mem.set(k, structuredClone(v));
  };
  return {
    get: async (key) => read(key),
    set: async (key, value) => write(key, value),
    async update(key, fn) {
      const next = fn(read(key));
      write(key, next);
      return next;
    },
    async clear() {
      if (backing) {
        Object.keys(backing).filter((k) => k.startsWith('wac:db:')).forEach((k) => backing.removeItem(k));
      } else mem.clear();
    },
  };
}

function createDefaultAdapter(): StorageAdapter {
  if (typeof indexedDB !== 'undefined') return idbAdapter(createStore('wearecooking', 'kv'));
  if (typeof localStorage !== 'undefined') return memoryAdapter(localStorage);
  return memoryAdapter();
}

export let db: StorageAdapter = createDefaultAdapter();

/** Tests (or a future backend shim) can replace the adapter. */
export function setStorageAdapter(adapter: StorageAdapter) {
  db = adapter;
}
