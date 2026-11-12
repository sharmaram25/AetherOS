import { useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  FolderPlus, FilePlus, NotebookPen, Image, Settings, SquareTerminal, ArrowDownAZ, ExternalLink, Pencil, Trash2, Copy, Download,
  ShieldCheck, Upload, Eye, Star, Info,
} from 'lucide-react';
import { TopBar } from './TopBar';
import { Dock, DRAG_MIME } from './Dock';
import { WindowLayer } from './WindowLayer';
import { Spotlight } from './Spotlight';
import { Launchpad, Switcher, ShortcutsHelp, About } from './Overlays';
import { NotificationCenter } from './NotificationCenter';
import { Widgets } from './Widgets';
import { useShortcuts, useAutoLock, usePrivacyShield } from './hooks';
import { useShell } from './store';
import { useSettings } from '../kernel/settings';
import { useVfs, vfs, type FsNode } from '../kernel/vfs';
import { wm, TOPBAR_H } from '../kernel/windows';
import { dialog } from '../kernel/dialog';
import { openPath, importHostFiles, exportToHost, pickHostFiles } from '../kernel/launcher';
import { toast } from '../kernel/notify';
import { HOME, validName, dirname, join } from '../lib/path';
import { FileIcon } from './FileIcon';
import { cx, openMenu, type MenuItem } from '../ui';
import { newNote } from './commands';

const DESK = `${HOME}/Desktop`;
const CELL_W = 92, CELL_H = 96;

export function Desktop() {
  useShortcuts();
  useAutoLock();
  usePrivacyShield();
  const panel = useShell((s) => s.panel);
  const night = useShell((s) => s.nightLight);
  const shielded = useShell((s) => s.shielded);

  return (
    <div className={cx('absolute inset-0', shielded && 'privacy-blur')}>
      <DesktopSurface />
      <WindowLayer />
      <Dock />
      <TopBar />
      <AnimatePresence>
        {panel === 'spotlight' && <Spotlight key="sp" />}
        {panel === 'launchpad' && <Launchpad key="lp" />}
        {panel === 'center' && <NotificationCenter key="nc" />}
        {panel === 'shortcuts' && <ShortcutsHelp key="sh" />}
        {panel === 'about' && <About key="ab" />}
      </AnimatePresence>
      <Switcher />
      {shielded && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center pointer-events-none">
          <div className="glass rounded-2xl border border-line-strong px-5 py-3 flex items-center gap-2.5 text-[13px] font-medium shadow-2xl"><Eye size={16} className="text-accent" /> Privacy shield active — click to reveal</div>
        </div>
      )}
      {night > 0 && <div className="fixed inset-0 pointer-events-none z-[99990] mix-blend-multiply" style={{ background: `rgba(255, 140, 40, ${night / 300})` }} />}
    </div>
  );
}

function DesktopSurface() {
  const nodes = useVfs((s) => s.nodes);
  const { showDesktopIcons, showWidgets } = useSettings();
  const [selected, setSelected] = useState<string[]>([]);
  const [band, setBand] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [dropping, setDropping] = useState(false);
  const surfaceRef = useRef<HTMLDivElement>(null);

  const items = useMemo(() => vfs.list(DESK, nodes).filter((n) => !n.name.startsWith('.')), [nodes]);
  const rows = Math.max(1, Math.floor((window.innerHeight - TOPBAR_H - 110) / CELL_H));
  const pos = (i: number) => ({ x: 14 + Math.floor(i / rows) * CELL_W, y: TOPBAR_H + 14 + (i % rows) * CELL_H });

  const surfaceMenu = (e: React.MouseEvent) => {
    const items: MenuItem[] = [
      { label: 'New folder', icon: FolderPlus, onClick: async () => { const p = vfs.uniquePath(DESK, 'New Folder'); await vfs.mkdir(p); setSelected([p]); } },
      { label: 'New text file', icon: FilePlus, onClick: async () => { const p = vfs.uniquePath(DESK, 'Untitled.txt'); await vfs.writeText(p, ''); wm.open('code', { path: p }); } },
      { label: 'New note', icon: NotebookPen, onClick: newNote },
      { label: 'Import files…', icon: Upload, onClick: async () => { const f = await pickHostFiles(); if (f.length) await importHostFiles(f, DESK); } },
      { separator: true },
      { label: 'Open Terminal here', icon: SquareTerminal, onClick: () => { wm.open('terminal', { cwd: DESK }, { newWindow: true }); } },
      { label: 'Sort by name', icon: ArrowDownAZ, disabled: true },
      { separator: true },
      { label: 'Change wallpaper…', icon: Image, onClick: () => { wm.open('settings', { page: 'appearance' }); } },
      { label: 'Privacy center', icon: ShieldCheck, onClick: () => { wm.open('shield'); } },
      { label: 'Settings', icon: Settings, onClick: () => { wm.open('settings', { page: 'desktop' }); } },
    ];
    openMenu(e, items);
  };

  const itemMenu = (e: React.MouseEvent, n: FsNode) => {
    e.stopPropagation();
    const sel = selected.includes(n.path) ? selected : [n.path];
    if (!selected.includes(n.path)) setSelected([n.path]);
    openMenu(e, [
      { label: 'Open', icon: ExternalLink, onClick: () => sel.forEach((p) => void openPath(p)) },
      { label: 'Rename…', icon: Pencil, disabled: sel.length > 1, onClick: () => rename(n) },
      { label: 'Duplicate', icon: Copy, onClick: async () => { for (const p of sel) await vfs.copy(p, vfs.uniquePath(dirname(p), p.split('/').pop()!)); } },
      { label: n.starred ? 'Remove from favorites' : 'Add to favorites', icon: Star, onClick: () => vfs.setStarred(n.path, !n.starred) },
      ...(n.kind === 'file' ? [{ label: 'Export to computer', icon: Download, onClick: () => void exportToHost(n.path) }] : []),
      { label: 'Show in Files', icon: Info, onClick: () => { wm.open('files', { path: DESK, select: n.path }); } },
      { separator: true },
      { label: 'Move to Trash', icon: Trash2, danger: true, shortcut: 'Del', onClick: () => void vfs.trash(sel) },
    ]);
  };

  const rename = async (n: FsNode) => {
    const name = await dialog.prompt({ title: 'Rename', value: n.name, selectStem: n.kind === 'file', confirmLabel: 'Rename', validate: (v) => validName(v) ?? (v !== n.name && vfs.exists(join(DESK, v)) ? 'An item with that name exists' : null) });
    if (name && name !== n.name) await vfs.rename(n.path, name);
  };

  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || e.target !== surfaceRef.current) return;
    setSelected([]);
    const sx = e.clientX, sy = e.clientY;
    const move = (ev: PointerEvent) => {
      const b = { x: Math.min(sx, ev.clientX), y: Math.min(sy, ev.clientY), w: Math.abs(ev.clientX - sx), h: Math.abs(ev.clientY - sy) };
      setBand(b);
      setSelected(items.filter((_, i) => {
        const p = pos(i);
        return p.x < b.x + b.w && p.x + CELL_W - 8 > b.x && p.y < b.y + b.h && p.y + CELL_H - 8 > b.y;
      }).map((n) => n.path));
    };
    const up = () => { setBand(null); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDropping(false);
    const internal = e.dataTransfer.getData(DRAG_MIME);
    if (internal) {
      const paths = JSON.parse(internal) as string[];
      for (const p of paths) if (dirname(p) !== DESK) await vfs.move(p, vfs.uniquePath(DESK, p.split('/').pop()!)).catch((err) => toast(err.message, 'error'));
      return;
    }
    if (e.dataTransfer.files.length) await importHostFiles(e.dataTransfer.files, DESK);
  };

  return (
    <div
      ref={surfaceRef}
      className="absolute inset-0 z-0"
      onPointerDown={onDown}
      onContextMenu={(e) => e.target === surfaceRef.current && surfaceMenu(e)}
      onDragOver={(e) => { e.preventDefault(); if (!dropping) setDropping(true); }}
      onDragLeave={(e) => { if (e.target === surfaceRef.current) setDropping(false); }}
      onDrop={onDrop}
      tabIndex={-1}
      onKeyDown={(e) => {
        if ((e.key === 'Delete' || e.key === 'Backspace') && selected.length) void vfs.trash(selected);
        if (e.key === 'Enter' && selected.length) selected.forEach((p) => void openPath(p));
        if ((e.ctrlKey || e.metaKey) && e.key === 'a') { e.preventDefault(); setSelected(items.map((i) => i.path)); }
      }}
    >
      {showDesktopIcons && items.map((n, i) => {
        const p = pos(i);
        const sel = selected.includes(n.path);
        return (
          <button
            key={n.path}
            draggable
            onDragStart={(e) => {
              const paths = sel ? selected : [n.path];
              e.dataTransfer.setData(DRAG_MIME, JSON.stringify(paths));
              e.dataTransfer.effectAllowed = 'move';
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              (e.currentTarget.parentElement as HTMLElement).focus();
              if (e.ctrlKey || e.metaKey) setSelected((s) => (s.includes(n.path) ? s.filter((x) => x !== n.path) : [...s, n.path]));
              else if (!sel) setSelected([n.path]);
            }}
            onDoubleClick={() => void openPath(n.path)}
            onContextMenu={(e) => itemMenu(e, n)}
            className="absolute flex flex-col items-center gap-1 p-1.5 rounded-xl outline-none"
            style={{ left: p.x, top: p.y, width: CELL_W - 8 }}
          >
            <div className={cx('rounded-xl p-1.5 transition-colors', sel && 'bg-white/20')}>
              <FileIcon node={n} size={52} />
            </div>
            <span className={cx('text-[11.5px] leading-tight text-center px-1.5 py-0.5 rounded-md line-clamp-2 break-all max-w-full text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.8)]', sel && 'bg-accent [text-shadow:none] text-accent-fg')}>{n.name}</span>
          </button>
        );
      })}
      {band && <div className="fixed border border-accent/70 bg-accent/15 rounded-sm pointer-events-none" style={{ left: band.x, top: band.y, width: band.w, height: band.h }} />}
      {dropping && (
        <div className="fixed inset-3 top-[40px] rounded-3xl border-2 border-dashed border-white/50 bg-white/5 flex items-center justify-center pointer-events-none">
          <div className="glass rounded-2xl px-5 py-3 text-[14px] font-medium flex items-center gap-2 border border-line-strong"><ShieldCheck size={17} className="text-success" /> Drop to import & encrypt</div>
        </div>
      )}
      {showWidgets && <Widgets />}
    </div>
  );
}
