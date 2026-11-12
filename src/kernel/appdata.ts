/**
 * Per-app structured storage. Every app's state is a JSON file under /System/AppData,
 * which means it is encrypted, included in backups, and wiped with the vault.
 */
import { create } from 'zustand';
import { useCallback, useEffect } from 'react';
import { vfs, useVfs } from './vfs';
import { APPDATA } from '../lib/path';

interface AppDataStore {
  data: Record<string, unknown>;
  loaded: Record<string, boolean>;
}

const useStore = create<AppDataStore>(() => ({ data: {}, loaded: {} }));
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const loading = new Map<string, Promise<unknown>>();

const pathFor = (key: string) => `${APPDATA}/${key}.json`;

export async function loadAppData<T>(key: string, fallback: T): Promise<T> {
  const s = useStore.getState();
  if (s.loaded[key]) return s.data[key] as T;
  if (!loading.has(key)) {
    loading.set(key, (async () => {
      const v = await vfs.readJSON<T>(pathFor(key), fallback);
      useStore.setState((st) => ({
        data: { ...st.data, [key]: st.loaded[key] ? st.data[key] : v },
        loaded: { ...st.loaded, [key]: true },
      }));
      loading.delete(key);
      return v;
    })());
  }
  await loading.get(key);
  return useStore.getState().data[key] as T;
}

export function getAppData<T>(key: string, fallback: T): T {
  const s = useStore.getState();
  return (s.loaded[key] ? s.data[key] : fallback) as T;
}

export function setAppData<T>(key: string, value: T | ((prev: T) => T), fallback?: T) {
  useStore.setState((st) => {
    const prev = (st.loaded[key] ? st.data[key] : fallback) as T;
    const next = typeof value === 'function' ? (value as (p: T) => T)(prev) : value;
    return { data: { ...st.data, [key]: next }, loaded: { ...st.loaded, [key]: true } };
  });
  const t = timers.get(key);
  if (t) clearTimeout(t);
  timers.set(key, setTimeout(() => {
    timers.delete(key);
    if (!useVfs.getState().backend) return;
    void vfs.writeJSON(pathFor(key), useStore.getState().data[key]).catch((e) => console.error('[appdata]', key, e));
  }, 300));
}

export async function flushAppData() {
  const keys = [...timers.keys()];
  for (const key of keys) {
    clearTimeout(timers.get(key)!);
    timers.delete(key);
    if (useVfs.getState().backend) await vfs.writeJSON(pathFor(key), useStore.getState().data[key]);
  }
}

export function resetAppDataCache() {
  timers.forEach((t) => clearTimeout(t));
  timers.clear();
  loading.clear();
  useStore.setState({ data: {}, loaded: {} });
}

/** React hook: `[value, setValue, loaded]` backed by encrypted storage. */
export function useAppData<T>(key: string, fallback: T): [T, (v: T | ((p: T) => T)) => void, boolean] {
  const loaded = useStore((s) => !!s.loaded[key]);
  const value = useStore((s) => (s.loaded[key] ? (s.data[key] as T) : fallback));
  const ready = useVfs((s) => s.ready);
  useEffect(() => {
    if (ready && !loaded) void loadAppData(key, fallback);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready, loaded]);
  const set = useCallback((v: T | ((p: T) => T)) => setAppData<T>(key, v, fallback),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key]);
  return [value, set, loaded];
}
