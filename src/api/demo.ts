import { db, type CollectionName, type Collections } from '@/db/storage';
import { buildSeed, SCHEMA_VERSION } from '@/db/seed';
import { now } from '@/lib/clock';
import { emitChange } from './sync';
import { clearSession } from './session';

const ALL: CollectionName[] = [
  'meta', 'settings', 'users', 'menuItems', 'weeklyMenu', 'coupons', 'orders', 'payments',
  'subscriptions', 'walletTxns', 'kitchenUpdates', 'reviews', 'notifications',
];

async function writeAll(data: Collections) {
  for (const key of ALL) await db.set(key, data[key] as never);
}

/** Seeds on first run, or when the stored schema is outdated. */
export async function ensureSeeded(): Promise<boolean> {
  const meta = await db.get('meta');
  if (meta && meta.schemaVersion === SCHEMA_VERSION) return false;
  await db.clear();
  await writeAll(buildSeed(now()));
  return true;
}

/** Wipes everything (including the signed-in customer) and re-seeds. */
export async function resetDemoData(): Promise<void> {
  await db.clear();
  clearSession();
  await writeAll(buildSeed(now()));
  emitChange(...ALL);
}
