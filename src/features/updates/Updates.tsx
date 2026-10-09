import { useUser } from '@/store/session';
import { toast } from '@/store/toast';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { useNow } from '@/hooks/useNow';
import { listUpdates, toggleHeart } from '@/api/kitchenUpdates';
import { listReviews } from '@/api/reviews';
import { KitchenUpdateCard } from '@/components/KitchenUpdateCard';
import { PageHeader } from '@/components/ui/Misc';
import { EmptyState, ListSkeleton, QueryView } from '@/components/ui/States';
import { Link } from 'react-router-dom';

export default function Updates() {
  const user = useUser();
  const now = useNow(60_000);
  const q = useLiveQuery(listUpdates, ['kitchenUpdates']);
  const reviews = useLiveQuery(listReviews, ['reviews']);
  const week = (reviews.data ?? []).filter((r) => now - r.createdAt < 7 * 86_400_000);
  const avg = week.length ? week.reduce((s, r) => s + r.stars, 0) / week.length : 0;

  const heart = async (id: string) => {
    try {
      await toggleHeart(id, user.id);
    } catch (e) {
      toast.error('Could not react', (e as Error).message);
    }
  };

  return (
    <div>
      <PageHeader title="Kitchen updates" subtitle="Proof, not promise. Every single day." />
      <div className="space-y-4 px-4 pt-3">
        <div className="flex gap-2">
          <div className="flex-1 rounded-2xl bg-leaf-50 p-3 ring-1 ring-leaf-500/30">
            <p className="text-2xl font-bold text-leaf-700">{week.length ? `${avg.toFixed(1)}★` : '–'}</p>
            <p className="text-xs text-ink-soft">avg rating · {week.length} reviews this week</p>
          </div>
          <Link to="/hygiene" className="flex-1 rounded-2xl bg-white p-3 ring-1 ring-line">
            <p className="text-2xl" aria-hidden="true">🧼</p>
            <p className="text-xs font-semibold text-ink-soft">How we keep it clean →</p>
          </Link>
        </div>
        <QueryView q={q} skeleton={<ListSkeleton count={2} lines={4} />}>
          {(updates) =>
            updates.length === 0 ? (
              <EmptyState emoji="📸" title="No updates yet" body="Tai posts a photo, the oil used and today's vegetables every morning." />
            ) : (
              <div className="space-y-4">
                {updates.map((u) => (
                  <KitchenUpdateCard key={u.id} update={u} nowMs={now} userId={user.id} onHeart={() => heart(u.id)} />
                ))}
              </div>
            )
          }
        </QueryView>
      </div>
    </div>
  );
}
