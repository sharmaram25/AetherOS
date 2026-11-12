import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Search, SlidersHorizontal, ShieldCheck, Camera, Mic, WifiOff, BatteryCharging, BatteryFull, BatteryMedium, BatteryLow,
  Lock, Settings, LayoutGrid, Info, Focus, Ghost, Bell, BellOff, Power, Keyboard, MonitorSmartphone,
} from 'lucide-react';
import { useWindows, wm, WORKSPACES, TOPBAR_H } from '../kernel/windows';
import { getApp } from '../kernel/registry';
import { useSettings } from '../kernel/settings';
import { useSession, session } from '../kernel/session';
import { useSensors, useNetwork } from '../kernel/privacy';
import { useTimers, timers } from '../kernel/scheduler';
import { useNotify } from '../kernel/notify';
import { shell, useShell } from './store';
import { useNow, cx, openMenuAt, type MenuItem } from '../ui';
import { Logo } from './Logo';
import { QuickSettings } from './QuickSettings';

function useBattery() {
  const [b, setB] = useState<{ level: number; charging: boolean } | null>(null);
  useEffect(() => {
    const nav = navigator as Navigator & { getBattery?: () => Promise<any> };
    if (!nav.getBattery) return;
    let bat: any;
    const update = () => setB({ level: bat.level, charging: bat.charging });
    nav.getBattery().then((x) => {
      bat = x;
      update();
      bat.addEventListener('levelchange', update);
      bat.addEventListener('chargingchange', update);
    }).catch(() => {});
    return () => { bat?.removeEventListener('levelchange', update); bat?.removeEventListener('chargingchange', update); };
  }, []);
  return b;
}

function useOnline() {
  const [on, setOn] = useState(navigator.onLine);
  useEffect(() => {
    const a = () => setOn(true), b = () => setOn(false);
    window.addEventListener('online', a);
    window.addEventListener('offline', b);
    return () => { window.removeEventListener('online', a); window.removeEventListener('offline', b); };
  }, []);
  return on;
}

export function TopBar() {
  const now = useNow(1000);
  const { use24h, showSeconds, dnd } = useSettings();
  const { activeId, wins, ws } = useWindows();
  const mode = useSession((s) => s.mode);
  const sensors = useSensors((s) => s.active);
  const external = useNetwork((s) => s.external);
  const focus = useTimers((s) => s.focus);
  useTimers((s) => s.tick);
  const unread = useNotify((s) => s.history.filter((h) => !h.read).length);
  const panel = useShell((s) => s.panel);
  const battery = useBattery();
  const online = useOnline();

  const active = activeId ? wins[activeId] : null;
  const app = active ? getApp(active.appId) : null;
  const hasCam = sensors.some((s) => s.kind === 'camera');
  const hasMic = sensors.some((s) => s.kind === 'microphone');

  const sysMenu: MenuItem[] = [
    { label: 'About AetherOS', icon: Info, onClick: () => useShell.setState({ panel: 'about' }) },
    { separator: true },
    { label: 'Settings…', icon: Settings, shortcut: 'Alt ,', onClick: () => { wm.open('settings'); } },
    { label: 'App Center', icon: LayoutGrid, onClick: () => { wm.open('store'); } },
    { label: 'Keyboard shortcuts', icon: Keyboard, shortcut: 'Alt /', onClick: () => shell.open('shortcuts') },
    { separator: true },
    { label: mode === 'guest' ? 'End guest session…' : 'Lock screen', icon: mode === 'guest' ? Ghost : Lock, shortcut: 'Alt L', onClick: () => session.lock() },
    { label: 'Restart shell', icon: Power, onClick: async () => { await session.teardown(); location.reload(); } },
  ];

  const appMenu: MenuItem[] = app && active ? [
    { header: app.name },
    ...(app.single ? [] : [{ label: 'New window', onClick: () => { wm.open(app.id, undefined, { newWindow: true }); } }]),
    { label: 'Minimize', shortcut: 'Alt M', onClick: () => wm.minimize(active.id) },
    { label: active.state === 'maximized' ? 'Restore' : 'Maximize', shortcut: 'Alt ↑', onClick: () => wm.toggleMaximize(active.id) },
    { label: 'Move to workspace', submenu: Array.from({ length: WORKSPACES }, (_, i) => ({ label: `Workspace ${i + 1}`, checked: active.ws === i, onClick: () => wm.moveToWs(active.id, i) })) },
    { separator: true },
    { label: `Quit ${app.name}`, danger: true, shortcut: 'Alt Q', onClick: () => wm.closeApp(app.id) },
  ] : [];

  const time = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: showSeconds ? '2-digit' : undefined, hour12: !use24h });
  const date = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const focusLeft = focus.phase !== 'idle' ? Math.max(0, focus.paused ? focus.remaining : focus.endsAt - Date.now()) : 0;

  const BatIcon = battery?.charging ? BatteryCharging : !battery ? BatteryFull : battery.level > 0.7 ? BatteryFull : battery.level > 0.3 ? BatteryMedium : BatteryLow;

  return (
    <div className="fixed top-0 left-0 right-0 glass-bar border-b border-line flex items-center px-2 text-[12.5px] z-50 select-none" style={{ height: TOPBAR_H }}>
      <BarBtn onClick={(e) => openMenuAt(e.currentTarget, sysMenu)} className="px-2"><Logo size={16} /></BarBtn>
      {app ? (
        <BarBtn onClick={(e) => openMenuAt(e.currentTarget, appMenu)} className="font-semibold px-2">{app.name}</BarBtn>
      ) : (
        <span className="font-semibold px-2">Desktop</span>
      )}

      <div className="flex items-center gap-1 ml-3">
        {Array.from({ length: WORKSPACES }, (_, i) => {
          const count = Object.values(wins).filter((w) => w.ws === i).length;
          return (
            <button key={i} onClick={() => wm.switchWs(i)} title={`Workspace ${i + 1} (Alt ${i + 1})`}
              className={cx('h-[18px] rounded-full transition-all duration-300 text-[10px] font-semibold flex items-center justify-center',
                i === ws ? 'w-7 bg-accent text-accent-fg' : count ? 'w-[18px] bg-active text-muted hover:bg-line-strong' : 'w-[18px] bg-hover text-faint hover:bg-active')}>
              {i + 1}
            </button>
          );
        })}
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-0.5">
        {focus.phase !== 'idle' && (
          <BarBtn onClick={() => timers.pauseFocus()} className={cx('px-2 gap-1.5 tabular-nums font-medium', focus.phase === 'focus' ? 'text-accent' : 'text-success')}>
            <Focus size={13} /> {focus.phase === 'focus' ? 'Focus' : 'Break'} {Math.floor(focusLeft / 60000)}:{String(Math.floor((focusLeft % 60000) / 1000)).padStart(2, '0')}
          </BarBtn>
        )}
        <AnimatePresence>
          {(hasCam || hasMic) && (
            <motion.button
              initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
              onClick={() => wm.open('shield', { tab: 'activity' })}
              title={`In use by ${[...new Set(sensors.map((s) => getApp(s.appId)?.name ?? s.appId))].join(', ')}`}
              className="h-[22px] px-2 rounded-full flex items-center gap-1.5 bg-black/30 mr-1"
            >
              {hasCam && <><span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_6px_#4ade80] animate-pulse" /><Camera size={12} className="text-green-400" /></>}
              {hasMic && <><span className="w-1.5 h-1.5 rounded-full bg-orange-400 shadow-[0_0_6px_#fb923c] animate-pulse" /><Mic size={12} className="text-orange-400" /></>}
            </motion.button>
          )}
        </AnimatePresence>
        {mode === 'guest' && <span className="h-[20px] px-2 rounded-full bg-warn/20 text-warn text-[11px] font-semibold flex items-center gap-1 mr-1"><Ghost size={11} /> Guest</span>}
        {!online && <BarBtn title="Offline — AetherOS keeps working" className="px-1.5"><WifiOff size={14} /></BarBtn>}
        {battery && (
          <BarBtn title={`${Math.round(battery.level * 100)}%${battery.charging ? ' · charging' : ''}`} className="px-1.5 gap-1">
            <BatIcon size={16} /><span className="text-[11px] text-muted tabular-nums">{Math.round(battery.level * 100)}%</span>
          </BarBtn>
        )}
        <BarBtn onClick={() => wm.open('shield')} title={`Encrypted · ${mode === 'passphrase' ? 'passphrase' : mode === 'guest' ? 'RAM only' : 'device key'} · ${external} external requests`} className="px-1.5 relative">
          {mode === 'device' ? <MonitorSmartphone size={14} className="text-success" /> : <ShieldCheck size={14} className={mode === 'guest' ? 'text-warn' : 'text-success'} />}
          {external > 0 && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-warn" />}
        </BarBtn>
        <BarBtn onClick={() => shell.open('spotlight')} title="Search (Ctrl K)" className="px-1.5"><Search size={14} /></BarBtn>
        <div className="relative">
          <BarBtn onClick={() => shell.open('quick')} className={cx('px-1.5', panel === 'quick' && 'bg-active')} title="Control center"><SlidersHorizontal size={14} /></BarBtn>
          <AnimatePresence>{panel === 'quick' && <QuickSettings />}</AnimatePresence>
        </div>
        <BarBtn onClick={() => { shell.open('center'); useNotify.setState((s) => ({ history: s.history.map((h) => ({ ...h, read: true })) })); }} className={cx('px-2 gap-2 tabular-nums font-medium', panel === 'center' && 'bg-active')}>
          {dnd ? <BellOff size={13} className="text-muted" /> : unread > 0 ? <span className="relative"><Bell size={13} /><span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-accent" /></span> : null}
          <span>{date}</span><span>{time}</span>
        </BarBtn>
      </div>
    </div>
  );
}

function BarBtn({ children, onClick, className, title }: { children: React.ReactNode; onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void; className?: string; title?: string }) {
  return (
    <button onClick={onClick} title={title} className={cx('h-[22px] rounded-md flex items-center hover:bg-hover transition-colors', className)}>
      {children}
    </button>
  );
}
