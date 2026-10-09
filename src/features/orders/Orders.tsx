import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useUser } from '@/store/session';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { useNow } from '@/hooks/useNow';
import { useReorder } from '@/hooks/useReorder';
import { listMyOrders } from '@/api/orders';
import { isActiveOrder } from '@/lib/orders';
import { OrderCard } from '@/components/OrderBits';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { PageHeader, SectionTitle, Segmented } from '@/components/ui/Misc';
import { EmptyState, ListSkeleton, QueryView } from '@/components/ui/States';

const PlansTab = lazy(() => import('@/features/subscriptions/PlansTab'));

export default function Orders() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'plans' ? 'plans' : 'orders';
  return (
    <div>
      <PageHeader title="Orders & plans" />
      <div className="px-4 pt-3">
        <Segmented
          label="Orders or plans"
          value={tab}
          onChange={(v) => setParams(v === 'plans' ? { tab: 'plans' } : {}, { replace: true })}
          options={[
            { value: 'orders', label: 'Orders' },
            { value: 'plans', label: 'My plans' },
          ]}
        />
        {tab === 'orders' ? (
          <OrdersTab />
        ) : (
          <Suspense fallback={<div className="mt-4"><ListSkeleton /></div>}>
            <PlansTab />
          </Suspense>
        )}
      </div>
    </div>
  );
}

function OrdersTab() {
  const user = useUser();
  const now = useNow(30_000);
  const reorder = useReorder();
  const q = useLiveQuery(() => listMyOrders(user.id), ['orders'], [user.id]);
  return (
    <div className="mt-2">
      <QueryView q={q} skeleton={<div className="mt-4"><ListSkeleton count={4} /></div>}>
        {(orders) => {
          const visible = orders.filter((o) => !(o.paymentState === 'unpaid' && o.status === 'cancelled'));
          if (visible.length === 0)
            return <EmptyState emoji="🧾" title="No orders yet" body="Your orders and their cooked-at proof labels will show up here." action={<ButtonLink to="/menu">Order now</ButtonLink>} />;
          const active = visible.filter(isActiveOrder);
          const past = visible.filter((o) => !isActiveOrder(o));
          return (
            <>
              {active.length > 0 && (
                <>
                  <SectionTitle>Active</SectionTitle>
                  <div className="space-y-3">
                    {active.map((o) => (
                      <OrderCard key={o.id} order={o} nowMs={now} />
                    ))}
                  </div>
                </>
              )}
              {past.length > 0 && (
                <>
                  <SectionTitle>Past orders</SectionTitle>
                  <div className="space-y-3">
                    {past.map((o) => (
                      <OrderCard
                        key={o.id}
                        order={o}
                        nowMs={now}
                        action={
                          o.source === 'single' ? (
                            <Button size="sm" variant="secondary" onClick={() => reorder(o)}>
                              <Icon name="refresh" className="h-4 w-4" /> Reorder
                            </Button>
                          ) : undefined
                        }
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          );
        }}
      </QueryView>
    </div>
  );
}
