import type { Order } from '@/types/models';
import { time12 } from '@/lib/format';

/** "Proof, not promise": shows when the meal was cooked and packed, and by whom. */
export function ProofLabel({ order, compact = false }: { order: Pick<Order, 'cookedAt' | 'packedAt' | 'cookedBy'>; compact?: boolean }) {
  if (!order.cookedAt) {
    if (compact) return null;
    return (
      <div className="rounded-xl border border-dashed border-line bg-white px-4 py-3 text-sm text-ink-muted">
        🧾 Your proof label appears here once cooking starts.
      </div>
    );
  }
  const text = `Cooked at ${time12(order.cookedAt)}${order.packedAt ? `, packed at ${time12(order.packedAt)}` : ''}, by ${order.cookedBy ?? 'Tai'}`;
  if (compact)
    return (
      <p className="inline-flex items-center gap-1 rounded-md bg-leaf-50 px-2 py-0.5 text-xs font-semibold text-leaf-700">
        <span aria-hidden="true">✓</span> {text}
      </p>
    );
  return (
    <div className="flex items-start gap-3 rounded-xl border-2 border-leaf-500/40 bg-leaf-50 px-4 py-3">
      <span className="mt-0.5 text-xl" aria-hidden="true">🧾</span>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-leaf-700">Proof, not promise</p>
        <p className="font-semibold text-ink">{text}</p>
      </div>
    </div>
  );
}
