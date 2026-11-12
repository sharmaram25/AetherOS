import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2, Upload, Download, MapPin, Bell, CalendarDays, X } from 'lucide-react';
import type { AppProps } from '../kernel/registry';
import { useAppData } from '../kernel/appdata';
import { CALENDAR_DEFAULT, type CalendarData, type CalEvent, ymd } from '../kernel/scheduler';
import { randomId } from '../kernel/crypto';
import { vfs } from '../kernel/vfs';
import { toast } from '../kernel/notify';
import { pickHostFiles, downloadBlob } from '../kernel/launcher';
import { Button, IconButton, Input, Textarea, Segmented, Select, Switch, cx, useNow, openMenu } from '../ui';

const COLORS = ['#6366f1', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#0ea5e9', '#a855f7', '#ec4899'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOUR_H = 48;

const parseDate = (s: string) => new Date(s + 'T00:00');
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const minutes = (t?: string) => (t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : 0);

export default function Calendar({ win }: AppProps) {
  const now = useNow(60_000);
  const [data, setData] = useAppData<CalendarData>('calendar', CALENDAR_DEFAULT);
  const [view, setView] = useState<'month' | 'week' | 'agenda'>('month');
  const [cursor, setCursor] = useState(() => (win.data?.date ? parseDate(win.data.date) : new Date()));
  const [selDate, setSelDate] = useState(ymd(cursor));
  const [edit, setEdit] = useState<CalEvent | null>(null);
  const today = ymd(now);

  useEffect(() => {
    if (win.data?.date) { setCursor(parseDate(win.data.date)); setSelDate(win.data.date); }
    if (win.data?.path && /\.ics$/i.test(win.data.path)) void vfs.readText(win.data.path).then(importIcs);
  }, [win.data?._n]); // eslint-disable-line react-hooks/exhaustive-deps

  const byDate = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    for (const e of data.events) { if (!m.has(e.date)) m.set(e.date, []); m.get(e.date)!.push(e); }
    m.forEach((l) => l.sort((a, b) => Number(b.allDay) - Number(a.allDay) || (a.start ?? '').localeCompare(b.start ?? '')));
    return m;
  }, [data.events]);

  const newEvent = (date = selDate, start?: string) => setEdit({
    id: randomId(10), title: '', date, allDay: !start && view === 'month', start: start ?? '09:00', end: start ? `${String(Math.min(23, Number(start.slice(0, 2)) + 1)).padStart(2, '0')}:00` : '10:00', color: COLORS[0], remind: 10,
  });

  const save = (e: CalEvent) => {
    setData((d) => ({ events: d.events.some((x) => x.id === e.id) ? d.events.map((x) => (x.id === e.id ? { ...e, notifiedFor: undefined } : x)) : [...d.events, e] }));
    setEdit(null);
  };
  const remove = (id: string) => { setData((d) => ({ events: d.events.filter((x) => x.id !== id) })); setEdit(null); };

  function importIcs(text: string) {
    const events: CalEvent[] = [];
    const unfolded = text.replace(/\r?\n[ \t]/g, '');
    for (const block of unfolded.split('BEGIN:VEVENT').slice(1)) {
      const get = (k: string) => new RegExp(`^${k}(?:;[^:]*)?:(.*)$`, 'm').exec(block)?.[1]?.trim();
      const ds = get('DTSTART'), de = get('DTEND');
      if (!ds) continue;
      const allDay = /^\d{8}$/.test(ds);
      const toLocal = (v: string) => {
        if (/^\d{8}$/.test(v)) return { date: `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`, time: undefined };
        const iso = `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}T${v.slice(9, 11)}:${v.slice(11, 13)}:${v.slice(13, 15)}${v.endsWith('Z') ? 'Z' : ''}`;
        const d = new Date(iso);
        return { date: ymd(d), time: d.toTimeString().slice(0, 5) };
      };
      const s = toLocal(ds), e = de ? toLocal(de) : null;
      const unesc = (x?: string) => x?.replace(/\\n/g, '\n').replace(/\\([,;\\])/g, '$1');
      events.push({ id: randomId(10), title: unesc(get('SUMMARY')) || 'Untitled', date: s.date, start: s.time, end: e?.time, allDay, color: COLORS[events.length % COLORS.length], notes: unesc(get('DESCRIPTION')), location: unesc(get('LOCATION')), remind: allDay ? null : 10 });
    }
    if (!events.length) { toast('No events found in file', 'warn'); return; }
    setData((d) => ({ events: [...d.events, ...events] }));
    toast(`Imported ${events.length} events`, 'success');
  }

  const exportIcs = () => {
    const esc = (s = '') => s.replace(/[\\,;]/g, (m) => '\\' + m).replace(/\n/g, '\\n');
    const dt = (date: string, time?: string) => (time ? `${date.replace(/-/g, '')}T${time.replace(':', '')}00` : date.replace(/-/g, ''));
    const body = data.events.map((e) => [
      'BEGIN:VEVENT', `UID:${e.id}@aetheros`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
      e.allDay ? `DTSTART;VALUE=DATE:${dt(e.date)}` : `DTSTART:${dt(e.date, e.start)}`,
      e.allDay ? `DTEND;VALUE=DATE:${dt(ymd(addDays(parseDate(e.date), 1)))}` : `DTEND:${dt(e.date, e.end ?? e.start)}`,
      `SUMMARY:${esc(e.title)}`, ...(e.location ? [`LOCATION:${esc(e.location)}`] : []), ...(e.notes ? [`DESCRIPTION:${esc(e.notes)}`] : []), 'END:VEVENT',
    ].join('\r\n')).join('\r\n');
    downloadBlob(new Blob([`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//AetherOS//Calendar//EN\r\n${body}\r\nEND:VCALENDAR\r\n`], { type: 'text/calendar' }), 'aether-calendar.ics');
  };

  const step = (dir: number) => {
    const c = new Date(cursor);
    if (view === 'month') c.setMonth(c.getMonth() + dir, 1); else c.setDate(c.getDate() + dir * 7);
    setCursor(c);
  };

  const title = view === 'week'
    ? (() => { const s = addDays(cursor, -cursor.getDay()); const e = addDays(s, 6); return `${s.toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString([], { month: s.getMonth() === e.getMonth() ? undefined : 'short', day: 'numeric', year: 'numeric' })}`; })()
    : cursor.toLocaleDateString([], { month: 'long', year: 'numeric' });

  const selEvents = byDate.get(selDate) ?? [];

  return (
    <div className="h-full flex flex-col">
      <div className="h-12 shrink-0 flex items-center gap-2 px-3 border-b border-line">
        <div className="text-[17px] font-semibold w-56 truncate">{title}</div>
        <IconButton icon={ChevronLeft} onClick={() => step(-1)} label="Previous" />
        <Button size="sm" onClick={() => { setCursor(new Date()); setSelDate(today); }}>Today</Button>
        <IconButton icon={ChevronRight} onClick={() => step(1)} label="Next" />
        <div className="flex-1" />
        <Segmented size="sm" value={view} onChange={setView} options={[{ value: 'month', label: 'Month' }, { value: 'week', label: 'Week' }, { value: 'agenda', label: 'Agenda' }]} />
        <IconButton icon={Upload} label="Import .ics" onClick={async () => { const [f] = await pickHostFiles({ accept: '.ics', multiple: false }); if (f) importIcs(await f.text()); }} />
        <IconButton icon={Download} label="Export .ics" onClick={exportIcs} />
        <Button size="sm" variant="primary" icon={Plus} onClick={() => newEvent()}>Event</Button>
      </div>
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 min-w-0 flex flex-col">
          {view === 'month' && <MonthGrid cursor={cursor} today={today} selDate={selDate} byDate={byDate} onSelect={setSelDate} onNew={(d) => newEvent(d)} onEdit={setEdit} />}
          {view === 'week' && <WeekGrid cursor={cursor} today={today} now={now} byDate={byDate} onNew={newEvent} onEdit={setEdit} />}
          {view === 'agenda' && <Agenda events={data.events} today={today} onEdit={setEdit} />}
        </div>
        {view === 'month' && (
          <div className="w-[260px] shrink-0 border-l border-line flex flex-col">
            <div className="p-4 border-b border-line">
              <div className="text-[12px] text-accent font-semibold uppercase tracking-wide">{parseDate(selDate).toLocaleDateString([], { weekday: 'long' })}</div>
              <div className="text-[22px] font-semibold">{parseDate(selDate).toLocaleDateString([], { month: 'long', day: 'numeric' })}</div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {selEvents.length === 0 && <div className="text-center text-[12.5px] text-faint py-8">No events</div>}
              {selEvents.map((e) => <EventCard key={e.id} e={e} onClick={() => setEdit(e)} />)}
            </div>
            <div className="p-2 border-t border-line"><Button className="w-full" icon={Plus} onClick={() => newEvent()}>Add event</Button></div>
          </div>
        )}
      </div>
      {edit && <EventEditor ev={edit} isNew={!data.events.some((x) => x.id === edit.id)} onSave={save} onDelete={() => remove(edit.id)} onClose={() => setEdit(null)} />}
    </div>
  );
}

function EventCard({ e, onClick }: { e: CalEvent; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex gap-2.5 p-2.5 rounded-xl hover:bg-hover text-left" style={{ background: e.color + '14' }}>
      <span className="w-1 rounded-full shrink-0" style={{ background: e.color }} />
      <div className="min-w-0">
        <div className="text-[13px] font-medium truncate">{e.title}</div>
        <div className="text-[11.5px] text-muted">{e.allDay ? 'All day' : `${e.start}${e.end ? ' – ' + e.end : ''}`}{e.location ? ` · ${e.location}` : ''}</div>
      </div>
    </button>
  );
}

function MonthGrid({ cursor, today, selDate, byDate, onSelect, onNew, onEdit }: { cursor: Date; today: string; selDate: string; byDate: Map<string, CalEvent[]>; onSelect: (d: string) => void; onNew: (d: string) => void; onEdit: (e: CalEvent) => void }) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = addDays(first, -first.getDay());
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="grid grid-cols-7 border-b border-line">{DOW.map((d) => <div key={d} className="h-8 flex items-center justify-end px-3 text-[11.5px] font-medium text-muted">{d}</div>)}</div>
      <div className="flex-1 grid grid-cols-7 grid-rows-6 min-h-0">
        {days.map((d) => {
          const key = ymd(d);
          const inMonth = d.getMonth() === cursor.getMonth();
          const evs = byDate.get(key) ?? [];
          return (
            <div key={key} onClick={() => onSelect(key)} onDoubleClick={() => onNew(key)}
              className={cx('border-r border-b border-line p-1 flex flex-col gap-0.5 min-h-0 overflow-hidden cursor-default', !inMonth && 'bg-hover/40', selDate === key && 'bg-accent/8 ring-1 ring-inset ring-accent/40')}>
              <div className="flex justify-end">
                <span className={cx('w-6 h-6 flex items-center justify-center rounded-full text-[12px]', key === today ? 'bg-accent text-accent-fg font-semibold' : inMonth ? '' : 'text-faint')}>{d.getDate()}</span>
              </div>
              {evs.slice(0, 3).map((e) => (
                <button key={e.id} onClick={(ev) => { ev.stopPropagation(); onEdit(e); }} className="text-left text-[11px] truncate px-1.5 py-0.5 rounded-md font-medium" style={{ background: e.color + (e.allDay ? 'dd' : '22'), color: e.allDay ? '#fff' : undefined }}>
                  {!e.allDay && <span className="opacity-70 mr-1">{e.start}</span>}{e.title}
                </button>
              ))}
              {evs.length > 3 && <span className="text-[10.5px] text-muted px-1.5">+{evs.length - 3} more</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekGrid({ cursor, today, now, byDate, onNew, onEdit }: { cursor: Date; today: string; now: Date; byDate: Map<string, CalEvent[]>; onNew: (d: string, t: string) => void; onEdit: (e: CalEvent) => void }) {
  const start = addDays(cursor, -cursor.getDay());
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex border-b border-line pl-14">
        {days.map((d) => {
          const k = ymd(d);
          const allDay = (byDate.get(k) ?? []).filter((e) => e.allDay);
          return (
            <div key={k} className="flex-1 px-1.5 py-1.5 border-l border-line min-w-0">
              <div className="flex items-baseline gap-1.5"><span className="text-[11.5px] text-muted">{DOW[d.getDay()]}</span><span className={cx('text-[16px] font-semibold', k === today && 'text-accent')}>{d.getDate()}</span></div>
              {allDay.map((e) => <button key={e.id} onClick={() => onEdit(e)} className="w-full text-left text-[11px] truncate px-1.5 py-0.5 rounded-md text-white mt-0.5" style={{ background: e.color }}>{e.title}</button>)}
            </div>
          );
        })}
      </div>
      <div className="flex-1 overflow-y-auto relative" ref={(el) => { if (el && !el.dataset.scrolled) { el.scrollTop = HOUR_H * 7.5; el.dataset.scrolled = '1'; } }}>
        <div className="flex relative" style={{ height: HOUR_H * 24 }}>
          <div className="w-14 shrink-0">
            {Array.from({ length: 24 }, (_, h) => <div key={h} className="text-[10.5px] text-faint text-right pr-2 -mt-1.5" style={{ height: HOUR_H }}>{h ? `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}` : ''}</div>)}
          </div>
          {days.map((d) => {
            const k = ymd(d);
            const evs = (byDate.get(k) ?? []).filter((e) => !e.allDay && e.start);
            return (
              <div key={k} className="flex-1 border-l border-line relative min-w-0" onDoubleClick={(e) => { const y = e.nativeEvent.offsetY; const h = Math.floor(y / HOUR_H); onNew(k, `${String(h).padStart(2, '0')}:00`); }}>
                {Array.from({ length: 24 }, (_, h) => <div key={h} className="border-b border-line/60 pointer-events-none" style={{ height: HOUR_H }} />)}
                {evs.map((e) => {
                  const s = minutes(e.start), en = Math.max(s + 30, minutes(e.end) || s + 60);
                  return (
                    <button key={e.id} onClick={() => onEdit(e)} className="absolute left-1 right-1 rounded-lg px-2 py-1 text-left overflow-hidden border-l-[3px]" style={{ top: (s / 60) * HOUR_H, height: ((en - s) / 60) * HOUR_H - 2, background: e.color + '2a', borderColor: e.color }}>
                      <div className="text-[11.5px] font-semibold truncate">{e.title}</div>
                      <div className="text-[10.5px] text-muted">{e.start}–{e.end}</div>
                    </button>
                  );
                })}
                {k === today && <div className="absolute left-0 right-0 h-0.5 bg-danger pointer-events-none z-10" style={{ top: (nowMin / 60) * HOUR_H }}><div className="w-2 h-2 rounded-full bg-danger -mt-[3px] -ml-1" /></div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Agenda({ events, today, onEdit }: { events: CalEvent[]; today: string; onEdit: (e: CalEvent) => void }) {
  const upcoming = events.filter((e) => e.date >= today).sort((a, b) => (a.date + (a.start ?? '')).localeCompare(b.date + (b.start ?? '')));
  const groups = new Map<string, CalEvent[]>();
  upcoming.forEach((e) => { if (!groups.has(e.date)) groups.set(e.date, []); groups.get(e.date)!.push(e); });
  if (!upcoming.length) return <div className="flex-1 flex flex-col items-center justify-center text-faint gap-2"><CalendarDays size={28} /><span className="text-[13px]">No upcoming events</span></div>;
  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-[720px] w-full mx-auto space-y-5">
      {[...groups.entries()].map(([d, evs]) => (
        <div key={d}>
          <div className={cx('text-[12.5px] font-semibold mb-2', d === today ? 'text-accent' : 'text-muted')}>{d === today ? 'Today · ' : ''}{parseDate(d).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</div>
          <div className="space-y-1.5">{evs.map((e) => <EventCard key={e.id} e={e} onClick={() => onEdit(e)} />)}</div>
        </div>
      ))}
    </div>
  );
}

function EventEditor({ ev, isNew, onSave, onDelete, onClose }: { ev: CalEvent; isNew: boolean; onSave: (e: CalEvent) => void; onDelete: () => void; onClose: () => void }) {
  const [e, setE] = useState(ev);
  const set = (p: Partial<CalEvent>) => setE((x) => ({ ...x, ...p }));
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/25 animate-fade-in" onMouseDown={(x) => x.target === x.currentTarget && onClose()}>
      <div className="w-[420px] glass rounded-2xl border border-line-strong shadow-2xl p-5 space-y-3 animate-pop" onKeyDown={(k) => { if (k.key === 'Escape') onClose(); if (k.key === 'Enter' && (k.ctrlKey || k.metaKey) && e.title.trim()) onSave(e); }}>
        <div className="flex items-center gap-2">
          <button className="w-4 h-4 rounded-full shrink-0" style={{ background: e.color }} onClick={(x) => openMenu(x, COLORS.map((c) => ({ label: c, checked: c === e.color, onClick: () => set({ color: c }) })))} />
          <Input autoFocus value={e.title} onChange={(x) => set({ title: x.target.value })} placeholder="Event title" className="h-9 text-[15px] font-semibold border-0 bg-transparent px-1 focus:ring-0" />
          <IconButton icon={X} onClick={onClose} />
        </div>
        <div className="flex gap-1.5 pl-6">{COLORS.map((c) => <button key={c} onClick={() => set({ color: c })} className={cx('w-5 h-5 rounded-full', e.color === c && 'ring-2 ring-offset-2 ring-offset-transparent ring-fg/50')} style={{ background: c }} />)}</div>
        <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
          <Input type="date" value={e.date} onChange={(x) => set({ date: x.target.value })} />
          <label className="flex items-center gap-2 text-[12.5px] text-muted">All day <Switch checked={e.allDay} onChange={(v) => set({ allDay: v })} /></label>
        </div>
        {!e.allDay && (
          <div className="grid grid-cols-2 gap-2">
            <Input type="time" value={e.start ?? ''} onChange={(x) => set({ start: x.target.value })} />
            <Input type="time" value={e.end ?? ''} onChange={(x) => set({ end: x.target.value })} />
          </div>
        )}
        <Input icon={MapPin} value={e.location ?? ''} onChange={(x) => set({ location: x.target.value })} placeholder="Location" />
        {!e.allDay && (
          <div className="flex items-center gap-2 text-[12.5px]"><Bell size={14} className="text-muted" />
            <Select value={String(e.remind ?? 'none')} onChange={(v) => set({ remind: v === 'none' ? null : Number(v) })} options={[{ value: 'none', label: 'No reminder' }, { value: '0', label: 'At start time' }, { value: '5', label: '5 minutes before' }, { value: '10', label: '10 minutes before' }, { value: '30', label: '30 minutes before' }, { value: '60', label: '1 hour before' }]} className="flex-1" />
          </div>
        )}
        <Textarea rows={3} value={e.notes ?? ''} onChange={(x) => set({ notes: x.target.value })} placeholder="Notes" />
        <div className="flex justify-between pt-1">
          {!isNew ? <Button variant="ghost" icon={Trash2} className="text-danger" onClick={onDelete}>Delete</Button> : <span />}
          <div className="flex gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!e.title.trim()} onClick={() => onSave({ ...e, title: e.title.trim() })}>{isNew ? 'Add event' : 'Save'}</Button></div>
        </div>
      </div>
    </div>
  );
}
