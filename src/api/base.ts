import { db, type CollectionName, type Collections } from '@/db/storage';
import { emitChange } from './sync';

export class ApiError extends Error {
  constructor(message: string, public code = 'error') {
    super(message);
  }
}

const isTest = import.meta.env?.MODE === 'test';

/** Simulated network latency so loading states are visible in the prototype. */
export function latency(min = 120, max = 380): Promise<void> {
  if (isTest) return Promise.resolve();
  return new Promise((r) => setTimeout(r, min + Math.random() * (max - min)));
}

export async function read<K extends CollectionName>(key: K): Promise<Collections[K]> {
  const v = await db.get(key);
  if (v === undefined) throw new ApiError(`Data not initialised (${key}). Try "Reset demo data" in Settings.`, 'not_seeded');
  return v;
}

/** Atomic update + change broadcast. */
export async function write<K extends CollectionName>(key: K, fn: (v: Collections[K]) => Collections[K]): Promise<Collections[K]> {
  const next = await db.update(key, (v) => {
    if (v === undefined) throw new ApiError(`Data not initialised (${key}).`, 'not_seeded');
    return fn(v);
  });
  emitChange(key);
  return next;
}

/** Replace one element of an array collection by id. */
export async function patchById<K extends CollectionName, T extends { id: string }>(
  key: K,
  id: string,
  fn: (item: T) => T,
): Promise<T> {
  let result: T | undefined;
  await write(key, (arr) =>
    (arr as unknown as T[]).map((x) => {
      if (x.id !== id) return x;
      result = fn(x);
      return result;
    }) as unknown as Collections[K],
  );
  if (!result) throw new ApiError('Record not found.', 'not_found');
  return result;
}

export async function nextCounter(field: 'orderCounter' | 'invoiceCounter'): Promise<number> {
  let n = 0;
  await write('meta', (m) => {
    n = m[field];
    return { ...m, [field]: n + 1 };
  });
  return n;
}
