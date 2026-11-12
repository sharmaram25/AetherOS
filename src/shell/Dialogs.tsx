import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle, ChevronLeft, ChevronRight, Folder, FolderPlus, Home, Monitor, FileText, Image, Music, Video, Download, NotebookPen,
  ShieldQuestion, Camera, Mic, Bell, Clipboard, FolderLock, MapPin, Code2, File,
} from 'lucide-react';
import { useDialogs, type Dialog, type PickOpts } from '../kernel/dialog';
import { vfs, useVfs, type FsNode } from '../kernel/vfs';
import { getApp } from '../kernel/registry';
import { Button, Input, AppGlyph, cx } from '../ui';
import { HOME, join, dirname, extname, prettyPath, validName, resolve, stem } from '../lib/path';
import { kindOf } from '../lib/mime';

export function Dialogs() {
  const stack = useDialogs((s) => s.stack);
  return (
    <AnimatePresence>
      {stack.map((d, i) => (
        <motion.div
          key={d.id}
          className="fixed inset-0 flex items-center justify-center"
          style={{ zIndex: 9500 + i }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
        >
          <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" />
          <motion.div initial={{ scale: 0.95, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97 }} transition={{ type: 'spring', stiffness: 500, damping: 36 }} className="relative">
            <DialogBody d={d} />
          </motion.div>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}

function Shell({ children, width = 420 }: { children: React.ReactNode; width?: number }) {
  return <div className="glass rounded-2xl border border-line-strong shadow-[0_30px_80px_-12px_rgba(0,0,0,0.55)] overflow-hidden" style={{ width }}>{children}</div>;
}

function DialogBody({ d }: { d: Dialog }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); d.resolve(d.kind === 'confirm' ? false : d.kind === 'permission' ? 'deny' : null); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [d]);

  if (d.kind === 'confirm' || d.kind === 'alert') return <Confirm d={d} />;
  if (d.kind === 'prompt') return <Prompt d={d} />;
  if (d.kind === 'permission') return <Permission d={d} />;
  return <Picker opts={d.opts} onDone={d.resolve} />;
}

function Confirm({ d }: { d: Extract<Dialog, { kind: 'confirm' | 'alert' }> }) {
  const o = d.opts;
  const [typed, setTyped] = useState('');
  const ok = !o.requireText || typed === o.requireText;
  return (
    <Shell>
      <div className="p-6">
        <div className="flex gap-4">
          {o.danger && <div className="w-10 h-10 rounded-xl bg-danger/15 text-danger flex items-center justify-center shrink-0"><AlertTriangle size={20} /></div>}
          <div className="min-w-0">
            <div className="text-[15px] font-semibold">{o.title}</div>
            {o.message && <div className="text-[13px] text-muted mt-1.5 whitespace-pre-line leading-relaxed">{o.message}</div>}
          </div>
        </div>
        {o.requireText && (
          <div className="mt-4">
            <div className="text-[12px] text-muted mb-1.5">Type <b className="text-fg font-mono">{o.requireText}</b> to confirm</div>
            <Input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ok && d.resolve(true)} />
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 px-6 pb-5">
        {d.kind === 'confirm' && <Button onClick={() => d.resolve(false)}>{o.cancelLabel ?? 'Cancel'}</Button>}
        <Button autoFocus={!o.requireText} variant={o.danger ? 'danger' : 'primary'} disabled={!ok} onClick={() => d.resolve(d.kind === 'confirm' ? true : undefined)}>{o.confirmLabel ?? 'OK'}</Button>
      </div>
    </Shell>
  );
}

function Prompt({ d }: { d: Extract<Dialog, { kind: 'prompt' }> }) {
  const o = d.opts;
  const [v, setV] = useState(o.value ?? '');
  const ref = useRef<HTMLInputElement>(null);
  const err = o.validate?.(v) ?? null;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    if (o.selectStem && o.value) el.setSelectionRange(0, stem(o.value).length);
    else el.select();
  }, [o.selectStem, o.value]);
  const submit = () => { if (!err) d.resolve(v); };
  return (
    <Shell>
      <div className="p-6">
        <div className="text-[15px] font-semibold">{o.title}</div>
        {o.message && <div className="text-[13px] text-muted mt-1.5 whitespace-pre-line">{o.message}</div>}
        {o.label && <div className="text-[12px] text-muted mt-4 mb-1.5">{o.label}</div>}
        <Input ref={ref} type={o.password ? 'password' : 'text'} value={v} placeholder={o.placeholder} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} className={cx('h-9', !o.label && 'mt-4', err && v && 'border-danger')} />
        <div className="h-4 mt-1 text-[11.5px] text-danger">{v && err}</div>
      </div>
      <div className="flex justify-end gap-2 px-6 pb-5">
        <Button onClick={() => d.resolve(null)}>Cancel</Button>
        <Button variant="primary" disabled={!!err} onClick={submit}>{o.confirmLabel ?? 'OK'}</Button>
      </div>
    </Shell>
  );
}

const PERM_ICON: Record<string, typeof Camera> = { Camera, Microphone: Mic, Notifications: Bell, Clipboard, 'Your files': FolderLock, Location: MapPin };

function Permission({ d }: { d: Extract<Dialog, { kind: 'permission' }> }) {
  const o = d.opts;
  const app = getApp(o.appId);
  const Icon = PERM_ICON[o.perm] ?? ShieldQuestion;
  return (
    <Shell width={380}>
      <div className="p-6 text-center">
        <div className="flex items-center justify-center gap-3">
          {app && <AppGlyph app={app} size={48} />}
          <div className="w-12 h-12 rounded-2xl bg-accent/15 text-accent flex items-center justify-center"><Icon size={22} /></div>
        </div>
        <div className="mt-4 text-[15px] font-semibold">“{o.appName}” wants access to {o.perm.toLowerCase()}</div>
        <div className="text-[12.5px] text-muted mt-1.5">{o.reason ?? 'You can change this anytime in Shield → Permissions.'}</div>
      </div>
      <div className="flex flex-col gap-1.5 px-5 pb-5">
        <Button variant="primary" size="lg" onClick={() => d.resolve('once')} autoFocus>Allow this time</Button>
        <Button size="lg" onClick={() => d.resolve('always')}>Always allow</Button>
        <Button variant="ghost" size="lg" onClick={() => d.resolve('deny')}>Don't allow</Button>
      </div>
    </Shell>
  );
}

/* ---------- File picker ---------- */
const PLACES = [
  { label: 'Home', path: HOME, icon: Home },
  { label: 'Desktop', path: `${HOME}/Desktop`, icon: Monitor },
  { label: 'Documents', path: `${HOME}/Documents`, icon: FileText },
  { label: 'Downloads', path: `${HOME}/Downloads`, icon: Download },
  { label: 'Notes', path: `${HOME}/Notes`, icon: NotebookPen },
  { label: 'Projects', path: `${HOME}/Projects`, icon: Code2 },
  { label: 'Pictures', path: `${HOME}/Pictures`, icon: Image },
  { label: 'Music', path: `${HOME}/Music`, icon: Music },
  { label: 'Videos', path: `${HOME}/Videos`, icon: Video },
];

export function Picker({ opts, onDone }: { opts: PickOpts; onDone: (v: any) => void }) {
  const nodes = useVfs((s) => s.nodes);
  const start = opts.startDir ? resolve(HOME, opts.startDir) : HOME;
  const [dir, setDir] = useState(vfs.isDir(start) ? start : HOME);
  const [hist, setHist] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState(opts.defaultName ?? '');
  const nameRef = useRef<HTMLInputElement>(null);

  const items = useMemo(() => vfs.list(dir, nodes).filter((n) => !n.name.startsWith('.')), [dir, nodes]);
  const allowed = (n: FsNode) => n.kind === 'dir' || opts.mode !== 'open' || !opts.extensions?.length || opts.extensions.includes(extname(n.name));

  useEffect(() => {
    if (opts.mode === 'save' && nameRef.current) {
      nameRef.current.focus();
      nameRef.current.setSelectionRange(0, stem(name).length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = (p: string) => { setHist((h) => [...h, dir]); setDir(p); setSelected([]); };
  const back = () => { const h = [...hist]; const p = h.pop(); if (p) { setHist(h); setDir(p); } };

  const confirm = async () => {
    if (opts.mode === 'folder') return onDone(selected[0] && vfs.isDir(selected[0]) ? selected[0] : dir);
    if (opts.mode === 'open') {
      const files = selected.filter((p) => !vfs.isDir(p));
      if (!files.length) return;
      return onDone(opts.multiple ? files : files[0]);
    }
    let n = name.trim();
    if (validName(n)) return;
    if (opts.extensions?.length && !opts.extensions.includes(extname(n))) n += '.' + opts.extensions[0];
    const target = join(dir, n);
    if (vfs.exists(target)) {
      if (vfs.isDir(target)) { go(target); return; }
      if (!window.confirm(`“${n}” already exists. Replace it?`)) return;
    }
    onDone(target);
  };

  const newFolder = async () => {
    const p = vfs.uniquePath(dir, 'New Folder');
    await vfs.mkdir(p);
    setSelected([p]);
  };

  const crumbs = dir.split('/').filter(Boolean);
  const canConfirm = opts.mode === 'save' ? !validName(name.trim()) : opts.mode === 'folder' ? true : selected.some((p) => !vfs.isDir(p));

  return (
    <Shell width={760}>
      <div className="flex h-[460px]">
        <div className="w-44 shrink-0 border-r border-line p-2 space-y-0.5 bg-hover/50">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-faint px-2.5 pt-1 pb-2">Places</div>
          {PLACES.filter((p) => vfs.exists(p.path)).map((p) => (
            <button key={p.path} onClick={() => go(p.path)} className={cx('w-full flex items-center gap-2.5 h-[30px] px-2.5 rounded-lg text-[13px]', dir === p.path ? 'bg-accent/15 text-fg font-medium' : 'text-muted hover:bg-hover hover:text-fg')}>
              <p.icon size={15} className={dir === p.path ? 'text-accent' : ''} /> {p.label}
            </button>
          ))}
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <div className="h-12 flex items-center gap-1.5 px-3 border-b border-line">
            <button onClick={back} disabled={!hist.length} className="w-7 h-7 rounded-lg hover:bg-hover disabled:opacity-30 flex items-center justify-center"><ChevronLeft size={16} /></button>
            <div className="flex-1 flex items-center gap-0.5 text-[13px] min-w-0 overflow-hidden">
              {crumbs.map((c, i) => {
                const p = '/' + crumbs.slice(0, i + 1).join('/');
                return (
                  <span key={p} className="flex items-center gap-0.5 shrink-0">
                    {i > 0 && <ChevronRight size={13} className="text-faint" />}
                    <button onClick={() => go(p)} className={cx('px-1.5 py-0.5 rounded-md hover:bg-hover', i === crumbs.length - 1 ? 'font-semibold' : 'text-muted')}>{p === HOME ? 'Home' : c}</button>
                  </span>
                );
              })}
            </div>
            <button onClick={newFolder} title="New folder" className="w-7 h-7 rounded-lg hover:bg-hover flex items-center justify-center text-muted"><FolderPlus size={15} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5">
            {items.length === 0 && <div className="h-full flex items-center justify-center text-[12.5px] text-faint">This folder is empty</div>}
            {items.map((n) => {
              const ok = allowed(n);
              const sel = selected.includes(n.path);
              const K = n.kind === 'dir' ? Folder : kindOf(n.path) === 'image' ? Image : kindOf(n.path) === 'audio' ? Music : kindOf(n.path) === 'video' ? Video : kindOf(n.path) === 'code' ? Code2 : kindOf(n.path) === 'markdown' || kindOf(n.path) === 'text' ? FileText : File;
              return (
                <button
                  key={n.path}
                  disabled={!ok || (opts.mode === 'folder' && n.kind !== 'dir')}
                  onClick={(e) => {
                    if (opts.multiple && (e.ctrlKey || e.metaKey)) setSelected((s) => (s.includes(n.path) ? s.filter((x) => x !== n.path) : [...s, n.path]));
                    else setSelected([n.path]);
                    if (opts.mode === 'save' && n.kind === 'file') setName(n.name);
                  }}
                  onDoubleClick={() => (n.kind === 'dir' ? go(n.path) : opts.mode === 'open' ? onDone(opts.multiple ? [n.path] : n.path) : confirm())}
                  className={cx('w-full flex items-center gap-2.5 h-8 px-2.5 rounded-lg text-[13px] text-left disabled:opacity-35', sel ? 'bg-accent text-accent-fg' : 'hover:bg-hover')}
                >
                  <K size={15} className={sel ? '' : n.kind === 'dir' ? 'text-sky-500' : 'text-muted'} />
                  <span className="flex-1 truncate">{n.name}</span>
                  {n.kind === 'dir' && <ChevronRight size={13} className="opacity-50" />}
                </button>
              );
            })}
          </div>
          <div className="border-t border-line p-3 flex items-center gap-2">
            {opts.mode === 'save' ? (
              <Input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && confirm()} placeholder="File name" className="flex-1" />
            ) : (
              <div className="flex-1 text-[12px] text-muted truncate">{opts.title ?? (opts.mode === 'folder' ? `Choose a folder · ${prettyPath(selected[0] ?? dir)}` : selected.length ? selected.map((s) => s.split('/').pop()).join(', ') : opts.extensions?.length ? `Supported: ${opts.extensions.join(', ')}` : 'Select a file')}</div>
            )}
            <Button onClick={() => onDone(null)}>Cancel</Button>
            <Button variant="primary" disabled={!canConfirm} onClick={confirm}>{opts.mode === 'save' ? 'Save' : opts.mode === 'folder' ? 'Choose' : 'Open'}</Button>
          </div>
        </div>
      </div>
    </Shell>
  );
}

export { dirname };
