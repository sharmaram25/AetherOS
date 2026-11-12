import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform, type MotionValue } from 'framer-motion';
import { Trash2, LayoutGrid, Pin, PinOff, X, AppWindow, Plus } from 'lucide-react';
import { useWindows, wm } from '../kernel/windows';
import { getApp, type AppDef } from '../kernel/registry';
import { useSettings } from '../kernel/settings';
import { useVfs, vfs } from '../kernel/vfs';
import { shell, useShell } from './store';
import { AppGlyph, cx, openMenu, type MenuItem } from '../ui';
import { emptyTrash } from './commands';
import { TRASH } from '../lib/path';
import { sound } from '../lib/sound';

export const DRAG_MIME = 'application/x-aether-paths';

export function Dock() {
  const { pinned, dockSize: prefSize, dockMagnify: prefMagnify, dockAutohide, set } = useSettings();
  const [vw, setVw] = useState(() => window.innerWidth);
  useEffect(() => {
    const fn = () => setVw(window.innerWidth);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  const { wins, activeId, ws } = useWindows();
  const panel = useShell((s) => s.panel);
  const trashCount = useVfs((s) => vfs.list(TRASH, s.nodes).length);
  const mouseX = useMotionValue(Infinity);
  const [hover, setHover] = useState(false);
  const hoverRef = useRef(false);
  const [trashOver, setTrashOver] = useState(false);

  const running = useMemo(() => [...new Set(Object.values(wins).map((w) => w.appId))], [wins]);
  const items = useMemo(() => {
    const list = [...pinned.filter((id) => getApp(id)), ...running.filter((id) => !pinned.includes(id))];
    return list.map((id) => getApp(id)!).filter(Boolean);
  }, [pinned, running]);

  // Shrink icons so the dock always fits the screen (items + launchpad + trash, plus gaps/padding).
  const slots = items.length + 2;
  const dockSize = Math.max(28, Math.min(prefSize, Math.floor((vw - 48 - slots * 6 - 20) / slots)));
  const dockMagnify = prefMagnify && dockSize >= 34;

  // Proximity-based reveal: robust even when mouseleave is missed (iframes, drags, re-renders).
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const near = e.clientY > window.innerHeight - (hoverRef.current ? dockSize + 40 : 6);
      if (near !== hoverRef.current) { hoverRef.current = near; setHover(near); }
    };
    const onLeave = () => { hoverRef.current = false; setHover(false); };
    window.addEventListener('pointermove', onMove);
    document.addEventListener('pointerleave', onLeave);
    return () => { window.removeEventListener('pointermove', onMove); document.removeEventListener('pointerleave', onLeave); };
  }, [dockSize]);

  const maximizedHere = Object.values(wins).some((w) => w.ws === ws && w.state === 'maximized');
  const hidden = !hover && panel !== 'launchpad' && (dockAutohide === 'always' || (dockAutohide === 'maximized' && maximizedHere));

  const click = (app: AppDef) => {
    const mine = Object.values(wins).filter((w) => w.appId === app.id).sort((a, b) => b.created - a.created);
    if (!mine.length) { wm.open(app.id); return; }
    const activeMine = mine.find((w) => w.id === activeId);
    if (activeMine && mine.length === 1) { wm.minimize(activeMine.id); return; }
    if (activeMine) {
      const idx = mine.indexOf(activeMine);
      wm.focus(mine[(idx + 1) % mine.length].id);
      return;
    }
    const onWs = mine.find((w) => w.ws === ws) ?? mine[0];
    wm.focus(onWs.id);
  };

  const menu = (e: React.MouseEvent, app: AppDef) => {
    const mine = Object.values(wins).filter((w) => w.appId === app.id);
    const isPinned = pinned.includes(app.id);
    const items: MenuItem[] = [
      ...(mine.length ? [{ header: `${mine.length} window${mine.length > 1 ? 's' : ''}` } as MenuItem, ...mine.map((w) => ({ label: w.title, icon: AppWindow, onClick: () => wm.focus(w.id) })), { separator: true } as MenuItem] : []),
      ...(!app.single || !mine.length ? [{ label: 'New window', icon: Plus, onClick: () => { wm.open(app.id, undefined, { newWindow: true }); } }] : []),
      { label: isPinned ? 'Unpin from dock' : 'Pin to dock', icon: isPinned ? PinOff : Pin, onClick: () => set({ pinned: isPinned ? pinned.filter((p) => p !== app.id) : [...pinned, app.id] }) },
      ...(mine.length ? [{ separator: true } as MenuItem, { label: mine.length > 1 ? 'Close all windows' : 'Quit', icon: X, danger: true, onClick: () => wm.closeApp(app.id) }] : []),
    ];
    openMenu(e, items);
  };

  const dropOnTrash = async (e: React.DragEvent) => {
    e.preventDefault();
    setTrashOver(false);
    const raw = e.dataTransfer.getData(DRAG_MIME);
    if (!raw) return;
    const paths = JSON.parse(raw) as string[];
    await vfs.trash(paths);
    if (useSettings.getState().sounds) sound('trash');
  };

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 h-1.5 z-40" onMouseEnter={() => setHover(true)} />
      <motion.div
        className="fixed bottom-2 left-1/2 z-40"
        initial={false}
        animate={{ x: '-50%', y: hidden ? dockSize + 40 : 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 36 }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => mouseX.set(Infinity)}
      >
        <div
          className="flex items-end gap-1.5 px-2 pb-2 pt-2 rounded-[22px] glass border border-line-strong shadow-2xl shadow-black/30"
          onMouseMove={(e) => dockMagnify && mouseX.set(e.clientX)}
          style={{ height: dockSize + 16 }}
        >
          <DockItem
            mouseX={mouseX} size={dockSize} magnify={dockMagnify} label="Launchpad"
            onClick={() => shell.open('launchpad')}
            glyph={<div className="w-full h-full rounded-[27%] bg-gradient-to-br from-white/25 to-white/5 border border-white/20 flex items-center justify-center backdrop-blur"><LayoutGrid size={dockSize * 0.46} className="text-fg" /></div>}
          />
          <div className="w-px self-stretch my-2 bg-line-strong mx-0.5" />
          {items.map((app) => {
            const mine = Object.values(wins).filter((w) => w.appId === app.id);
            return (
              <DockItem
                key={app.id}
                mouseX={mouseX} size={dockSize} magnify={dockMagnify}
                label={app.name}
                running={mine.length}
                active={mine.some((w) => w.id === activeId)}
                onClick={() => click(app)}
                onContextMenu={(e) => menu(e, app)}
                glyph={<AppGlyph app={app} size={dockSize} />}
              />
            );
          })}
          <div className="w-px self-stretch my-2 bg-line-strong mx-0.5" />
          <div
            onDragOver={(e) => { if (e.dataTransfer.types.includes(DRAG_MIME)) { e.preventDefault(); setTrashOver(true); } }}
            onDragLeave={() => setTrashOver(false)}
            onDrop={dropOnTrash}
          >
            <DockItem
              mouseX={mouseX} size={dockSize} magnify={dockMagnify} label={trashCount ? `Trash · ${trashCount}` : 'Trash'}
              onClick={() => wm.open('files', { path: TRASH })}
              onContextMenu={(e) => openMenu(e, [{ label: 'Open Trash', onClick: () => { wm.open('files', { path: TRASH }); } }, { label: 'Empty Trash…', danger: true, disabled: !trashCount, onClick: emptyTrash }])}
              glyph={
                <div className={cx('w-full h-full rounded-[27%] flex items-center justify-center border transition-colors', trashOver ? 'bg-danger/40 border-danger' : 'bg-gradient-to-br from-white/20 to-white/5 border-white/20')}>
                  <Trash2 size={dockSize * 0.46} className={trashCount ? 'text-fg' : 'text-muted'} />
                </div>
              }
            />
          </div>
        </div>
      </motion.div>
    </>
  );
}

function DockItem({ mouseX, size, magnify, label, glyph, onClick, onContextMenu, running = 0, active }: {
  mouseX: MotionValue<number>; size: number; magnify: boolean; label: string; glyph: React.ReactNode;
  onClick: () => void; onContextMenu?: (e: React.MouseEvent) => void; running?: number; active?: boolean;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const dist = useTransform(mouseX, (x) => {
    const r = ref.current?.getBoundingClientRect();
    return r ? x - (r.left + r.width / 2) : Infinity;
  });
  const target = useTransform(dist, [-size * 2.6, 0, size * 2.6], [size, magnify ? size * 1.55 : size, size]);
  const width = useSpring(target, { stiffness: 500, damping: 32, mass: 0.15 });
  const [tip, setTip] = useState(false);

  return (
    <motion.button
      ref={ref}
      style={{ width, height: width }}
      className="relative flex items-end justify-center shrink-0 outline-none"
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setTip(true)}
      onMouseLeave={() => setTip(false)}
      whileTap={{ scale: 0.9 }}
      aria-label={label}
    >
      <div className="w-full h-full [&>*]:!w-full [&>*]:!h-full">{glyph}</div>
      {tip && (
        <div className="absolute -top-9 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-lg glass border border-line-strong text-[12px] font-medium whitespace-nowrap shadow-lg pointer-events-none animate-fade-in">
          {label}
        </div>
      )}
      {running > 0 && (
        <div className="absolute -bottom-[7px] left-1/2 -translate-x-1/2 flex gap-0.5">
          {Array.from({ length: Math.min(running, 3) }, (_, i) => (
            <span key={i} className={cx('w-1 h-1 rounded-full', active ? 'bg-accent shadow-[0_0_6px_var(--accent)]' : 'bg-fg/50')} />
          ))}
        </div>
      )}
    </motion.button>
  );
}
