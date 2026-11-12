import { motion } from 'framer-motion';
import { CalendarDays, CheckCircle2, ShieldCheck, Lock, Sparkles } from 'lucide-react';
import { useSettings } from '../kernel/settings';
import { useAppData } from '../kernel/appdata';
import { CALENDAR_DEFAULT, type CalendarData, ymd } from '../kernel/scheduler';
import { useSession } from '../kernel/session';
import { useNetwork } from '../kernel/privacy';
import { useVfs } from '../kernel/vfs';
import { wm } from '../kernel/windows';
import { useNow } from '../ui';
import { formatBytes } from '../lib/mime';

function greeting(h: number) {
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function Widgets() {
  const now = useNow(1000);
  const { userName, use24h } = useSettings();
  const [cal] = useAppData<CalendarData>('calendar', CALENDAR_DEFAULT);
  const [tasks] = useAppData<{ tasks: { id: string; title: string; status: string; due?: string }[] }>('tasks', { tasks: [] });
  const mode = useSession((s) => s.mode);
  const external = useNetwork((s) => s.external);
  const bytes = useVfs((s) => Object.values(s.nodes).reduce((a, n) => a + n.size, 0));

  const today = ymd(now);
  const nowHm = now.toTimeString().slice(0, 5);
  const next = cal.events
    .filter((e) => e.date > today || (e.date === today && (e.allDay || (e.end ?? e.start ?? '') >= nowHm)))
    .sort((a, b) => (a.date + (a.start ?? '')).localeCompare(b.date + (b.start ?? '')))[0];
  const open = tasks.tasks.filter((t) => t.status !== 'done');

  const time = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: !use24h }).replace(/\s?[AP]M$/i, '');
  const ampm = !use24h ? now.toLocaleTimeString([], { hour: 'numeric', hour12: true }).replace(/[\d\s]/g, '') : '';

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25, duration: 0.5 }}
      className="absolute right-5 top-[46px] w-[300px] hidden min-[900px]:flex flex-col gap-3 text-white pointer-events-none select-none"
    >
      <div className="text-right [text-shadow:0_2px_16px_rgba(0,0,0,0.35)]">
        <div className="text-[15px] font-medium text-white/80">{greeting(now.getHours())}, {userName.split(' ')[0]}</div>
        <div className="flex items-baseline justify-end gap-1.5">
          <span className="text-[76px] leading-none font-semibold tracking-[-0.04em] tabular-nums">{time}</span>
          {ampm && <span className="text-[18px] font-medium text-white/70">{ampm}</span>}
        </div>
        <div className="text-[15px] text-white/75 mt-1">{now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</div>
      </div>

      <div className="pointer-events-auto rounded-2xl bg-black/25 backdrop-blur-xl border border-white/10 p-1.5 space-y-1">
        <button onClick={() => wm.open('calendar', next ? { date: next.date } : undefined)} className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/10 text-left transition-colors">
          <div className="w-9 h-9 rounded-xl bg-red-500/90 flex items-center justify-center shrink-0"><CalendarDays size={17} /></div>
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-white/55 font-semibold">Up next</div>
            <div className="text-[13px] font-medium truncate">{next ? next.title : 'Nothing scheduled'}</div>
            {next && <div className="text-[11.5px] text-white/60">{next.date === today ? 'Today' : new Date(next.date + 'T00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}{next.start && !next.allDay ? ` · ${next.start}` : ''}</div>}
          </div>
        </button>
        <button onClick={() => wm.open('tasks')} className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/10 text-left transition-colors">
          <div className="w-9 h-9 rounded-xl bg-sky-500/90 flex items-center justify-center shrink-0"><CheckCircle2 size={17} /></div>
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-white/55 font-semibold">Tasks</div>
            <div className="text-[13px] font-medium truncate">{open.length ? `${open.length} open · ${open[0].title}` : 'Inbox zero ✨'}</div>
          </div>
        </button>
        <button onClick={() => wm.open('shield')} className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/10 text-left transition-colors">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/90 flex items-center justify-center shrink-0">{mode === 'passphrase' ? <Lock size={16} /> : <ShieldCheck size={17} />}</div>
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-white/55 font-semibold">Privacy</div>
            <div className="text-[13px] font-medium truncate">{mode === 'guest' ? 'Guest · nothing is saved' : `${formatBytes(bytes)} encrypted`}</div>
            <div className="text-[11.5px] text-white/60">{external === 0 ? 'No external connections' : `${external} external request${external > 1 ? 's' : ''}`}</div>
          </div>
        </button>
        <button onClick={() => wm.open('cortex')} className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/10 text-left transition-colors">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center shrink-0"><Sparkles size={16} /></div>
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-white/55 font-semibold">Cortex</div>
            <div className="text-[13px] font-medium truncate">Ask anything — privately</div>
          </div>
        </button>
      </div>
    </motion.div>
  );
}
