import { create } from 'zustand';
import { randomId } from './crypto';
import { getApp } from './registry';

export const TOPBAR_H = 30;
export const WORKSPACES = 4;

export type SnapZone = 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'max';

export interface Rect { x: number; y: number; w: number; h: number }

export interface Win extends Rect {
  id: string;
  appId: string;
  title: string;
  state: 'normal' | 'minimized' | 'maximized';
  snap: SnapZone | null;
  restore?: Rect;
  z: number;
  ws: number;
  data?: any;
  created: number;
}

interface WinStore {
  wins: Record<string, Win>;
  order: string[];
  activeId: string | null;
  ws: number;
  overview: boolean;
  switcher: { index: number } | null;
}

export const useWindows = create<WinStore>(() => ({
  wins: {},
  order: [],
  activeId: null,
  ws: 0,
  overview: false,
  switcher: null,
}));

const S = () => useWindows.getState();
let nonce = 0;
const closeGuards = new Map<string, () => boolean | Promise<boolean>>();

/** Let an app intercept closing (e.g. to ask about unsaved changes). Return false to cancel. */
export function setCloseGuard(id: string, fn: (() => boolean | Promise<boolean>) | null) {
  if (fn) closeGuards.set(id, fn); else closeGuards.delete(id);
}
let cascade = 0;

export function workArea(): Rect {
  return { x: 0, y: TOPBAR_H, w: window.innerWidth, h: window.innerHeight - TOPBAR_H };
}

export function zoneRect(zone: SnapZone): Rect {
  const a = workArea();
  const g = 6;
  const hw = Math.round(a.w / 2), hh = Math.round(a.h / 2);
  switch (zone) {
    case 'left': return { x: a.x + g, y: a.y + g, w: hw - g * 1.5, h: a.h - g * 2 };
    case 'right': return { x: a.x + hw + g / 2, y: a.y + g, w: hw - g * 1.5, h: a.h - g * 2 };
    case 'top-left': return { x: a.x + g, y: a.y + g, w: hw - g * 1.5, h: hh - g * 1.5 };
    case 'top-right': return { x: a.x + hw + g / 2, y: a.y + g, w: hw - g * 1.5, h: hh - g * 1.5 };
    case 'bottom-left': return { x: a.x + g, y: a.y + hh + g / 2, w: hw - g * 1.5, h: hh - g * 1.5 };
    case 'bottom-right': return { x: a.x + hw + g / 2, y: a.y + hh + g / 2, w: hw - g * 1.5, h: hh - g * 1.5 };
    case 'max': return a;
  }
}

function patch(id: string, p: Partial<Win>) {
  const w = S().wins[id];
  if (!w) return;
  useWindows.setState((s) => ({ wins: { ...s.wins, [id]: { ...w, ...p } } }));
}

function topVisible(exclude?: string): string | null {
  const { order, wins, ws } = S();
  for (let i = order.length - 1; i >= 0; i--) {
    const w = wins[order[i]];
    if (w && w.id !== exclude && w.ws === ws && w.state !== 'minimized') return w.id;
  }
  return null;
}

export const wm = {
  open(appId: string, data?: any, opts: { newWindow?: boolean } = {}): string | null {
    const app = getApp(appId);
    if (!app) return null;
    const { wins, ws } = S();
    if (app.single && !opts.newWindow) {
      const existing = Object.values(wins).find((w) => w.appId === appId);
      if (existing) {
        if (data !== undefined) patch(existing.id, { data: { ...data, _n: ++nonce } });
        if (existing.ws !== ws) wm.switchWs(existing.ws);
        wm.focus(existing.id);
        return existing.id;
      }
    }
    const area = workArea();
    const w = Math.min(app.width, area.w - 40);
    const h = Math.min(app.height, area.h - 80);
    const offset = (cascade++ % 6) * 28;
    const x = Math.max(8, Math.round(area.x + (area.w - w) / 2 - 80 + offset));
    const y = Math.max(area.y + 8, Math.round(area.y + (area.h - h) / 2 - 50 + offset));
    const id = `${appId}-${randomId(6)}`;
    const win: Win = {
      id, appId, title: app.name, x, y, w, h,
      state: 'normal', snap: null, z: 0, ws, created: Date.now(),
      data: data !== undefined ? { ...data, _n: ++nonce } : undefined,
    };
    useWindows.setState((s) => ({ wins: { ...s.wins, [id]: win }, order: [...s.order, id], activeId: id, overview: false }));
    return id;
  },

  /** Restore a window from a saved session without side effects. */
  hydrate(saved: Win[]) {
    const wins: Record<string, Win> = {};
    for (const w of saved) if (getApp(w.appId)) wins[w.id] = w;
    const order = saved.map((w) => w.id).filter((id) => wins[id]);
    useWindows.setState({ wins, order, activeId: order[order.length - 1] ?? null });
  },

  close(id: string, force = false) {
    const guard = closeGuards.get(id);
    if (guard && !force) {
      void Promise.resolve(guard()).then((ok) => { if (ok) wm.close(id, true); });
      return;
    }
    closeGuards.delete(id);
    useWindows.setState((s) => {
      const { [id]: _gone, ...rest } = s.wins;
      return { wins: rest, order: s.order.filter((o) => o !== id) };
    });
    useWindows.setState({ activeId: topVisible() });
  },

  closeAll() {
    closeGuards.clear();
    useWindows.setState({ wins: {}, order: [], activeId: null, overview: false, switcher: null });
  },

  closeApp(appId: string) {
    Object.values(S().wins).filter((w) => w.appId === appId).forEach((w) => wm.close(w.id));
  },

  /** Close without consulting close guards (used by apps after they've handled the prompt). */
  forceClose(id: string) {
    wm.close(id, true);
  },

  focus(id: string) {
    const w = S().wins[id];
    if (!w) return;
    if (w.state === 'minimized') patch(id, { state: w.restore && w.snap === 'max' ? 'maximized' : 'normal' });
    if (w.ws !== S().ws) useWindows.setState({ ws: w.ws });
    useWindows.setState((s) => ({ order: [...s.order.filter((o) => o !== id), id], activeId: id }));
  },

  minimize(id: string) {
    patch(id, { state: 'minimized' });
    useWindows.setState({ activeId: topVisible(id) });
  },

  toggleMaximize(id: string) {
    const w = S().wins[id];
    if (!w) return;
    if (w.state === 'maximized' || w.snap) wm.unsnap(id);
    else wm.snap(id, 'max');
  },

  snap(id: string, zone: SnapZone) {
    const w = S().wins[id];
    if (!w) return;
    const restore = w.snap || w.state === 'maximized' ? w.restore : { x: w.x, y: w.y, w: w.w, h: w.h };
    if (zone === 'max') patch(id, { state: 'maximized', snap: 'max', restore });
    else patch(id, { ...zoneRect(zone), state: 'normal', snap: zone, restore });
    wm.focus(id);
  },

  unsnap(id: string, at?: { x: number; y: number }) {
    const w = S().wins[id];
    if (!w) return;
    const r = w.restore ?? { x: w.x, y: w.y, w: Math.min(w.w, 900), h: Math.min(w.h, 640) };
    patch(id, { ...r, ...(at ?? {}), state: 'normal', snap: null, restore: undefined });
  },

  setBounds(id: string, b: Partial<Rect>) {
    patch(id, b);
  },

  setTitle(id: string, title: string) {
    if (S().wins[id]?.title !== title) patch(id, { title });
  },

  setData(id: string, data: any) {
    patch(id, { data });
  },

  moveToWs(id: string, ws: number) {
    patch(id, { ws });
    if (S().activeId === id) useWindows.setState({ activeId: topVisible(id) });
  },

  switchWs(ws: number) {
    if (ws < 0 || ws >= WORKSPACES) return;
    useWindows.setState({ ws });
    useWindows.setState({ activeId: topVisible() });
  },

  toggleOverview(on?: boolean) {
    useWindows.setState((s) => ({ overview: on ?? !s.overview, switcher: null }));
  },

  showDesktop() {
    const { wins, ws } = S();
    const visible = Object.values(wins).filter((w) => w.ws === ws && w.state !== 'minimized');
    if (visible.length) visible.forEach((w) => patch(w.id, { state: 'minimized' }));
    useWindows.setState({ activeId: null });
  },

  /** Alt+Tab ordering: most recently focused first, across workspaces. */
  mru(): Win[] {
    const { order, wins } = S();
    return [...order].reverse().map((id) => wins[id]).filter(Boolean);
  },

  appWindows(appId: string) {
    return Object.values(S().wins).filter((w) => w.appId === appId);
  },
};
