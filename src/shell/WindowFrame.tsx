import React, { Component, Suspense, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Minus, Square, X, Copy, RotateCcw, AlertTriangle } from 'lucide-react';
import { wm, useWindows, zoneRect, workArea, TOPBAR_H, WORKSPACES, type Win, type SnapZone, type Rect } from '../kernel/windows';
import { getApp } from '../kernel/registry';
import { AppGlyph, Button, Spinner, WinContext, cx, openMenu, type MenuItem } from '../ui';
import { useSettings } from '../kernel/settings';

const MIN_W = 320, MIN_H = 220;

class AppBoundary extends Component<{ children: React.ReactNode; name: string; onRestart: () => void }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error('[app crash]', error); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-danger/15 text-danger flex items-center justify-center"><AlertTriangle size={22} /></div>
        <div className="font-semibold">{this.props.name} stopped unexpectedly</div>
        <div className="text-[12px] text-muted max-w-sm font-mono break-all">{String(this.state.error.message).slice(0, 300)}</div>
        <Button variant="primary" icon={RotateCcw} onClick={() => { this.setState({ error: null }); this.props.onRestart(); }}>Restart app</Button>
      </div>
    );
  }
}

function snapZoneAt(x: number, y: number): SnapZone | null {
  const W = window.innerWidth, H = window.innerHeight, edge = 6, corner = 60;
  const left = x <= edge, right = x >= W - edge, top = y <= TOPBAR_H + 2;
  if ((left && y < TOPBAR_H + corner) || (top && x < corner)) return 'top-left';
  if ((right && y < TOPBAR_H + corner) || (top && x > W - corner)) return 'top-right';
  if (left && y > H - corner) return 'bottom-left';
  if (right && y > H - corner) return 'bottom-right';
  if (left) return 'left';
  if (right) return 'right';
  if (top) return 'max';
  return null;
}

export const useSnapPreview = (() => {
  let listeners: ((z: SnapZone | null) => void)[] = [];
  return {
    set(z: SnapZone | null) { listeners.forEach((l) => l(z)); },
    subscribe(fn: (z: SnapZone | null) => void) { listeners.push(fn); return () => { listeners = listeners.filter((l) => l !== fn); }; },
  };
})();

interface Props { win: Win; z: number; active: boolean; overviewRect?: Rect | null; currentWs: number }

export const WindowFrame = React.memo(function WindowFrame({ win, z, active, overviewRect, currentWs }: Props) {
  const app = getApp(win.appId);
  const ref = useRef<HTMLDivElement>(null);
  const [restartKey, setRestartKey] = useState(0);
  const [geomAnim, setGeomAnim] = useState(false);
  const reducedMotion = useSettings((s) => s.reducedMotion);
  const overview = !!overviewRect;
  const maximized = win.state === 'maximized';
  const hidden = win.state === 'minimized';
  const offWs = win.ws !== currentWs;

  // Animate geometry only for discrete changes (snap/maximize/overview), never while dragging.
  const prevKey = useRef(`${win.state}|${win.snap}|${overview}`);
  useEffect(() => {
    const key = `${win.state}|${win.snap}|${overview}`;
    if (prevKey.current !== key) {
      prevKey.current = key;
      setGeomAnim(true);
      const t = setTimeout(() => setGeomAnim(false), 360);
      return () => clearTimeout(t);
    }
  }, [win.state, win.snap, overview]);

  if (!app) return null;
  const AppComp = app.component;
  const area = workArea();
  const rect: Rect = maximized ? area : { x: win.x, y: win.y, w: win.w, h: win.h };
  const minW = app.minW ?? MIN_W, minH = app.minH ?? MIN_H;

  let transform = `translate3d(${rect.x}px, ${rect.y}px, 0)`;
  if (overviewRect) {
    const s = overviewRect.w / rect.w;
    transform = `translate3d(${overviewRect.x}px, ${overviewRect.y}px, 0) scale(${s})`;
  }

  /* ---------- Dragging ---------- */
  const startDrag = (e: React.PointerEvent) => {
    if (e.button !== 0 || overview) return;
    if ((e.target as HTMLElement).closest('button, input, [data-no-drag]')) return;
    wm.focus(win.id);
    const el = ref.current!;
    const startX = e.clientX, startY = e.clientY;
    let base = { x: rect.x, y: rect.y, w: rect.w, h: rect.h };
    let moved = false;
    let zone: SnapZone | null = null;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    document.body.classList.add('dragging-window');

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX, dy = ev.clientY - startY;
      if (!moved && Math.hypot(dx, dy) < 4) return;
      if (!moved) {
        moved = true;
        if (win.snap || maximized) {
          // Pop out of snap, keeping the cursor at the same relative spot of the title bar.
          const r = win.restore ?? { x: base.x, y: base.y, w: Math.min(base.w, 900), h: Math.min(base.h, 640) };
          const rel = (startX - base.x) / base.w;
          base = { x: startX - r.w * rel, y: Math.max(TOPBAR_H, startY - 16), w: r.w, h: r.h };
          wm.unsnap(win.id, { x: base.x, y: base.y });
          el.style.width = `${r.w}px`;
          el.style.height = `${r.h}px`;
        }
      }
      const nx = base.x + dx;
      const ny = Math.max(TOPBAR_H, base.y + dy);
      el.style.transform = `translate3d(${nx}px, ${ny}px, 0)`;
      const z = snapZoneAt(ev.clientX, ev.clientY);
      if (z !== zone) { zone = z; useSnapPreview.set(z); }
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.classList.remove('dragging-window');
      useSnapPreview.set(null);
      if (!moved) return;
      if (zone) wm.snap(win.id, zone);
      else {
        const nx = Math.min(window.innerWidth - 80, Math.max(80 - base.w, base.x + ev.clientX - startX));
        const ny = Math.min(window.innerHeight - 40, Math.max(TOPBAR_H, base.y + ev.clientY - startY));
        wm.setBounds(win.id, { x: nx, y: ny });
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  /* ---------- Resizing ---------- */
  const startResize = (dir: string) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    wm.focus(win.id);
    const el = ref.current!;
    const sx = e.clientX, sy = e.clientY;
    const b = { ...rect };
    let out = { ...b };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    document.body.classList.add('dragging-window');
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      let { x, y, w, h } = b;
      if (dir.includes('e')) w = Math.max(minW, b.w + dx);
      if (dir.includes('s')) h = Math.max(minH, b.h + dy);
      if (dir.includes('w')) { w = Math.max(minW, b.w - dx); x = b.x + b.w - w; }
      if (dir.includes('n')) { h = Math.max(minH, b.h - dy); y = Math.max(TOPBAR_H, b.y + b.h - h); h = b.y + b.h - y; }
      out = { x, y, w, h };
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.classList.remove('dragging-window');
      wm.setBounds(win.id, { ...out, snap: null, state: 'normal' } as Partial<Win>);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const titleMenu = (e: React.MouseEvent) => {
    const items: MenuItem[] = [
      { label: maximized ? 'Restore' : 'Maximize', icon: maximized ? Copy : Square, onClick: () => wm.toggleMaximize(win.id) },
      { label: 'Minimize', icon: Minus, onClick: () => wm.minimize(win.id) },
      { separator: true },
      { label: 'Snap left', shortcut: 'Alt ←', onClick: () => wm.snap(win.id, 'left') },
      { label: 'Snap right', shortcut: 'Alt →', onClick: () => wm.snap(win.id, 'right') },
      { label: 'Snap to quarter', submenu: (['top-left', 'top-right', 'bottom-left', 'bottom-right'] as SnapZone[]).map((z) => ({ label: z.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase()), onClick: () => wm.snap(win.id, z) })) },
      { label: 'Move to workspace', submenu: Array.from({ length: WORKSPACES }, (_, i) => ({ label: `Workspace ${i + 1}`, checked: win.ws === i, onClick: () => wm.moveToWs(win.id, i) })) },
      { separator: true },
      ...(app.single ? [] : [{ label: 'New window', onClick: () => { wm.open(win.appId, undefined, { newWindow: true }); } }]),
      { label: 'Close', icon: X, shortcut: 'Alt Q', danger: true, onClick: () => wm.close(win.id) },
    ];
    openMenu(e, items);
  };

  const wsOffset = (win.ws - currentWs) * (window.innerWidth + 40);
  const radius = maximized && !overview ? 0 : 'var(--radius-window)';

  return (
    <div
      ref={ref}
      data-win={win.id}
      className={cx('absolute left-0 top-0', (hidden || offWs) && !overview && 'pointer-events-none')}
      style={{
        transform,
        width: rect.w,
        height: rect.h,
        zIndex: z,
        transformOrigin: '0 0',
        transition: geomAnim && !reducedMotion ? 'transform .34s cubic-bezier(.2,.8,.2,1), width .34s cubic-bezier(.2,.8,.2,1), height .34s cubic-bezier(.2,.8,.2,1)' : 'none',
        visibility: (hidden || offWs) && !overview ? 'hidden' : 'visible',
      }}
      onPointerDownCapture={() => { if (!active && !overview) wm.focus(win.id); }}
    >
      <motion.div
        className={cx('w-full h-full flex flex-col overflow-hidden window-glass', overview && 'cursor-pointer')}
        style={{ borderRadius: radius, boxShadow: active ? 'var(--shadow-window)' : 'var(--shadow-window-inactive)' }}
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{
          opacity: hidden && !overview ? 0 : 1,
          scale: hidden && !overview ? 0.55 : 1,
          y: hidden && !overview ? window.innerHeight - rect.y - rect.h / 2 : 0,
          x: overview ? 0 : wsOffset,
        }}
        exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.16 } }}
        transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 36, mass: 0.8, opacity: { duration: 0.18 } }}
        onClick={overview ? () => { wm.focus(win.id); wm.toggleOverview(false); } : undefined}
      >
        {/* Title bar */}
        <div
          className={cx('h-[38px] shrink-0 flex items-center gap-2 pl-3 pr-1.5 select-none border-b transition-colors', active ? 'border-line' : 'border-transparent')}
          style={{ background: 'var(--chrome)' }}
          onPointerDown={startDrag}
          onDoubleClick={(e) => { if (!(e.target as HTMLElement).closest('button')) wm.toggleMaximize(win.id); }}
          onContextMenu={titleMenu}
        >
          <AppGlyph app={app} size={18} />
          <div className={cx('flex-1 truncate text-[12.5px] font-medium transition-opacity', active ? 'opacity-100' : 'opacity-55')}>{win.title}</div>
          <div className={cx('flex items-center gap-0.5 transition-opacity', active ? 'opacity-100' : 'opacity-50')}>
            <TitleBtn label="Minimize" onClick={() => wm.minimize(win.id)}><Minus size={14} /></TitleBtn>
            <TitleBtn label={maximized ? 'Restore' : 'Maximize'} onClick={() => wm.toggleMaximize(win.id)}>{maximized || win.snap ? <Copy size={12} className="-scale-x-100" /> : <Square size={11.5} />}</TitleBtn>
            <TitleBtn label="Close" danger onClick={() => wm.close(win.id)}><X size={15} /></TitleBtn>
          </div>
        </div>

        {/* Content */}
        <div className={cx('flex-1 min-h-0 relative app-content', overview && 'pointer-events-none')}>
          <WinContext.Provider value={win}>
            <AppBoundary name={app.name} onRestart={() => setRestartKey((k) => k + 1)}>
              <Suspense fallback={<div className="h-full flex items-center justify-center"><Spinner size={22} /></div>}>
                <AppComp key={restartKey} win={win} />
              </Suspense>
            </AppBoundary>
          </WinContext.Provider>
        </div>
      </motion.div>

      {overview && (
        <div className="absolute left-0 right-0 flex justify-center pointer-events-none" style={{ top: '100%', transform: `scale(${1 / (overviewRect!.w / rect.w)})`, transformOrigin: 'top center' }}>
          <div className="mt-3 px-3 py-1 rounded-full glass text-[12.5px] font-medium border border-line max-w-[300px] truncate">{win.title}</div>
        </div>
      )}

      {/* Resize handles */}
      {!maximized && !overview && !hidden && (
        <>
          {['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].map((d) => (
            <div
              key={d}
              onPointerDown={startResize(d)}
              className="absolute z-10"
              style={{
                ...(d.includes('n') ? { top: -4 } : d.includes('s') ? { bottom: -4 } : { top: 8, bottom: 8 }),
                ...(d.includes('w') ? { left: -4 } : d.includes('e') ? { right: -4 } : { left: 8, right: 8 }),
                width: d.length === 2 ? 14 : d === 'e' || d === 'w' ? 8 : undefined,
                height: d.length === 2 ? 14 : d === 'n' || d === 's' ? 8 : undefined,
                cursor: `${d}-resize`,
              }}
            />
          ))}
        </>
      )}
    </div>
  );
});

function TitleBtn({ children, onClick, label, danger }: { children: React.ReactNode; onClick: () => void; label: string; danger?: boolean }) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cx('w-[30px] h-[26px] rounded-md flex items-center justify-center text-muted transition-colors', danger ? 'hover:bg-danger hover:text-white' : 'hover:bg-hover hover:text-fg')}
    >
      {children}
    </button>
  );
}

export function SnapPreview() {
  const [zone, setZone] = useState<SnapZone | null>(null);
  useEffect(() => useSnapPreview.subscribe(setZone), []);
  if (!zone) return null;
  const r = zoneRect(zone);
  return (
    <div
      className="fixed z-[9000] rounded-2xl border-2 border-accent/60 bg-accent/12 backdrop-blur-sm pointer-events-none transition-all duration-150 animate-fade-in"
      style={{ left: r.x + 4, top: r.y + 4, width: r.w - 8, height: r.h - 8 }}
    />
  );
}

