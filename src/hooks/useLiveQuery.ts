import { useCallback, useEffect, useRef, useState } from 'react';
import type { CollectionName } from '@/db/storage';
import { onChange } from '@/api/sync';

export interface LiveQuery<T> {
  data: T | undefined;
  error: Error | null;
  /** True only while there is no data yet (first load or after an error). */
  loading: boolean;
  reload: () => void;
}

/**
 * Fetches via an api function and refetches whenever one of `collections` changes
 * (in this tab or another). Existing data stays on screen during refetches.
 */
export function useLiveQuery<T>(fetcher: () => Promise<T>, collections: CollectionName[], deps: unknown[] = []): LiveQuery<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchRef = useRef(fetcher);
  fetchRef.current = fetcher;
  const reqId = useRef(0);

  const run = useCallback(() => {
    const id = ++reqId.current;
    fetchRef
      .current()
      .then((d) => {
        if (id !== reqId.current) return;
        setData(d);
        setError(null);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (id !== reqId.current) return;
        setError(e instanceof Error ? e : new Error(String(e)));
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    setLoading(true);
    setData(undefined);
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const key = collections.join(',');
  useEffect(
    () =>
      onChange((changed) => {
        if (changed.some((c) => collections.includes(c))) run();
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, run],
  );

  return { data, error, loading: loading && data === undefined, reload: run };
}
