import type { KitchenUpdate } from '@/types/models';
import { relativeDay, time12 } from '@/lib/format';
import { Badge } from './ui/Misc';
import { Icon } from './ui/Icon';

export function KitchenUpdateCard({
  update,
  nowMs,
  userId,
  onHeart,
  compact = false,
}: {
  update: KitchenUpdate;
  nowMs: number;
  userId?: string;
  onHeart?: () => void;
  compact?: boolean;
}) {
  const hearted = !!userId && update.heartedBy.includes(userId);
  return (
    <article className="card overflow-hidden">
      <div className="relative">
        <img src={update.photo} alt={`Kitchen photo for ${relativeDay(update.date, nowMs)}`} className={`w-full object-cover ${compact ? 'h-36' : 'aspect-[4/3]'}`} loading="lazy" />
        <Badge tone="green" className="absolute left-3 top-3 shadow">🌿 {update.freshness}</Badge>
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-ink-muted">
            {relativeDay(update.date, nowMs)} · {time12(update.createdAt)} · by {update.author}
          </p>
          {onHeart && (
            <button
              type="button"
              onClick={onHeart}
              aria-pressed={hearted}
              aria-label={hearted ? 'Remove heart' : 'Send a heart'}
              className={`-my-2 -mr-2 flex min-h-[44px] items-center gap-1 rounded-full px-3 text-sm font-semibold ${hearted ? 'text-red-600' : 'text-ink-muted hover:text-red-600'}`}
            >
              <Icon name="heart" filled={hearted} className="h-5 w-5" />
              {update.heartedBy.length}
            </button>
          )}
        </div>
        <p className={`text-[15px] leading-relaxed ${compact ? 'line-clamp-2' : ''}`}>{update.note}</p>
        {!compact && (
          <dl className="grid grid-cols-1 gap-2 text-sm">
            <div className="flex gap-2 rounded-xl bg-cream px-3 py-2">
              <dt className="font-semibold text-ink-soft">🫗 Oil:</dt>
              <dd>{update.oilUsed}</dd>
            </div>
            <div className="rounded-xl bg-cream px-3 py-2">
              <dt className="mb-1 font-semibold text-ink-soft">🥬 Vegetables used</dt>
              <dd className="flex flex-wrap gap-1.5">
                {update.vegetables.map((v) => (
                  <span key={v} className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium ring-1 ring-line">
                    {v}
                  </span>
                ))}
              </dd>
            </div>
          </dl>
        )}
      </div>
    </article>
  );
}
