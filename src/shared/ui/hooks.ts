import { useCallback, useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import type { Accent, Theme } from '@/core/model/settings';
import { errorMessage, send } from '@/shared/messaging/client';
import type { RequestPayload, RequestType, ResponseMap } from '@/shared/messaging/contract';
import { applyAccent } from './palettes';

export interface RequestState<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/**
 * Loads data from the background and reloads it whenever stored data changes
 * (e.g. a problem was solved in another tab).
 */
export function useRequest<K extends RequestType>(
  type: K,
  payload: RequestPayload<K>,
): RequestState<ResponseMap[K]> {
  const [data, setData] = useState<ResponseMap[K]>();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const key = JSON.stringify(payload);
  const seq = useRef(0);

  const load = useCallback(() => {
    const id = ++seq.current;
    void Promise.resolve().then(async () => {
      setPending((n) => n + 1);
      try {
        const d = await send(type, JSON.parse(key) as RequestPayload<K>);
        if (id !== seq.current) return;
        setData(d);
        setError(null);
      } catch (e) {
        if (id === seq.current) setError(errorMessage(e));
      } finally {
        setPending((n) => n - 1);
      }
    });
  }, [type, key]);

  useEffect(() => {
    load();
    return onStorageChange(load);
  }, [load]);

  return {
    data,
    error,
    loading: pending > 0 || (data === undefined && error === null),
    reload: load,
  };
}

/** Calls `fn` (debounced) whenever extension storage changes. Returns an unsubscribe function. */
export function onStorageChange(fn: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const listener = (_changes: unknown, area: string) => {
    if (area !== 'local') return;
    clearTimeout(timer);
    timer = setTimeout(fn, 100);
  };
  browser.storage.onChanged.addListener(listener);
  return () => {
    clearTimeout(timer);
    browser.storage.onChanged.removeListener(listener);
  };
}

export function resolveTheme(theme: Theme): 'dark' | 'light' {
  if (theme !== 'system') return theme;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

/**
 * Applies the light/dark mode and accent color from settings to the given element
 * (default: <html>). Follows the system setting live when the mode is "system".
 */
export function useTheme(
  theme: Theme | undefined,
  accent: Accent | undefined,
  target?: HTMLElement | null,
) {
  useEffect(() => {
    if (!theme) return;
    const el = target ?? document.documentElement;
    const apply = () => {
      const mode = resolveTheme(theme);
      el.setAttribute('data-theme', mode);
      applyAccent(el, accent ?? 'grape', mode);
    };
    apply();
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme, accent, target]);
}

export function useNow(intervalMs: number, active: boolean): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, intervalMs);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [intervalMs, active]);
  return now;
}
