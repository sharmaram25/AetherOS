import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Moon, Sun, BellOff, Sparkles, EyeOff, Volume2, Lock, Settings, Focus, SunDim, Droplets, ShieldCheck } from 'lucide-react';
import { useSettings } from '../kernel/settings';
import { session } from '../kernel/session';
import { wm } from '../kernel/windows';
import { timers, useTimers } from '../kernel/scheduler';
import { shell, useShell } from './store';
import { Slider, cx } from '../ui';
import { useIsDark } from './theme';

export function QuickSettings() {
  const s = useSettings();
  const dark = useIsDark();
  const night = useShell((x) => x.nightLight);
  const focus = useTimers((x) => x.focus);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && !(e.target as HTMLElement).closest('[title="Control center"]')) shell.close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && shell.close();
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('pointerdown', onDown); window.removeEventListener('keydown', onKey); };
  }, []);

  const tiles = [
    { icon: dark ? Moon : Sun, label: dark ? 'Dark' : 'Light', on: dark, click: () => s.set({ theme: dark ? 'light' : 'dark' }) },
    { icon: BellOff, label: 'Do Not Disturb', on: s.dnd, click: () => s.set({ dnd: !s.dnd }) },
    { icon: Focus, label: focus.phase === 'idle' ? 'Focus 25m' : 'End focus', on: focus.phase !== 'idle', click: () => (focus.phase === 'idle' ? timers.startFocus() : timers.stopFocus()) },
    { icon: EyeOff, label: 'Privacy Shield', on: s.privacyShield, click: () => s.set({ privacyShield: !s.privacyShield }) },
    { icon: Sparkles, label: 'Live Wallpaper', on: s.animatedWallpaper, click: () => s.set({ animatedWallpaper: !s.animatedWallpaper }) },
    { icon: Droplets, label: 'Transparency', on: s.blur, click: () => s.set({ blur: !s.blur }) },
    { icon: Volume2, label: 'Sounds', on: s.sounds, click: () => s.set({ sounds: !s.sounds }) },
    { icon: ShieldCheck, label: 'Privacy Center', on: false, click: () => { wm.open('shield'); shell.close(); } },
  ];

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.16 }}
      className="absolute right-0 top-[28px] w-[340px] glass rounded-2xl border border-line-strong shadow-2xl shadow-black/30 p-3 z-[60] origin-top-right"
    >
      <div className="grid grid-cols-4 gap-2">
        {tiles.map((t) => (
          <button key={t.label} onClick={t.click} className="flex flex-col items-center gap-1.5 group">
            <div className={cx('w-12 h-12 rounded-2xl flex items-center justify-center transition-all group-active:scale-95', t.on ? 'bg-accent text-accent-fg shadow-lg shadow-accent/30' : 'bg-hover border border-line text-fg group-hover:bg-active')}>
              <t.icon size={18} />
            </div>
            <span className="text-[10.5px] text-muted text-center leading-tight">{t.label}</span>
          </button>
        ))}
      </div>
      <div className="mt-4 rounded-xl bg-hover border border-line p-3 space-y-3">
        <div className="flex items-center gap-3">
          <SunDim size={15} className="text-muted shrink-0" />
          <div className="flex-1">
            <div className="text-[11.5px] text-muted mb-1.5">Night light</div>
            <Slider value={night} min={0} max={100} onChange={(v) => useShell.setState({ nightLight: v })} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Sparkles size={15} className="text-muted shrink-0" />
          <div className="flex-1">
            <div className="text-[11.5px] text-muted mb-1.5">Dock size</div>
            <Slider value={s.dockSize} min={36} max={72} onChange={(v) => s.set({ dockSize: v })} />
          </div>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={() => { shell.close(); void session.lock(); }} className="flex-1 h-9 rounded-xl bg-hover border border-line hover:bg-active flex items-center justify-center gap-2 text-[12.5px] font-medium"><Lock size={14} /> Lock</button>
        <button onClick={() => { wm.open('settings'); shell.close(); }} className="flex-1 h-9 rounded-xl bg-hover border border-line hover:bg-active flex items-center justify-center gap-2 text-[12.5px] font-medium"><Settings size={14} /> Settings</button>
      </div>
    </motion.div>
  );
}
