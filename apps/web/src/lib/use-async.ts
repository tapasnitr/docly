'use client';

import { useEffect, useState, type DependencyList } from 'react';

export type AsyncStatus = 'idle' | 'loading' | 'ready' | 'error';

// Shared loading/ready/error data-fetching pattern, used by every dashboard
// section so each one can independently show its own loading/empty/error
// state instead of gating the whole page on one big fetch.
export function useAsync<T>(fetcher: () => Promise<T>, deps: DependencyList, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<AsyncStatus>(enabled ? 'loading' : 'idle');

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      return;
    }

    let cancelled = false;
    setStatus('loading');

    fetcher()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus('error');
        }
      });

    return () => {
      cancelled = true;
    };
    // `fetcher` is expected to be re-created by the caller alongside `deps` -
    // depending on `deps` alone (like useCallback) is the intended usage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, status };
}
