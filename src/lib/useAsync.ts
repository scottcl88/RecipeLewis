import { useCallback, useEffect, useRef, useState } from 'react';

export interface AsyncState<T> { data: T | null; loading: boolean; error: string; reload: () => void }
interface Settled<T> { key: string; data: T | null; error: string }

/** Run an async loader whenever deps (serialized) change or reload() is called. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [n, setN] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const fnRef = useRef(fn);
  useEffect(() => { fnRef.current = fn; });
  const key = JSON.stringify(deps) + ':' + n;
  useEffect(() => {
    let live = true;
    fnRef.current()
      .then((data) => { if (live) setSettled({ key, data, error: '' }); })
      .catch((e: unknown) => { if (live) setSettled({ key, data: null, error: e instanceof Error ? e.message : 'Unknown error' }); });
    return () => { live = false; };
  }, [key]);
  const current = settled?.key === key ? settled : null;
  return {
    data: current?.data ?? null,
    loading: current === null,
    error: current?.error ?? '',
    reload: useCallback(() => setN((x) => x + 1), []),
  };
}
