import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { BellOff, ChevronLeft, ChevronRight, X, CalendarDays, CheckCircle2, Focus, Trash2 } from 'lucide-react';
import { useNotify, clearNotifications, removeNotification } from '../kernel/notify';
import { useSettings } from '../kernel/settings';
import { useAppData } from '../kernel/appdata';
import { CALENDAR_DEFAULT, type CalendarData, ymd, useTimers, timers } from '../kernel/scheduler';
import { getApp } from '../kernel/registry';
import { wm } from '../kernel/windows';
import { shell } from './store';
import { AppGlyph, Switch, cx, useNow } from '../ui';
import { timeAgo } from '../lib/format';

interface TaskLite { id: string; title: string; due?: string; status: string }

export function NotificationCenter() {
  const history = useNotify((s) => s.history);
  const { dnd, set } = useSettings();
  const ref = useRef<HTMLDivElement>(null);
  const now = useNow(30_000);
  const [cal] = useAppData<CalendarData>('calendar', CALENDAR_DEFAULT);
  const [tasks] = useAppData<{ tasks: TaskLite[] }>('tasks', { tasks: [] });
  const focus = useTimers((s) => s.focus);
  const [month, setMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && !(e.target as HTMLElement).closest('.fixed.top-0')) shell.close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && shell.close();
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('pointerdown', onDown); window.removeEventListener('keydown', onKey); };
  }, []);

  const today = ymd(now);
  const upcoming = useMemo(() => cal.events
    .filter((e) => e.date >= today)
    .sort((a, b) => (a.date + (a.start ?? '')).localeCompare(b.date + (b.start ?? '')))
    .slice(0, 4), [cal, today]);
  const dueToday = tasks.tasks.filter((t) => t.status !== 'done' && t.due && t.due <= today);
  const eventDays = new Set(cal.events.map((e) => e.date));

  const first = month.getDay();
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();

  return (
    <motion.div
      ref={ref}
      initial={{ x: 380, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 380, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 38 }}
      className="fixed right-2 top-[38px] bottom-2 w-[360px] z-[60] flex flex-col gap-2.5 overflow-y-auto pb-2"
    >
      {/* Calendar widget */}
      <div className="glass rounded-2xl border border-line-strong shadow-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[12px] text-accent font-semibold uppercase tracking-wide">{now.toLocaleDateString([], { weekday: 'long' })}</div>
            <div className="text-[22px] font-semibold tracking-tight">{now.toLocaleDateString([], { month: 'long', day: 'numeric' })}</div>
          </div>
          <div className="flex items-center gap-0.5">
            <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="w-7 h-7 rounded-lg hover:bg-hover flex items-center justify-center text-muted"><ChevronLeft size={15} /></button>
            <span className="text-[12px] font-medium w-20 text-center">{month.toLocaleDateString([], { month: 'short', year: 'numeric' })}</span>
            <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="w-7 h-7 rounded-lg hover:bg-hover flex items-center justify-center text-muted"><ChevronRight size={15} /></button>
          </div>
        </div>
        <div className="grid grid-cols-7 mt-3 text-center text-[10.5px] text-faint font-medium">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i} className="h-6 flex items-center justify-center">{d}</div>)}
          {Array.from({ length: first }, (_, i) => <div key={'e' + i} />)}
          {Array.from({ length: days }, (_, i) => {
            const d = ymd(new Date(month.getFullYear(), month.getMonth(), i + 1));
            const isToday = d === today;
            return (
              <button key={i} onClick={() => { wm.open('calendar', { date: d }); shell.close(); }}
                className={cx('h-8 rounded-lg text-[12px] relative transition-colors', isToday ? 'bg-accent text-accent-fg font-semibold' : 'text-fg hover:bg-hover')}>
                {i + 1}
                {eventDays.has(d) && !isToday && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent" />}
              </button>
            );
          })}
        </div>
        {upcoming.length > 0 && (
          <div className="mt-3 pt-3 border-t border-line space-y-1.5">
            {upcoming.map((e) => (
              <button key={e.id} onClick={() => { wm.open('calendar', { date: e.date }); shell.close(); }} className="w-full flex items-center gap-2.5 text-left hover:bg-hover rounded-lg px-1.5 py-1">
                <span className="w-1 h-8 rounded-full shrink-0" style={{ background: e.color }} />
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-medium truncate">{e.title}</div>
                  <div className="text-[11px] text-muted">{e.date === today ? 'Today' : new Date(e.date + 'T00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}{e.allDay ? ' · all day' : e.start ? ` · ${e.start}` : ''}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Glance widgets */}
      <div className="grid grid-cols-2 gap-2.5">
        <button onClick={() => (focus.phase === 'idle' ? timers.startFocus() : timers.stopFocus())} className="glass rounded-2xl border border-line-strong p-3.5 text-left hover:bg-hover transition-colors">
          <Focus size={17} className={focus.phase !== 'idle' ? 'text-accent' : 'text-muted'} />
          <div className="mt-2 text-[13px] font-semibold">{focus.phase === 'idle' ? 'Start focus' : focus.phase === 'focus' ? 'Focusing…' : 'On break'}</div>
          <div className="text-[11px] text-muted">{focus.phase === 'idle' ? '25 min · silences alerts' : 'Tap to end session'}</div>
        </button>
        <button onClick={() => { wm.open('tasks'); shell.close(); }} className="glass rounded-2xl border border-line-strong p-3.5 text-left hover:bg-hover transition-colors">
          <CheckCircle2 size={17} className={dueToday.length ? 'text-warn' : 'text-success'} />
          <div className="mt-2 text-[13px] font-semibold">{dueToday.length ? `${dueToday.length} due` : 'All clear'}</div>
          <div className="text-[11px] text-muted truncate">{dueToday[0]?.title ?? 'No tasks due today'}</div>
        </button>
      </div>

      {/* Notifications */}
      <div className="glass rounded-2xl border border-line-strong shadow-xl flex flex-col min-h-[140px]">
        <div className="flex items-center gap-2 px-4 h-11 border-b border-line">
          <span className="text-[13px] font-semibold flex-1">Notifications</span>
          <span className="text-[11.5px] text-muted flex items-center gap-1.5"><BellOff size={12} /> DND</span>
          <Switch checked={dnd} onChange={(v) => set({ dnd: v })} />
          {history.length > 0 && <button onClick={clearNotifications} title="Clear all" className="w-7 h-7 rounded-lg hover:bg-hover flex items-center justify-center text-muted"><Trash2 size={13} /></button>}
        </div>
        <div className="p-2 space-y-1.5">
          {history.length === 0 && (
            <div className="py-8 text-center text-[12.5px] text-faint flex flex-col items-center gap-2"><CalendarDays size={20} /> You're all caught up</div>
          )}
          {history.map((n) => {
            const app = n.appId ? getApp(n.appId) : null;
            return (
              <div key={n.id} className="group relative rounded-xl bg-hover border border-line p-3 flex gap-3">
                {app ? <AppGlyph app={app} size={28} /> : <div className={cx('w-7 h-7 rounded-lg shrink-0', n.tone === 'error' ? 'bg-danger/20' : n.tone === 'success' ? 'bg-success/20' : 'bg-accent/20')} />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[12.5px] font-semibold truncate flex-1">{n.title}</span>
                    <span className="text-[10.5px] text-faint shrink-0">{timeAgo(n.time)}</span>
                  </div>
                  {n.body && <div className="text-[12px] text-muted mt-0.5 line-clamp-3 break-words">{n.body}</div>}
                  {n.actions && (
                    <div className="flex gap-1.5 mt-2">
                      {n.actions.map((a) => <button key={a.label} onClick={() => { a.run(); removeNotification(n.id); }} className="h-6 px-2.5 rounded-md bg-active hover:bg-line-strong text-[11.5px] font-medium">{a.label}</button>)}
                    </div>
                  )}
                </div>
                <button onClick={() => removeNotification(n.id)} className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-elevated border border-line-strong shadow opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><X size={11} /></button>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
