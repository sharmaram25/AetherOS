import { useEffect, useMemo, useState } from 'react';
import { Globe, AlarmClock, Timer as TimerIcon, Watch, Focus, Plus, X, Play, Pause, RotateCcw, Flag, Trash2 } from 'lucide-react';
import type { AppProps } from '../kernel/registry';
import { useAppData } from '../kernel/appdata';
import { CLOCK_DEFAULT, type ClockData, useTimers, timers } from '../kernel/scheduler';
import { randomId } from '../kernel/crypto';
import { useSettings } from '../kernel/settings';
import { formatDuration } from '../lib/format';
import { Button, IconButton, Input, Segmented, Switch, Select, cx, useNow, useInterval } from '../ui';

type Tab = 'world' | 'alarm' | 'stopwatch' | 'timer' | 'focus';

const ZONES = ['Pacific/Honolulu', 'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York', 'America/Sao_Paulo', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Africa/Cairo', 'Africa/Lagos', 'Europe/Moscow', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Bangkok', 'Asia/Singapore', 'Asia/Shanghai', 'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland'];
const city = (z: string) => z.split('/').pop()!.replace(/_/g, ' ');

export default function Clock({ win }: AppProps) {
  const [tab, setTab] = useState<Tab>((win.data?.tab as Tab) ?? 'world');
  useEffect(() => { if (win.data?.tab) setTab(win.data.tab); }, [win.data?._n]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="h-full flex flex-col">
      <div className="p-3 flex justify-center border-b border-line">
        <Segmented value={tab} onChange={setTab} options={[
          { value: 'world', label: 'World', icon: Globe }, { value: 'alarm', label: 'Alarms', icon: AlarmClock },
          { value: 'stopwatch', label: 'Stopwatch', icon: Watch }, { value: 'timer', label: 'Timers', icon: TimerIcon }, { value: 'focus', label: 'Focus', icon: Focus },
        ]} />
      </div>
      <div className="flex-1 overflow-y-auto">
        {tab === 'world' && <World />}
        {tab === 'alarm' && <Alarms />}
        {tab === 'stopwatch' && <Stopwatch />}
        {tab === 'timer' && <Timers />}
        {tab === 'focus' && <FocusTab />}
      </div>
    </div>
  );
}

function AnalogClock({ date, size = 180 }: { date: Date; size?: number }) {
  const h = date.getHours() % 12, m = date.getMinutes(), s = date.getSeconds();
  const hand = (deg: number, len: number, w: number, color: string) => <line x1="50" y1="50" x2={50 + len * Math.sin((deg * Math.PI) / 180)} y2={50 - len * Math.cos((deg * Math.PI) / 180)} stroke={color} strokeWidth={w} strokeLinecap="round" />;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="48" fill="var(--hover)" stroke="var(--line-strong)" />
      {Array.from({ length: 60 }, (_, i) => <line key={i} x1="50" y1="5" x2="50" y2={i % 5 ? 7 : 10} stroke="var(--faint)" strokeWidth={i % 5 ? 0.5 : 1.4} transform={`rotate(${i * 6} 50 50)`} />)}
      {hand(h * 30 + m * 0.5, 24, 3, 'var(--fg)')}
      {hand(m * 6 + s * 0.1, 34, 2, 'var(--fg)')}
      {hand(s * 6, 38, 0.8, 'var(--accent)')}
      <circle cx="50" cy="50" r="2.2" fill="var(--accent)" />
    </svg>
  );
}

function World() {
  const now = useNow(1000);
  const use24h = useSettings((s) => s.use24h);
  const [data, setData] = useAppData<ClockData>('clock', CLOCK_DEFAULT);
  const [adding, setAdding] = useState(false);
  const local = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const offset = (z: string) => {
    const t = new Date(now.toLocaleString('en-US', { timeZone: z })).getTime() - new Date(now.toLocaleString('en-US', { timeZone: local })).getTime();
    const h = Math.round(t / 36e5);
    return h === 0 ? 'Same time' : `${h > 0 ? '+' : ''}${h} hrs`;
  };
  return (
    <div className="p-6 max-w-[560px] mx-auto">
      <div className="flex flex-col items-center">
        <AnalogClock date={now} />
        <div className="text-[34px] font-semibold tabular-nums mt-3">{now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: !use24h })}</div>
        <div className="text-muted text-[13px]">{city(local)} · {now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</div>
      </div>
      <div className="mt-6 space-y-1.5">
        {data.cities.map((z) => {
          const t = new Date(now.toLocaleString('en-US', { timeZone: z }));
          const night = t.getHours() < 6 || t.getHours() >= 20;
          return (
            <div key={z} className="group flex items-center gap-3 rounded-xl bg-hover border border-line px-4 py-3">
              <span className="text-[18px]">{night ? '🌙' : '☀️'}</span>
              <div className="flex-1"><div className="font-medium text-[14px]">{city(z)}</div><div className="text-[12px] text-muted">{offset(z)}</div></div>
              <div className="text-[22px] font-semibold tabular-nums">{now.toLocaleTimeString([], { timeZone: z, hour: 'numeric', minute: '2-digit', hour12: !use24h })}</div>
              <IconButton icon={X} size={13} className="opacity-0 group-hover:opacity-100" onClick={() => setData((d) => ({ ...d, cities: d.cities.filter((c) => c !== z) }))} />
            </div>
          );
        })}
        {adding ? (
          <Select value="" onChange={(v) => { if (v) setData((d) => ({ ...d, cities: [...d.cities, v] })); setAdding(false); }} options={[{ value: '', label: 'Choose a city…' }, ...ZONES.filter((z) => !data.cities.includes(z)).map((z) => ({ value: z, label: city(z) }))]} className="w-full" />
        ) : <Button className="w-full" icon={Plus} onClick={() => setAdding(true)}>Add city</Button>}
      </div>
    </div>
  );
}

function Alarms() {
  const [data, setData] = useAppData<ClockData>('clock', CLOCK_DEFAULT);
  const [time, setTime] = useState('07:30');
  const [label, setLabel] = useState('');
  const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  return (
    <div className="p-6 max-w-[520px] mx-auto space-y-4">
      <div className="rounded-2xl bg-hover border border-line p-4 flex gap-2">
        <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-32 h-9 text-[15px]" />
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label" className="h-9" />
        <Button variant="primary" icon={Plus} onClick={() => { setData((d) => ({ ...d, alarms: [...d.alarms, { id: randomId(6), time, label: label || 'Alarm', days: [], enabled: true }] })); setLabel(''); }}>Add</Button>
      </div>
      {data.alarms.length === 0 && <div className="text-center text-[13px] text-faint py-10">No alarms. They ring even when Clock is closed.</div>}
      {[...data.alarms].sort((a, b) => a.time.localeCompare(b.time)).map((a) => (
        <div key={a.id} className={cx('rounded-2xl border border-line px-4 py-3 flex items-center gap-4 transition-opacity', a.enabled ? 'bg-hover' : 'opacity-50')}>
          <div className="flex-1">
            <div className="text-[30px] font-semibold tabular-nums leading-none">{a.time}</div>
            <div className="text-[12px] text-muted mt-1">{a.label}</div>
            <div className="flex gap-1 mt-2">
              {DAYS.map((d, i) => (
                <button key={i} onClick={() => setData((x) => ({ ...x, alarms: x.alarms.map((y) => (y.id === a.id ? { ...y, days: y.days.includes(i) ? y.days.filter((z) => z !== i) : [...y.days, i] } : y)) }))}
                  className={cx('w-6 h-6 rounded-full text-[10.5px] font-semibold', a.days.includes(i) ? 'bg-accent text-accent-fg' : 'bg-active text-muted')}>{d}</button>
              ))}
              <span className="text-[11px] text-faint self-center ml-1">{a.days.length ? '' : 'Once'}</span>
            </div>
          </div>
          <Switch checked={a.enabled} onChange={(v) => setData((x) => ({ ...x, alarms: x.alarms.map((y) => (y.id === a.id ? { ...y, enabled: v } : y)) }))} />
          <IconButton icon={Trash2} size={14} onClick={() => setData((x) => ({ ...x, alarms: x.alarms.filter((y) => y.id !== a.id) }))} />
        </div>
      ))}
    </div>
  );
}

function Stopwatch() {
  const [start, setStart] = useState<number | null>(null);
  const [acc, setAcc] = useState(0);
  const [laps, setLaps] = useState<number[]>([]);
  const [, force] = useState(0);
  useInterval(() => force((x) => x + 1), start ? 33 : null);
  const elapsed = acc + (start ? Date.now() - start : 0);
  const lapTimes = laps.map((l, i) => l - (laps[i - 1] ?? 0));
  const best = Math.min(...lapTimes), worst = Math.max(...lapTimes);
  return (
    <div className="p-6 max-w-[460px] mx-auto flex flex-col items-center">
      <div className="text-[64px] font-semibold tabular-nums tracking-tight mt-6 font-mono">{formatDuration(elapsed, true)}</div>
      <div className="flex gap-3 mt-6">
        <Button size="lg" icon={start ? Flag : RotateCcw} onClick={() => (start ? setLaps((l) => [...l, elapsed]) : (setAcc(0), setLaps([])))} disabled={!start && !elapsed}>{start ? 'Lap' : 'Reset'}</Button>
        <Button size="lg" variant={start ? 'danger' : 'primary'} icon={start ? Pause : Play} onClick={() => { if (start) { setAcc(elapsed); setStart(null); } else setStart(Date.now()); }} className="w-32">{start ? 'Stop' : 'Start'}</Button>
      </div>
      <div className="w-full mt-8 space-y-1">
        {[...lapTimes].map((t, i) => ({ t, i })).reverse().map(({ t, i }) => (
          <div key={i} className={cx('flex justify-between px-4 py-2 rounded-lg text-[14px] tabular-nums font-mono border-b border-line', laps.length > 2 && t === best && 'text-success', laps.length > 2 && t === worst && 'text-danger')}>
            <span>Lap {i + 1}</span><span>{formatDuration(t, true)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Timers() {
  const list = useTimers((s) => s.timers);
  useTimers((s) => s.tick);
  const [m, setM] = useState(5);
  const [s, setS] = useState(0);
  const [label, setLabel] = useState('');
  const presets = [1, 3, 5, 10, 15, 25, 30, 60];
  return (
    <div className="p-6 max-w-[520px] mx-auto space-y-4">
      <div className="rounded-2xl bg-hover border border-line p-4 space-y-3">
        <div className="flex gap-2 items-center">
          <Input type="number" min={0} max={999} value={m} onChange={(e) => setM(Math.max(0, Number(e.target.value)))} className="w-20 h-9 text-center text-[15px]" /><span className="text-muted text-[13px]">min</span>
          <Input type="number" min={0} max={59} value={s} onChange={(e) => setS(Math.min(59, Math.max(0, Number(e.target.value))))} className="w-20 h-9 text-center text-[15px]" /><span className="text-muted text-[13px]">sec</span>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label" className="h-9" />
          <Button variant="primary" icon={Play} disabled={!m && !s} onClick={() => { timers.add((m * 60 + s) * 1000, label || `${m ? m + ' min ' : ''}${s ? s + ' s' : ''}`.trim()); setLabel(''); }}>Start</Button>
        </div>
        <div className="flex gap-1.5 flex-wrap">{presets.map((p) => <button key={p} onClick={() => timers.add(p * 60_000, `${p} min`)} className="h-7 px-3 rounded-full bg-active hover:bg-line-strong text-[12px] font-medium">{p}m</button>)}</div>
      </div>
      {list.length === 0 && <div className="text-center text-[13px] text-faint py-8">Timers keep running in the background.</div>}
      <div className="grid grid-cols-2 gap-3">
        {list.map((t) => {
          const left = t.endsAt ? Math.max(0, t.endsAt - Date.now()) : t.remaining;
          const R = 54, C = 2 * Math.PI * R;
          return (
            <div key={t.id} className="relative rounded-2xl bg-hover border border-line p-4 flex flex-col items-center">
              <IconButton icon={X} size={13} className="absolute top-1.5 right-1.5 w-7 h-7" onClick={() => timers.remove(t.id)} />
              <div className="relative w-[128px] h-[128px]">
                <svg viewBox="0 0 128 128" className="w-full h-full -rotate-90"><circle cx="64" cy="64" r={R} fill="none" stroke="var(--line)" strokeWidth="6" /><circle cx="64" cy="64" r={R} fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - left / t.duration)} style={{ transition: 'stroke-dashoffset 1s linear' }} /></svg>
                <div className="absolute inset-0 flex items-center justify-center text-[22px] font-semibold tabular-nums">{formatDuration(left + 999)}</div>
              </div>
              <div className="text-[12.5px] text-muted mt-2 truncate max-w-full">{t.label}</div>
              <div className="flex gap-1.5 mt-2">
                <IconButton icon={RotateCcw} onClick={() => timers.reset(t.id)} />
                <IconButton icon={t.endsAt ? Pause : Play} active onClick={() => timers.toggle(t.id)} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FocusTab() {
  const f = useTimers((s) => s.focus);
  useTimers((s) => s.tick);
  const [focusMin, setFocusMin] = useState(25);
  const [breakMin, setBreakMin] = useState(5);
  const total = (f.phase === 'break' ? f.breakMin : f.focusMin) * 60_000;
  const left = f.phase === 'idle' ? focusMin * 60_000 : f.paused ? f.remaining : Math.max(0, f.endsAt - Date.now());
  const R = 110, C = 2 * Math.PI * R;
  const color = f.phase === 'break' ? '#22c55e' : 'var(--accent)';
  const progress = useMemo(() => (f.phase === 'idle' ? 0 : 1 - left / total), [f.phase, left, total]);
  return (
    <div className="p-6 flex flex-col items-center">
      <div className="relative w-[260px] h-[260px] mt-2">
        <svg viewBox="0 0 260 260" className="w-full h-full -rotate-90"><circle cx="130" cy="130" r={R} fill="none" stroke="var(--line)" strokeWidth="10" /><circle cx="130" cy="130" r={R} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} style={{ transition: 'stroke-dashoffset 1s linear' }} /></svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-[12px] uppercase tracking-widest font-semibold" style={{ color }}>{f.phase === 'idle' ? 'Ready' : f.phase === 'focus' ? (f.paused ? 'Paused' : 'Focus') : 'Break'}</div>
          <div className="text-[54px] font-semibold tabular-nums tracking-tight">{formatDuration(left + 999)}</div>
          {f.round > 0 && <div className="text-[12px] text-muted">Session {f.round}</div>}
        </div>
      </div>
      {f.phase === 'idle' ? (
        <>
          <div className="flex gap-4 mt-6 text-[12.5px] text-muted items-center">
            <label className="flex items-center gap-2">Focus <Input type="number" min={1} max={180} value={focusMin} onChange={(e) => setFocusMin(Math.max(1, Number(e.target.value)))} className="w-16 h-8 text-center" /> min</label>
            <label className="flex items-center gap-2">Break <Input type="number" min={1} max={60} value={breakMin} onChange={(e) => setBreakMin(Math.max(1, Number(e.target.value)))} className="w-16 h-8 text-center" /> min</label>
          </div>
          <Button size="lg" variant="primary" icon={Play} className="mt-5 w-48" onClick={() => timers.startFocus(focusMin, breakMin)}>Start focusing</Button>
          <p className="text-[12px] text-faint mt-4 max-w-sm text-center">Do Not Disturb turns on automatically during focus and restores itself after.</p>
        </>
      ) : (
        <div className="flex gap-3 mt-6">
          <Button size="lg" icon={f.paused ? Play : Pause} onClick={() => timers.pauseFocus()}>{f.paused ? 'Resume' : 'Pause'}</Button>
          <Button size="lg" variant="danger" icon={X} onClick={() => timers.stopFocus()}>End</Button>
        </div>
      )}
    </div>
  );
}
