const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

export function uid(prefix = ''): string {
  const rnd = Array.from(randomBytes(10), (b) => ALPHA[b % ALPHA.length]).join('');
  return prefix ? `${prefix}_${rnd}` : rnd;
}

export function digits(n: number): string {
  return Array.from(randomBytes(n), (b) => String(b % 10)).join('');
}

/** Simulated gateway transaction id, e.g. "SIMTXN8K2P9Q4M7Z". */
export function txnId(): string {
  return `SIMTXN${uid().slice(0, 10)}`;
}
