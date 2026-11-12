import { useMemo, useState } from 'react';
import { Plus, SquareKanban, List, Flag, CalendarDays, Trash2, Check, X, Inbox, Sun, Hash, Search, CheckCircle2, Circle } from 'lucide-react';
import type { AppProps } from '../kernel/registry';
import { useAppData } from '../kernel/appdata';
import { randomId } from '../kernel/crypto';
import { ymd } from '../kernel/scheduler';
import { dialog } from '../kernel/dialog';
import { Button, IconButton, Input, Textarea, SidebarItem, SectionLabel, Segmented, Select, cx, openMenu } from '../ui';

type Status = 'todo' | 'doing' | 'done';
type Priority = 'low' | 'med' | 'high';
interface Sub { id: string; title: string; done: boolean }
interface Task { id: string; title: string; notes?: string; status: Status; priority: Priority; due?: string; board: string; created: number; subtasks?: Sub[]; completedAt?: number }
interface Board { id: string; name: string; color: string }
interface Data { tasks: Task[]; boards: Board[] }

const DEFAULT: Data = {
  boards: [{ id: 'personal', name: 'Personal', color: '#0ea5e9' }, { id: 'work', name: 'Work', color: '#a855f7' }],
  tasks: [
    { id: 't1', title: 'Explore AetherOS', status: 'doing', priority: 'med', board: 'personal', created: Date.now(), subtasks: [{ id: 's1', title: 'Open Spotlight with Ctrl K', done: false }, { id: 's2', title: 'Try the Terminal', done: false }, { id: 's3', title: 'Check your privacy score in Shield', done: false }] },
    { id: 't2', title: 'Move passwords into Keychain', status: 'todo', priority: 'high', board: 'personal', created: Date.now() },
    { id: 't3', title: 'Set a passphrase', status: 'todo', priority: 'high', board: 'personal', created: Date.now(), notes: 'Settings → Privacy & Security' },
  ],
};
const COLS: { id: Status; label: string; color: string }[] = [
  { id: 'todo', label: 'To do', color: '#94a3b8' },
  { id: 'doing', label: 'In progress', color: '#0ea5e9' },
  { id: 'done', label: 'Done', color: '#22c55e' },
];
const PRI: Record<Priority, { label: string; color: string }> = { high: { label: 'High', color: '#ef4444' }, med: { label: 'Medium', color: '#f59e0b' }, low: { label: 'Low', color: '#94a3b8' } };

export default function Tasks(_p: AppProps) {
  const [data, setData] = useAppData<Data>('tasks', DEFAULT);
  const boards = data.boards ?? DEFAULT.boards;
  const [filter, setFilter] = useState<string>('all');
  const [view, setView] = useState<'board' | 'list'>('board');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<Status | null>(null);
  const today = ymd(new Date());

  const tasks = useMemo(() => {
    let t = data.tasks;
    if (filter === 'today') t = t.filter((x) => x.due && x.due <= today && x.status !== 'done');
    else if (filter !== 'all') t = t.filter((x) => x.board === filter);
    if (q.trim()) t = t.filter((x) => x.title.toLowerCase().includes(q.toLowerCase()) || x.notes?.toLowerCase().includes(q.toLowerCase()));
    return t;
  }, [data.tasks, filter, q, today]);

  const update = (id: string, p: Partial<Task>) => setData((d) => ({ ...d, boards, tasks: d.tasks.map((t) => (t.id === id ? { ...t, ...p, ...(p.status === 'done' && t.status !== 'done' ? { completedAt: Date.now() } : {}) } : t)) }));
  const add = (status: Status = 'todo', title = 'New task') => {
    const t: Task = { id: randomId(8), title, status, priority: 'med', board: filter !== 'all' && filter !== 'today' ? filter : boards[0].id, created: Date.now(), due: filter === 'today' ? today : undefined };
    setData((d) => ({ ...d, boards, tasks: [...d.tasks, t] }));
    setOpen(t.id);
  };
  const remove = (id: string) => { setData((d) => ({ ...d, boards, tasks: d.tasks.filter((t) => t.id !== id) })); setOpen(null); };

  const addBoard = async () => {
    const name = await dialog.prompt({ title: 'New board', placeholder: 'e.g. Side project', confirmLabel: 'Create' });
    if (!name?.trim()) return;
    const b = { id: randomId(6), name: name.trim(), color: ['#22c55e', '#f97316', '#ec4899', '#14b8a6', '#6366f1'][boards.length % 5] };
    setData((d) => ({ ...d, boards: [...boards, b] }));
    setFilter(b.id);
  };

  const current = data.tasks.find((t) => t.id === open);
  const boardOf = (id: string) => boards.find((b) => b.id === id);

  const Card = ({ t }: { t: Task }) => {
    const subs = t.subtasks ?? [];
    const overdue = t.due && t.due < today && t.status !== 'done';
    return (
      <div
        draggable
        onDragStart={(e) => { setDragId(t.id); e.dataTransfer.effectAllowed = 'move'; }}
        onDragEnd={() => { setDragId(null); setOverCol(null); }}
        onClick={() => setOpen(t.id)}
        onContextMenu={(e) => openMenu(e, [...COLS.map((c) => ({ label: `Move to ${c.label}`, checked: t.status === c.id, onClick: () => update(t.id, { status: c.id }) })), { separator: true }, { label: 'Delete', icon: Trash2, danger: true, onClick: () => remove(t.id) }])}
        className={cx('rounded-xl bg-elevated border border-line p-3 shadow-sm cursor-grab active:cursor-grabbing hover:border-line-strong transition-all', dragId === t.id && 'opacity-40', open === t.id && 'ring-2 ring-accent')}
      >
        <div className="flex items-start gap-2">
          <button onClick={(e) => { e.stopPropagation(); update(t.id, { status: t.status === 'done' ? 'todo' : 'done' }); }} className="mt-0.5 shrink-0 text-muted hover:text-success">
            {t.status === 'done' ? <CheckCircle2 size={16} className="text-success" /> : <Circle size={16} />}
          </button>
          <div className={cx('text-[13px] font-medium flex-1 leading-snug', t.status === 'done' && 'line-through text-muted')}>{t.title}</div>
        </div>
        <div className="flex items-center gap-2 mt-2.5 flex-wrap text-[11px]">
          <span className="flex items-center gap-1" style={{ color: PRI[t.priority].color }}><Flag size={11} />{PRI[t.priority].label}</span>
          {t.due && <span className={cx('flex items-center gap-1', overdue ? 'text-danger font-medium' : 'text-muted')}><CalendarDays size={11} />{t.due === today ? 'Today' : new Date(t.due + 'T00:00').toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>}
          {subs.length > 0 && <span className="text-muted flex items-center gap-1"><Check size={11} />{subs.filter((s) => s.done).length}/{subs.length}</span>}
          {filter === 'all' && boardOf(t.board) && <span className="ml-auto px-1.5 py-0.5 rounded-md font-medium" style={{ background: boardOf(t.board)!.color + '22', color: boardOf(t.board)!.color }}>{boardOf(t.board)!.name}</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex">
      <div className="w-[190px] shrink-0 border-r border-line bg-hover/40 px-2 pb-2 overflow-y-auto">
        <SectionLabel>Views</SectionLabel>
        <SidebarItem icon={Inbox} label="All tasks" count={data.tasks.filter((t) => t.status !== 'done').length} active={filter === 'all'} onClick={() => setFilter('all')} />
        <SidebarItem icon={Sun} label="Due today" count={data.tasks.filter((t) => t.due && t.due <= today && t.status !== 'done').length} active={filter === 'today'} onClick={() => setFilter('today')} color="#f59e0b" />
        <SectionLabel action={<IconButton icon={Plus} size={13} className="w-6 h-6" onClick={addBoard} label="New board" />}>Boards</SectionLabel>
        {boards.map((b) => (
          <SidebarItem key={b.id} icon={Hash} label={b.name} color={b.color} count={data.tasks.filter((t) => t.board === b.id && t.status !== 'done').length} active={filter === b.id} onClick={() => setFilter(b.id)}
            onContextMenu={(e) => openMenu(e, [{ label: 'Delete board', danger: true, icon: Trash2, disabled: boards.length < 2, onClick: async () => { if (await dialog.confirm({ title: `Delete “${b.name}” and its tasks?`, danger: true, confirmLabel: 'Delete' })) { setData((d) => ({ boards: boards.filter((x) => x.id !== b.id), tasks: d.tasks.filter((t) => t.board !== b.id) })); setFilter('all'); } } }])} />
        ))}
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-12 shrink-0 flex items-center gap-2 px-3 border-b border-line">
          <div className="text-[16px] font-semibold flex-1 truncate">{filter === 'all' ? 'All tasks' : filter === 'today' ? 'Due today' : boardOf(filter)?.name}</div>
          <div className="w-52"><Input icon={Search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter tasks" className="h-7" /></div>
          <Segmented size="sm" value={view} onChange={setView} options={[{ value: 'board', label: '', icon: SquareKanban }, { value: 'list', label: '', icon: List }]} />
          <Button size="sm" variant="primary" icon={Plus} onClick={() => add()}>Task</Button>
        </div>
        <div className="flex-1 flex min-h-0">
          {view === 'board' ? (
            <div className="flex-1 flex gap-3 p-3 overflow-x-auto">
              {COLS.map((c) => {
                const list = tasks.filter((t) => t.status === c.id).sort((a, b) => ({ high: 0, med: 1, low: 2 })[a.priority] - ({ high: 0, med: 1, low: 2 })[b.priority]);
                return (
                  <div key={c.id}
                    onDragOver={(e) => { e.preventDefault(); setOverCol(c.id); }}
                    onDragLeave={() => setOverCol((x) => (x === c.id ? null : x))}
                    onDrop={() => { if (dragId) update(dragId, { status: c.id }); setDragId(null); setOverCol(null); }}
                    className={cx('w-[290px] shrink-0 flex flex-col rounded-2xl bg-hover/60 border border-line transition-colors', overCol === c.id && 'border-accent bg-accent/8')}>
                    <div className="flex items-center gap-2 px-3 h-11">
                      <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                      <span className="text-[13px] font-semibold">{c.label}</span>
                      <span className="text-[12px] text-faint">{list.length}</span>
                      <span className="flex-1" />
                      <IconButton icon={Plus} size={14} className="w-7 h-7" onClick={() => add(c.id)} />
                    </div>
                    <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
                      {list.map((t) => <Card key={t.id} t={t} />)}
                      {!list.length && <div className="text-center text-[12px] text-faint py-6 border-2 border-dashed border-line rounded-xl">Drop tasks here</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 max-w-[760px] mx-auto w-full space-y-1">
              {[...tasks].sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || (a.due ?? '9').localeCompare(b.due ?? '9')).map((t) => (
                <div key={t.id} onClick={() => setOpen(t.id)} className={cx('flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-hover cursor-default', open === t.id && 'bg-accent/10')}>
                  <button onClick={(e) => { e.stopPropagation(); update(t.id, { status: t.status === 'done' ? 'todo' : 'done' }); }}>
                    {t.status === 'done' ? <CheckCircle2 size={18} className="text-success" /> : <Circle size={18} className="text-muted" style={{ color: PRI[t.priority].color }} />}
                  </button>
                  <span className={cx('flex-1 text-[13.5px] truncate', t.status === 'done' && 'line-through text-muted')}>{t.title}</span>
                  {t.status === 'doing' && <span className="text-[11px] text-sky-500 font-medium">In progress</span>}
                  {t.due && <span className={cx('text-[12px]', t.due < today && t.status !== 'done' ? 'text-danger' : 'text-muted')}>{t.due === today ? 'Today' : new Date(t.due + 'T00:00').toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>}
                </div>
              ))}
              {!tasks.length && <div className="text-center text-faint text-[13px] py-16">Nothing to do. Enjoy it ✨</div>}
            </div>
          )}
          {current && (
            <div className="w-[320px] shrink-0 border-l border-line flex flex-col animate-fade-in">
              <div className="h-12 flex items-center px-3 border-b border-line gap-1">
                <span className="text-[12px] text-muted flex-1">Task details</span>
                <IconButton icon={Trash2} label="Delete" onClick={() => remove(current.id)} />
                <IconButton icon={X} onClick={() => setOpen(null)} />
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <Textarea rows={2} value={current.title} onChange={(e) => update(current.id, { title: e.target.value })} className="text-[15px] font-semibold" autoFocus={current.title === 'New task'} onFocus={(e) => current.title === 'New task' && e.target.select()} />
                <div className="grid grid-cols-[80px_1fr] gap-y-2.5 items-center text-[12.5px]">
                  <span className="text-muted">Status</span><Segmented size="sm" value={current.status} onChange={(v) => update(current.id, { status: v })} options={COLS.map((c) => ({ value: c.id, label: c.label }))} />
                  <span className="text-muted">Priority</span><Segmented size="sm" value={current.priority} onChange={(v) => update(current.id, { priority: v })} options={(['low', 'med', 'high'] as Priority[]).map((p) => ({ value: p, label: PRI[p].label }))} />
                  <span className="text-muted">Due</span>
                  <div className="flex gap-1"><Input type="date" value={current.due ?? ''} onChange={(e) => update(current.id, { due: e.target.value || undefined })} className="h-7" />{current.due && <IconButton icon={X} size={13} className="w-7 h-7" onClick={() => update(current.id, { due: undefined })} />}</div>
                  <span className="text-muted">Board</span><Select value={current.board} onChange={(v) => update(current.id, { board: v })} options={boards.map((b) => ({ value: b.id, label: b.name }))} />
                </div>
                <div>
                  <div className="text-[12px] text-muted mb-1.5">Checklist</div>
                  {(current.subtasks ?? []).map((s) => (
                    <div key={s.id} className="flex items-center gap-2 group py-0.5">
                      <button onClick={() => update(current.id, { subtasks: current.subtasks!.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)) })}>{s.done ? <CheckCircle2 size={15} className="text-success" /> : <Circle size={15} className="text-muted" />}</button>
                      <input value={s.title} onChange={(e) => update(current.id, { subtasks: current.subtasks!.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)) })} className={cx('flex-1 bg-transparent outline-none text-[13px]', s.done && 'line-through text-muted')} />
                      <button onClick={() => update(current.id, { subtasks: current.subtasks!.filter((x) => x.id !== s.id) })} className="opacity-0 group-hover:opacity-100 text-muted"><X size={13} /></button>
                    </div>
                  ))}
                  <button onClick={() => update(current.id, { subtasks: [...(current.subtasks ?? []), { id: randomId(6), title: '', done: false }] })} className="text-[12.5px] text-accent flex items-center gap-1 mt-1"><Plus size={13} /> Add item</button>
                </div>
                <div>
                  <div className="text-[12px] text-muted mb-1.5">Notes</div>
                  <Textarea rows={6} value={current.notes ?? ''} onChange={(e) => update(current.id, { notes: e.target.value })} placeholder="Add details…" />
                </div>
                <div className="text-[11px] text-faint">Created {new Date(current.created).toLocaleString()}{current.completedAt ? ` · completed ${new Date(current.completedAt).toLocaleString()}` : ''}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
