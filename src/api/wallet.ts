import type { User, WalletTxn, WalletTxnType } from '@/types/models';
import { now } from '@/lib/clock';
import { uid } from '@/lib/id';
import { ApiError, latency, read, write } from './base';

export async function listWalletTxns(userId: string): Promise<WalletTxn[]> {
  await latency();
  return (await read('walletTxns')).filter((t) => t.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Adds (amount > 0) or removes (amount < 0) wallet money and records a transaction.
 * Rejects debits that exceed the balance.
 */
export async function adjustWallet(userId: string, amount: number, type: WalletTxnType, note: string, ref?: string): Promise<WalletTxn> {
  let txn: WalletTxn | undefined;
  await write('users', (users) =>
    users.map((u: User) => {
      if (u.id !== userId) return u;
      const balance = Math.round((u.walletBalance + amount) * 100) / 100;
      if (balance < 0) throw new ApiError('Insufficient wallet balance.', 'insufficient_balance');
      txn = { id: uid('w'), userId, type, amount, balanceAfter: balance, note, ref, createdAt: now() };
      return { ...u, walletBalance: balance };
    }),
  );
  if (!txn) throw new ApiError('User not found.', 'not_found');
  const t = txn;
  await write('walletTxns', (all) => [t, ...all]);
  return t;
}
