import { Link } from 'react-router-dom';
import type { Order, OrderStatus } from '@/types/models';
import { MEAL_EMOJI, MEAL_LABEL, STATUS_LABEL, relativeDay, rupees } from '@/lib/format';
import { itemsSummary } from '@/lib/orders';
import { Badge } from './ui/Misc';
import { Icon } from './ui/Icon';
import { ProofLabel } from './ProofLabel';

const TONE: Record<OrderStatus, 'neutral' | 'brand' | 'green' | 'amber' | 'red' | 'blue'> = {
  placed: 'blue',
  accepted: 'blue',
  cooking: 'amber',
  packed: 'amber',
  ready: 'green',
  picked_up: 'neutral',
  cancelled: 'red',
};

export function StatusBadge({ order }: { order: Pick<Order, 'status' | 'paymentState'> }) {
  if (order.paymentState === 'unpaid' && order.status === 'placed') return <Badge tone="amber">Awaiting payment</Badge>;
  return <Badge tone={TONE[order.status]}>{STATUS_LABEL[order.status]}</Badge>;
}

export function OrderCard({ order, nowMs, action }: { order: Order; nowMs: number; action?: React.ReactNode }) {
  return (
    <div className="card p-4">
      <Link to={`/orders/${order.id}`} className="block">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-ink-muted">
              {MEAL_EMOJI[order.mealType]} {MEAL_LABEL[order.mealType]} · {relativeDay(order.pickupDate, nowMs)} · {order.slot.label}
            </p>
            <p className="mt-1 line-clamp-2 font-semibold">{itemsSummary(order.items)}</p>
          </div>
          <Icon name="chevron" className="mt-1 h-5 w-5 shrink-0 text-ink-muted" />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusBadge order={order} />
          {order.source === 'subscription' ? <Badge tone="brand">Plan meal</Badge> : <span className="text-sm font-semibold">{rupees(order.total)}</span>}
          <span className="text-xs text-ink-muted">#{order.number}</span>
        </div>
        {order.cookedAt && order.status !== 'cancelled' && (
          <div className="mt-2">
            <ProofLabel order={order} compact />
          </div>
        )}
      </Link>
      {action && <div className="mt-3 border-t border-line pt-3">{action}</div>}
    </div>
  );
}
