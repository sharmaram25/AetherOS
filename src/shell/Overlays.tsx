import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, X, ShieldCheck, Cpu, HardDrive, User } from 'lucide-react';
import { allApps, getApp, type AppCategory } from '../kernel/registry';
import { useWindows, wm } from '../kernel/windows';
import { useSession } from '../kernel/session';
import { vfs } from '../kernel/vfs';
import { formatBytes } from '../lib/mime';
import { fuzzy } from '../lib/calc';
import { shell } from './store';
import { AppGlyph, Kbd, cx, Input } from '../ui';
import { Logo } from './Logo';

/* ---------- Launchpad ---------- */
const ORDER: AppCategory[] = ['Productivity', 'Creativity', 'Media', 'Privacy', 'Developer', 'Utilities', 'System', 'Installed'];

export function Launchpad() {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const apps = useMemo(() => {
    const list = allApps();
    if (!q) return list;
    return list.map((a) => ({ a, s: Math.max(fuzzy(q, a.name), ...(a.keywords ?? []).map((k) => fuzzy(q, k) - 100)) })).filter((x) => x.s > 0).sort((x, y) => y.s - x.s).map((x) => x.a);
  }, [q]);
  useEffect(() => setSel(0), [q]);

  const open = (id: string) => { shell.close(); wm.open(id); };

  return (
    <motion.div
      className="fixed inset-0 z-[65] flex flex-col items-center pt-16 pb-28 bg-black/35 backdrop-blur-2xl"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
      onMouseDown={(e) => e.target === e.currentTarget && shell.close()}
    >
      <motion.div initial={{ scale: 1.05, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.05, opacity: 0 }} transition={{ duration: 0.22 }} className="w-full max-w-5xl flex flex-col items-center px-8 min-h-0" onMouseDown={(e) => e.target === e.currentTarget && shell.close()}>
        <div className="w-72">
          <Input
            autoFocus icon={Search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search"
            className="h-9 rounded-xl bg-white/10 border-white/15 text-white placeholder:text-white/50 text-center"
            onKeyDown={(e) => {
              if (e.key === 'Escape') shell.close();
              if (e.key === 'Enter' && apps[sel]) open(apps[sel].id);
              if (e.key === 'ArrowRight') setSel((s) => Math.min(apps.length - 1, s + 1));
              if (e.key === 'ArrowLeft') setSel((s) => Math.max(0, s - 1));
            }}
          />
        </div>
        <div className="mt-10 w-full overflow-y-auto min-h-0" onMouseDown={(e) => e.target === e.currentTarget && shell.close()}>
          {q ? (
            <Grid apps={apps} sel={sel} onOpen={open} />
          ) : (
            ORDER.map((cat) => {
              const list = apps.filter((a) => a.category === cat);
              if (!list.length) return null;
              return (
                <div key={cat} className="mb-8">
                  <div className="text-[11.5px] font-semibold uppercase tracking-widest text-white/50 mb-3 px-4">{cat}</div>
                  <Grid apps={list} onOpen={open} />
                </div>
              );
            })
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function Grid({ apps, sel = -1, onOpen }: { apps: ReturnType<typeof allApps>; sel?: number; onOpen: (id: string) => void }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-y-6">
      {apps.map((a, i) => (
        <button key={a.id} onClick={() => onOpen(a.id)} className={cx('flex flex-col items-center gap-2 group rounded-2xl py-2', i === sel && 'bg-white/10')}>
          <div className="transition-transform group-hover:scale-110 group-active:scale-95"><AppGlyph app={a} size={64} /></div>
          <span className="text-[12.5px] text-white font-medium text-center px-1 drop-shadow">{a.name}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------- Alt+Tab switcher ---------- */
export function Switcher() {
  const sw = useWindows((s) => s.switcher);
  const list = useMemo(() => wm.mru(), [sw !== null]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!sw || list.length === 0) return null;
  const idx = ((sw.index % list.length) + list.length) % list.length;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center pointer-events-none">
      <div className="glass rounded-3xl border border-line-strong shadow-2xl p-4 flex gap-3 max-w-[90vw] overflow-hidden animate-pop">
        {list.map((w, i) => {
          const app = getApp(w.appId)!;
          return (
            <div key={w.id} className={cx('w-[120px] flex flex-col items-center gap-2 p-3 rounded-2xl transition-colors', i === idx ? 'bg-accent/20 ring-2 ring-accent' : '')}>
              <AppGlyph app={app} size={56} />
              <div className="text-[11.5px] font-medium text-center truncate w-full">{w.title}</div>
              {w.state === 'minimized' && <div className="text-[10px] text-faint -mt-1">minimized</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Shortcuts help ---------- */
const SHORTCUTS: [string, [string, string][]][] = [
  ['General', [['Ctrl K  ·  Alt Space', 'Spotlight search'], ['Alt A', 'Launchpad'], ['Alt N', 'Notification center'], ['Alt L', 'Lock screen'], ['Alt /', 'This help'], ['Alt ,', 'Settings']]],
  ['Windows', [['Alt Tab  ·  Alt `', 'Switch windows'], ['Alt Q', 'Close window'], ['Alt M', 'Minimize'], ['Alt ↑', 'Maximize / restore'], ['Alt ← / →', 'Snap left / right'], ['Alt D', 'Show desktop']]],
  ['Workspaces', [['Alt O', 'Overview'], ['Alt 1 … 4', 'Go to workspace'], ['Alt Shift 1 … 4', 'Move window to workspace'], ['Alt PgUp / PgDn', 'Previous / next workspace']]],
  ['Apps', [['Alt T', 'New terminal'], ['Alt E', 'Files'], ['Ctrl S', 'Save (in editors)'], ['Ctrl F', 'Find (in editors)']]],
];

export function ShortcutsHelp() {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && shell.close();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  return (
    <motion.div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && shell.close()}>
      <motion.div initial={{ scale: 0.96 }} animate={{ scale: 1 }} className="w-[760px] max-w-[94vw] glass rounded-2xl border border-line-strong shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="text-[18px] font-semibold">Keyboard shortcuts</div>
          <button onClick={() => shell.close()} className="w-8 h-8 rounded-lg hover:bg-hover flex items-center justify-center text-muted"><X size={16} /></button>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-5">
          {SHORTCUTS.map(([group, list]) => (
            <div key={group}>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-faint mb-2">{group}</div>
              {list.map(([k, d]) => (
                <div key={d} className="flex items-center justify-between py-1.5 border-b border-line last:border-0 text-[13px]">
                  <span className="text-muted">{d}</span>
                  <span className="flex gap-1">{k.split('  ·  ')[0].split(' ').map((x, i) => <Kbd key={i}>{x}</Kbd>)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ---------- About ---------- */
export function About() {
  const mode = useSession((s) => s.mode);
  const u = vfs.usage();
  const ref = useRef<HTMLDivElement>(null);
  return (
    <motion.div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && shell.close()}>
      <motion.div ref={ref} initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} className="w-[420px] glass rounded-3xl border border-line-strong shadow-2xl p-8 text-center relative">
        <button onClick={() => shell.close()} className="absolute top-3 right-3 w-8 h-8 rounded-lg hover:bg-hover flex items-center justify-center text-muted"><X size={16} /></button>
        <div className="flex justify-center"><Logo size={72} glow /></div>
        <div className="mt-4 text-[24px] font-semibold tracking-tight">AetherOS</div>
        <div className="text-muted text-[13px]">Version 2.0 · “Halcyon”</div>
        <div className="mt-6 space-y-2 text-left text-[12.5px]">
          <InfoRow icon={ShieldCheck} k="Encryption" v={mode === 'guest' ? 'RAM only (guest)' : `AES-256-GCM · ${mode === 'passphrase' ? 'PBKDF2 600k' : 'device key'}`} />
          <InfoRow icon={HardDrive} k="Storage" v={`${u.files} files · ${formatBytes(u.bytes)}`} />
          <InfoRow icon={Cpu} k="Processor" v={`${navigator.hardwareConcurrency || '?'} logical cores`} />
          <InfoRow icon={User} k="Created by" v="Ram Sharma" />
        </div>
        <div className="mt-6 text-[11.5px] text-faint leading-relaxed">Local-first. No accounts, no telemetry, no cloud.<br />Open source under the MIT license.</div>
      </motion.div>
    </motion.div>
  );
}

function InfoRow({ icon: Icon, k, v }: { icon: typeof Cpu; k: string; v: string }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-hover border border-line">
      <Icon size={15} className="text-accent" />
      <span className="text-muted w-24">{k}</span>
      <span className="font-medium truncate">{v}</span>
    </div>
  );
}
