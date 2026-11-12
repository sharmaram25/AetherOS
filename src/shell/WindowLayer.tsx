import { useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { useWindows, wm, WORKSPACES, TOPBAR_H, type Rect, type Win } from '../kernel/windows';
import { getApp } from '../kernel/registry';
import { WindowFrame, SnapPreview } from './WindowFrame';
import { AppGlyph, cx } from '../ui';

function overviewLayout(wins: Win[]): Record<string, Rect> {
  const out: Record<string, Rect> = {};
  if (!wins.length) return out;
  const top = TOPBAR_H + 150, bottom = 110, side = 60, gap = 40;
  const W = window.innerWidth - side * 2, H = window.innerHeight - top - bottom;
  const n = wins.length;
  let best = { cols: 1, rows: n, cell: 0 };
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const cw = (W - gap * (cols - 1)) / cols, ch = (H - gap * (rows - 1)) / rows;
    const cell = Math.min(cw / 16, ch / 10);
    if (cell > best.cell) best = { cols, rows, cell };
  }
  const { cols, rows } = best;
  const cw = (W - gap * (cols - 1)) / cols, ch = (H - gap * (rows - 1)) / rows;
  wins.forEach((w, i) => {
    const r = Math.floor(i / cols), c = i % cols;
    const inRow = r === rows - 1 ? n - r * cols : cols;
    const rowOffset = ((cols - inRow) * (cw + gap)) / 2;
    const ww = w.state === 'maximized' ? window.innerWidth : w.w;
    const wh = w.state === 'maximized' ? window.innerHeight - TOPBAR_H : w.h;
    const s = Math.min(1, (cw - 10) / ww, (ch - 36) / wh);
    const sw = ww * s, sh = wh * s;
    out[w.id] = { x: side + rowOffset + c * (cw + gap) + (cw - sw) / 2, y: top + r * (ch + gap) + (ch - 36 - sh) / 2, w: sw, h: sh };
  });
  return out;
}

export function WindowLayer() {
  const { wins, order, activeId, ws, overview } = useWindows();

  // Stable render order (by creation) so windows never remount; stacking comes from z-index.
  const list = useMemo(() => Object.values(wins).sort((a, b) => a.created - b.created), [wins]);
  const zOf = useMemo(() => Object.fromEntries(order.map((id, i) => [id, i + 10])), [order]);
  const layout = useMemo(() => (overview ? overviewLayout(order.map((id) => wins[id]).filter((w) => w && w.ws === ws)) : {}), [overview, wins, order, ws]);

  // Focus windows when the user clicks into an iframe inside them (iframes swallow pointer events).
  useEffect(() => {
    const onBlur = () => setTimeout(() => {
      const el = document.activeElement as HTMLElement | null;
      if (el?.tagName === 'IFRAME') {
        const id = el.closest<HTMLElement>('[data-win]')?.dataset.win;
        if (id && useWindows.getState().activeId !== id) wm.focus(id);
      }
    });
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, []);

  useEffect(() => {
    if (!overview) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') wm.toggleOverview(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [overview]);

  return (
    <>
      <AnimatePresence>
        {overview && (
          <motion.div
            key="ov-bg"
            className="fixed inset-0 bg-black/45 backdrop-blur-md"
            style={{ zIndex: 5 }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => wm.toggleOverview(false)}
          />
        )}
      </AnimatePresence>
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: overview ? 6 : 1 }}>
        <div className="pointer-events-auto">
          <AnimatePresence>
            {list.map((w) => (
              <WindowFrame
                key={w.id}
                win={w}
                z={zOf[w.id] ?? 1}
                active={w.id === activeId}
                currentWs={ws}
                overviewRect={overview ? layout[w.id] ?? null : null}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>
      {overview && <WorkspaceStrip />}
      <SnapPreview />
    </>
  );
}

function WorkspaceStrip() {
  const { wins, ws } = useWindows();
  return (
    <motion.div
      initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      className="fixed left-0 right-0 flex justify-center gap-4"
      style={{ top: TOPBAR_H + 24, zIndex: 7 }}
    >
      {Array.from({ length: WORKSPACES }, (_, i) => {
        const items = Object.values(wins).filter((w) => w.ws === i);
        return (
          <button
            key={i}
            onClick={() => wm.switchWs(i)}
            onDragOver={(e) => e.preventDefault()}
            className={cx('w-[168px] h-[96px] rounded-xl border-2 p-2 flex flex-col transition-all text-left',
              i === ws ? 'border-accent bg-white/15' : 'border-white/15 bg-white/5 hover:bg-white/10')}
          >
            <div className="text-[11px] font-semibold text-white/80">Workspace {i + 1}</div>
            <div className="flex-1 flex flex-wrap gap-1 items-end content-end">
              {items.slice(0, 8).map((w) => {
                const app = getApp(w.appId);
                return app ? <AppGlyph key={w.id} app={app} size={20} /> : null;
              })}
              {!items.length && <span className="text-[11px] text-white/40 flex items-center gap-1"><Plus size={11} /> Empty</span>}
            </div>
          </button>
        );
      })}
    </motion.div>
  );
}
