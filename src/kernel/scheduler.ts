/** Background jobs: alarms, timers, focus sessions and calendar reminders fire even when their apps are closed. */
import { create } from 'zustand';
import { getAppData, loadAppData, setAppData } from './appdata';
import { notify } from './notify';
import { sound } from '../lib/sound';
import { randomId } from './crypto';
import { wm } from './windows';
import { useSettings } from './settings';

export interface Alarm { id: string; time: string; label: string; days: number[]; enabled: boolean; lastFired?: string }
export interface ClockData { alarms: Alarm[]; cities: string[] }
export const CLOCK_DEFAULT: ClockData = { alarms: [], cities: ['America/New_York', 'Europe/London', 'Asia/Tokyo'] };

export interface CalEvent {
  id: string; title: string; date: string; start?: string; end?: string; allDay: boolean;
  color: string; notes?: string; location?: string; remind: number | null; notifiedFor?: string;
}
export interface CalendarData { events: CalEvent[] }
export const CALENDAR_DEFAULT: CalendarData = { events: [] };

export interface Timer { id: string; label: string; duration: number; endsAt: number | null; remaining: number }
export interface Focus { phase: 'idle' | 'focus' | 'break'; endsAt: number; round: number; focusMin: number; breakMin: number; remaining: number; paused: boolean; prevDnd?: boolean }

export const useTimers = create<{ timers: Timer[]; focus: Focus; tick: number }>(() => ({
  timers: [],
  focus: { phase: 'idle', endsAt: 0, round: 0, focusMin: 25, breakMin: 5, remaining: 25 * 60_000, paused: false },
  tick: 0,
}));

export const timers = {
  add(duration: number, label = 'Timer') {
    const t: Timer = { id: randomId(6), label, duration, endsAt: Date.now() + duration, remaining: duration };
    useTimers.setState((s) => ({ timers: [...s.timers, t] }));
    return t.id;
  },
  toggle(id: string) {
    useTimers.setState((s) => ({
      timers: s.timers.map((t) => t.id !== id ? t : t.endsAt
        ? { ...t, endsAt: null, remaining: Math.max(0, t.endsAt - Date.now()) }
        : { ...t, endsAt: Date.now() + t.remaining }),
    }));
  },
  reset(id: string) {
    useTimers.setState((s) => ({ timers: s.timers.map((t) => t.id === id ? { ...t, endsAt: null, remaining: t.duration } : t) }));
  },
  remove(id: string) {
    useTimers.setState((s) => ({ timers: s.timers.filter((t) => t.id !== id) }));
  },
  startFocus(focusMin = 25, breakMin = 5) {
    const prevDnd = useSettings.getState().dnd;
    useSettings.getState().set({ dnd: true });
    useTimers.setState((s) => ({ focus: { phase: 'focus', endsAt: Date.now() + focusMin * 60_000, round: s.focus.round + 1, focusMin, breakMin, remaining: focusMin * 60_000, paused: false, prevDnd } }));
  },
  pauseFocus() {
    useTimers.setState((s) => {
      const f = s.focus;
      if (f.phase === 'idle') return s;
      return { focus: f.paused ? { ...f, paused: false, endsAt: Date.now() + f.remaining } : { ...f, paused: true, remaining: Math.max(0, f.endsAt - Date.now()) } };
    });
  },
  stopFocus() {
    const f = useTimers.getState().focus;
    if (f.prevDnd !== undefined) useSettings.getState().set({ dnd: f.prevDnd });
    useTimers.setState((s) => ({ focus: { ...s.focus, phase: 'idle', endsAt: 0, paused: false, remaining: s.focus.focusMin * 60_000, round: 0 } }));
  },
};

let fast: ReturnType<typeof setInterval> | null = null;
let slow: ReturnType<typeof setInterval> | null = null;

const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

function fastTick() {
  const now = Date.now();
  const s = useTimers.getState();
  const done = s.timers.filter((t) => t.endsAt && t.endsAt <= now);
  if (done.length) {
    useTimers.setState({ timers: s.timers.map((t) => done.includes(t) ? { ...t, endsAt: null, remaining: t.duration } : t) });
    done.forEach((t) => {
      sound('alarm');
      notify({ appId: 'clock', title: `${t.label} finished`, body: 'Your timer is done.', tone: 'success', actions: [{ label: 'Open Clock', run: () => wm.open('clock', { tab: 'timer' }) }] });
    });
  }
  const f = s.focus;
  if (f.phase !== 'idle' && !f.paused && f.endsAt <= now) {
    sound('alarm');
    if (f.phase === 'focus') {
      if (f.prevDnd !== undefined) useSettings.getState().set({ dnd: f.prevDnd });
      notify({ appId: 'clock', title: 'Focus session complete', body: `Nice work. Take a ${f.breakMin}-minute break.`, tone: 'success' });
      useTimers.setState({ focus: { ...f, phase: 'break', endsAt: now + f.breakMin * 60_000, remaining: f.breakMin * 60_000 } });
    } else {
      notify({ appId: 'clock', title: 'Break is over', body: 'Ready for another focus session?', actions: [{ label: 'Start focus', run: () => timers.startFocus(f.focusMin, f.breakMin) }] });
      useTimers.setState({ focus: { ...f, phase: 'idle', endsAt: 0, remaining: f.focusMin * 60_000 } });
    }
  }
  useTimers.setState((st) => ({ tick: st.tick + 1 }));
}

function slowTick() {
  const now = new Date();
  const today = ymd(now);
  const time = hm(now);

  const clock = getAppData<ClockData>('clock', CLOCK_DEFAULT);
  let clockChanged = false;
  const alarms = clock.alarms.map((a) => {
    if (!a.enabled || a.time !== time) return a;
    const key = `${today} ${time}`;
    if (a.lastFired === key) return a;
    if (a.days.length && !a.days.includes(now.getDay())) return a;
    clockChanged = true;
    sound('alarm');
    notify({ appId: 'clock', title: a.label || 'Alarm', body: `It's ${time}.`, tone: 'warn', actions: [{ label: 'Snooze 9 min', run: () => timers.add(9 * 60_000, `Snooze · ${a.label || 'Alarm'}`) }] });
    return { ...a, lastFired: key, enabled: a.days.length ? a.enabled : false };
  });
  if (clockChanged) setAppData<ClockData>('clock', { ...clock, alarms });

  const cal = getAppData<CalendarData>('calendar', CALENDAR_DEFAULT);
  let calChanged = false;
  const events = cal.events.map((e) => {
    if (e.remind == null || e.allDay || !e.start) return e;
    const startAt = new Date(`${e.date}T${e.start}`);
    const fireAt = startAt.getTime() - e.remind * 60_000;
    const key = `${e.date}T${e.start}`;
    if (e.notifiedFor === key || now.getTime() < fireAt || now.getTime() > startAt.getTime() + 60_000) return e;
    calChanged = true;
    sound('notify');
    notify({ appId: 'calendar', title: e.title, body: e.remind === 0 ? `Starting now${e.location ? ' · ' + e.location : ''}` : `Starts in ${e.remind} min at ${e.start}`, actions: [{ label: 'View', run: () => wm.open('calendar', { date: e.date }) }] });
    return { ...e, notifiedFor: key };
  });
  if (calChanged) setAppData<CalendarData>('calendar', { ...cal, events });
}

export async function startScheduler() {
  stopScheduler();
  await Promise.all([loadAppData('clock', CLOCK_DEFAULT), loadAppData('calendar', CALENDAR_DEFAULT)]);
  fast = setInterval(fastTick, 1000);
  slow = setInterval(slowTick, 10_000);
  slowTick();
}

export function stopScheduler() {
  if (fast) clearInterval(fast);
  if (slow) clearInterval(slow);
  fast = slow = null;
  useTimers.setState((s) => ({ timers: [], focus: { ...s.focus, phase: 'idle', endsAt: 0, paused: false } }));
}
