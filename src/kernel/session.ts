/**
 * Session lifecycle: boot → setup | locked → desktop → locked …
 * Locking unmounts every app, drops decrypted caches and forgets the data key.
 */
import { create } from 'zustand';
import {
  readHeader, createVault, unlockVault, encryptedBackend, memoryBackend, type VaultHeader, type VaultMode,
  getLockout, registerFailure, clearFailures,
} from './vault';
import { vfs } from './vfs';
import { seedFileSystem } from './seed';
import { useWindows, wm, type Win } from './windows';
import { flushAppData, loadAppData, resetAppDataCache, setAppData } from './appdata';
import { loadPrivacy, resetSessionGrants, useSensors } from './privacy';
import { useSettings } from './settings';
import { dialog } from './dialog';
import { readLegacyV1, deleteLegacyV1 } from './db';
import { loadInstalledApps } from '../sdk/apps';
import { startScheduler, stopScheduler } from './scheduler';
import { sound } from '../lib/sound';
import { useNotify } from './notify';

export type Phase = 'boot' | 'setup' | 'locked' | 'desktop';
export type SessionMode = VaultMode | 'guest';

interface SessionStore {
  phase: Phase;
  mode: SessionMode | null;
  header: VaultHeader | null;
  unlockedAt: number;
  busy: boolean;
}

export const useSession = create<SessionStore>(() => ({ phase: 'boot', mode: null, header: null, unlockedAt: 0, busy: false }));

const lockHooks = new Set<() => void | Promise<void>>();
/** Apps register a hook to flush unsaved work before the session locks. */
export function onBeforeLock(fn: () => void | Promise<void>) {
  lockHooks.add(fn);
  return () => { lockHooks.delete(fn); };
}

let unsubSession: (() => void) | null = null;

interface SavedSession { wins: Win[]; ws: number }

function watchSessionLayout() {
  unsubSession?.();
  let t: ReturnType<typeof setTimeout> | null = null;
  unsubSession = useWindows.subscribe((s, prev) => {
    if (s.wins === prev.wins && s.order === prev.order && s.ws === prev.ws) return;
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      const wins = s.order.map((id) => s.wins[id]).filter(Boolean).map((w) => ({ ...w, data: safeData(w.data) }));
      setAppData<SavedSession>('session', { wins, ws: s.ws });
    }, 500);
  });
}

function safeData(d: unknown) {
  try {
    const s = JSON.stringify(d ?? null);
    return s.length < 20_000 ? JSON.parse(s) : undefined;
  } catch {
    return undefined;
  }
}

async function enterDesktop(mode: SessionMode) {
  await Promise.all([loadPrivacy(), loadInstalledApps()]);
  const saved = await loadAppData<SavedSession | null>('session', null);
  if (useSettings.getState().restoreSession && saved?.wins?.length) {
    wm.hydrate(saved.wins);
    wm.switchWs(saved.ws ?? 0);
  }
  watchSessionLayout();
  startScheduler();
  useSession.setState({ phase: 'desktop', mode, unlockedAt: Date.now(), busy: false });
}

export const session = {
  async boot() {
    const header = await readHeader();
    if (!header) {
      useSession.setState({ phase: 'setup', header: null });
      return;
    }
    useSession.setState({ header, mode: header.mode });
    if (header.mode === 'device') {
      try {
        await session.unlock();
        return;
      } catch (e) {
        console.error(e);
      }
    }
    useSession.setState({ phase: 'locked' });
  },

  async setup(opts: { passphrase: string | null; hint?: string; guest?: boolean; importLegacy?: boolean }) {
    useSession.setState({ busy: true });
    const legacy = opts.importLegacy ? await readLegacyV1() : [];
    const userName = useSettings.getState().userName;
    if (opts.guest) {
      await vfs.mount(memoryBackend(), () => seedFileSystem(vfs, { userName }));
      await enterDesktop('guest');
      return;
    }
    const dek = await createVault(opts.passphrase, opts.hint);
    const header = await readHeader();
    await vfs.mount(encryptedBackend(dek), () => seedFileSystem(vfs, { userName, legacy }));
    if (legacy.length) await deleteLegacyV1();
    useSession.setState({ header });
    clearFailures();
    await enterDesktop(header!.mode);
  },

  /** Throws with a user-facing message on failure. */
  async unlock(passphrase?: string) {
    const lock = getLockout();
    if (lock.until > Date.now()) throw new Error(`Too many attempts. Try again in ${Math.ceil((lock.until - Date.now()) / 1000)}s.`);
    useSession.setState({ busy: true });
    try {
      const dek = await unlockVault(passphrase);
      clearFailures();
      await vfs.mount(encryptedBackend(dek));
      const header = await readHeader();
      useSession.setState({ header });
      await enterDesktop(header!.mode);
      if (useSettings.getState().sounds) sound('unlock');
    } catch (e) {
      useSession.setState({ busy: false });
      const l = registerFailure();
      const msg = (e as Error).message || 'Unable to unlock';
      if (l.until > Date.now()) throw new Error(`${msg}. Locked for ${Math.ceil((l.until - Date.now()) / 1000)}s.`);
      throw new Error(msg);
    }
  },

  async lock() {
    const s = useSession.getState();
    if (s.phase !== 'desktop') return;
    if (s.mode === 'guest') {
      const ok = await dialog.confirm({
        title: 'End guest session?',
        message: 'Guest sessions are never saved. Locking will permanently erase everything from this session.',
        confirmLabel: 'Erase & exit', danger: true,
      });
      if (!ok) return;
      await session.teardown();
      useSession.setState({ phase: 'setup', mode: null });
      return;
    }
    await Promise.allSettled([...lockHooks].map((fn) => fn()));
    await session.teardown();
    if (useSettings.getState().sounds) sound('lock');
    useSession.setState({ phase: 'locked' });
  },

  async teardown() {
    dialog.dismissAll();
    useSensors.getState().active.forEach(() => void 0);
    unsubSession?.();
    unsubSession = null;
    stopScheduler();
    // Persist layout before the windows go away.
    const ws = useWindows.getState();
    if (useSession.getState().mode !== 'guest') {
      setAppData<SavedSession>('session', { wins: ws.order.map((id) => ws.wins[id]).filter(Boolean).map((w) => ({ ...w, data: safeData(w.data) })), ws: ws.ws });
    }
    await flushAppData();
    wm.closeAll();
    await vfs.unmount();
    resetAppDataCache();
    resetSessionGrants();
    useNotify.setState({ history: [], toasts: [], centerOpen: false });
  },
};

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => { void flushAppData(); void vfs.flush(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { void flushAppData(); void vfs.flush(); }
  });
}
