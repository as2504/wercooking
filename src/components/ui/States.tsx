import type { ReactNode } from 'react';
import { Button } from './Button';

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-xl bg-stone-200/70 ${className}`} aria-hidden="true">
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>
  );
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card space-y-3 p-4" role="status" aria-label="Loading">
      <Skeleton className="h-5 w-1/2" />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={`h-4 ${i % 2 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  );
}

export function ListSkeleton({ count = 3, lines = 2 }: { count?: number; lines?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} lines={lines} />
      ))}
    </div>
  );
}

export function EmptyState({ emoji = '🍽️', title, body, action }: { emoji?: string; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 grid h-20 w-20 place-items-center rounded-full bg-brand-50 text-4xl" aria-hidden="true">
        {emoji}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {body && <p className="mt-1 max-w-xs text-sm text-ink-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: Error | null; onRetry?: () => void }) {
  return (
    <div role="alert" className="card flex flex-col items-center p-6 text-center">
      <div className="mb-2 text-3xl" aria-hidden="true">😕</div>
      <h3 className="font-semibold">Something went wrong</h3>
      <p className="mt-1 text-sm text-ink-muted">{error?.message ?? 'Please try again.'}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/** Renders loading / error / content for a LiveQuery. */
export function QueryView<T>({
  q,
  skeleton,
  children,
}: {
  q: { data: T | undefined; error: Error | null; loading: boolean; reload: () => void };
  skeleton?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  if (q.error && q.data === undefined) return <ErrorState error={q.error} onRetry={q.reload} />;
  if (q.loading || q.data === undefined) return <>{skeleton ?? <ListSkeleton />}</>;
  return <>{children(q.data)}</>;
}
