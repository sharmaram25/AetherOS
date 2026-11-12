/**
 * Privacy kernel: capability permissions, live sensor indicators, an access audit log,
 * clipboard hygiene, and a network transparency monitor.
 */
import { create } from 'zustand';
import { dialog } from './dialog';
import { getAppData, loadAppData, setAppData } from './appdata';
import { settings } from './settings';
import { getApp } from './registry';

export type Perm = 'camera' | 'microphone' | 'notifications' | 'clipboard' | 'files' | 'location' | 'screen' | 'storage';

export const PERM_LABEL: Record<Perm, string> = {
  camera: 'Camera',
  microphone: 'Microphone',
  notifications: 'Notifications',
  clipboard: 'Clipboard',
  files: 'Your files',
  location: 'Location',
  screen: 'Screen recording',
  storage: 'Private storage',
};

export interface AccessEvent { t: number; appId: string; what: string; detail?: string; allowed: boolean }

interface PrivacyData {
  grants: Record<string, Partial<Record<Perm, 'granted' | 'denied'>>>;
  log: AccessEvent[];
}

const KEY = 'privacy';
const EMPTY: PrivacyData = { grants: {}, log: [] };

export async function loadPrivacy() {
  await loadAppData<PrivacyData>(KEY, EMPTY);
}

export function privacyData(): PrivacyData {
  return getAppData<PrivacyData>(KEY, EMPTY);
}

export function logAccess(appId: string, what: string, allowed = true, detail?: string) {
  setAppData<PrivacyData>(KEY, (p) => ({ ...p, log: [{ t: Date.now(), appId, what, allowed, detail }, ...p.log].slice(0, 500) }), EMPTY);
}

export function setGrant(appId: string, perm: Perm, value: 'granted' | 'denied' | null) {
  setAppData<PrivacyData>(KEY, (p) => {
    const app = { ...(p.grants[appId] ?? {}) };
    if (value) app[perm] = value; else delete app[perm];
    return { ...p, grants: { ...p.grants, [appId]: app } };
  }, EMPTY);
}

export function clearAccessLog() {
  setAppData<PrivacyData>(KEY, (p) => ({ ...p, log: [] }), EMPTY);
}

const sessionGrants = new Set<string>();

/** Ask the user (once, or remembered) whether `appId` may use `perm`. */
export async function requestPermission(appId: string, perm: Perm, reason?: string): Promise<boolean> {
  const stored = privacyData().grants[appId]?.[perm];
  if (stored === 'granted' || sessionGrants.has(`${appId}:${perm}`)) {
    logAccess(appId, perm, true);
    return true;
  }
  if (stored === 'denied') {
    logAccess(appId, perm, false, 'Blocked by saved choice');
    return false;
  }
  const appName = getApp(appId)?.name ?? appId;
  const answer = await dialog.permission({ appId, appName, perm: PERM_LABEL[perm], reason });
  if (answer === 'always') setGrant(appId, perm, 'granted');
  if (answer === 'once') sessionGrants.add(`${appId}:${perm}`);
  logAccess(appId, perm, answer !== 'deny');
  return answer !== 'deny';
}

export function resetSessionGrants() {
  sessionGrants.clear();
}

/* ---------- Live sensor indicators ---------- */
interface Sensor { id: string; appId: string; kind: 'camera' | 'microphone' | 'screen' | 'location'; since: number }

export const useSensors = create<{ active: Sensor[] }>(() => ({ active: [] }));

export function trackStream(appId: string, stream: MediaStream): () => void {
  const kinds: Sensor['kind'][] = [];
  if (stream.getVideoTracks().length) kinds.push('camera');
  if (stream.getAudioTracks().length) kinds.push('microphone');
  const ids = kinds.map((k) => `${appId}:${k}:${Math.random().toString(36).slice(2, 7)}`);
  useSensors.setState((s) => ({ active: [...s.active, ...kinds.map((kind, i) => ({ id: ids[i], appId, kind, since: Date.now() }))] }));
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    stream.getTracks().forEach((t) => t.stop());
    useSensors.setState((s) => ({ active: s.active.filter((a) => !ids.includes(a.id)) }));
  };
  stream.getTracks().forEach((t) => t.addEventListener('ended', () => {
    if (stream.getTracks().every((x) => x.readyState === 'ended')) stop();
  }));
  return stop;
}

/* ---------- Clipboard hygiene ---------- */
let clipTimer: ReturnType<typeof setTimeout> | null = null;

/** Copy text; if `sensitive`, auto-clear the clipboard after the configured delay. */
export async function copyText(text: string, opts: { sensitive?: boolean; appId?: string } = {}) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  if (opts.appId) logAccess(opts.appId, 'clipboard', true, opts.sensitive ? 'Copied a secret' : 'Copied text');
  const secs = settings().clipboardClearSeconds;
  if (opts.sensitive && secs > 0) {
    if (clipTimer) clearTimeout(clipTimer);
    clipTimer = setTimeout(async () => {
      try {
        const cur = await navigator.clipboard.readText().catch(() => text);
        if (cur === text) await navigator.clipboard.writeText('');
      } catch { /* focus required; ignore */ }
    }, secs * 1000);
  }
}

/* ---------- Network transparency ---------- */
export interface NetEntry { t: number; url: string; host: string; external: boolean; type: string; size: number }

export const useNetwork = create<{ entries: NetEntry[]; external: number; total: number }>(() => ({ entries: [], external: 0, total: 0 }));

let netStarted = false;
export function startNetworkMonitor() {
  if (netStarted || typeof PerformanceObserver === 'undefined') return;
  netStarted = true;
  const origin = location.origin;
  const add = (list: PerformanceEntryList) => {
    const fresh: NetEntry[] = [];
    for (const e of list as PerformanceResourceTiming[]) {
      if (!e.name || e.name.startsWith('data:') || e.name.startsWith('blob:')) continue;
      let host = '';
      try { host = new URL(e.name).host; } catch { continue; }
      const external = !e.name.startsWith(origin);
      fresh.push({ t: performance.timeOrigin + e.startTime, url: e.name, host, external, type: e.initiatorType, size: e.transferSize || 0 });
    }
    if (!fresh.length) return;
    useNetwork.setState((s) => ({
      entries: [...fresh.reverse(), ...s.entries].slice(0, 400),
      external: s.external + fresh.filter((f) => f.external).length,
      total: s.total + fresh.length,
    }));
  };
  try {
    add(performance.getEntriesByType('resource'));
    new PerformanceObserver((l) => add(l.getEntries())).observe({ type: 'resource', buffered: false });
  } catch { /* unsupported */ }
}
