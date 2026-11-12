import { useEffect, useRef, useState } from 'react';
import { Pencil, Highlighter, Eraser, Minus, Square, Circle, PaintBucket, Pipette, Undo2, Redo2, Save, FolderOpen, FilePlus, Trash2, Type } from 'lucide-react';
import type { AppProps } from '../kernel/registry';
import { vfs } from '../kernel/vfs';
import { wm, setCloseGuard } from '../kernel/windows';
import { dialog } from '../kernel/dialog';
import { toast } from '../kernel/notify';
import { HOME, basename } from '../lib/path';
import { IconButton, Slider, Button, cx } from '../ui';

type Tool = 'pen' | 'marker' | 'eraser' | 'line' | 'rect' | 'ellipse' | 'fill' | 'picker' | 'text';
const PALETTE = ['#111827', '#ffffff', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#78350f', '#64748b', '#fde68a', '#bbf7d0', '#bfdbfe'];
const W = 1600, H = 1000;

export default function Paint({ win }: AppProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#6366f1');
  const [size, setSize] = useState(6);
  const [opacity, setOpacity] = useState(100);
  const [path, setPath] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const undo = useRef<ImageData[]>([]);
  const redo = useRef<ImageData[]>([]);
  const [, bump] = useState(0);

  const ctx = () => canvasRef.current!.getContext('2d', { willReadFrequently: true })!;

  useEffect(() => {
    const c = ctx();
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, W, H);
    if (win.data?.path) void load(win.data.path);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (win.data?.path) void load(win.data.path); }, [win.data?._n]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { wm.setTitle(win.id, `${path ? basename(path) : 'Untitled'}${dirty ? ' •' : ''} — Canvas`); }, [path, dirty, win.id]);
  useEffect(() => {
    setCloseGuard(win.id, async () => !dirtyRef.current || dialog.confirm({ title: 'Discard unsaved drawing?', danger: true, confirmLabel: 'Discard' }));
    return () => setCloseGuard(win.id, null);
  }, [win.id]);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  const snapshot = () => {
    undo.current.push(ctx().getImageData(0, 0, W, H));
    if (undo.current.length > 30) undo.current.shift();
    redo.current = [];
    bump((x) => x + 1);
  };

  async function load(p: string) {
    const url = await vfs.objectUrl(p);
    const img = new Image();
    img.src = url;
    await img.decode();
    snapshot();
    const c = ctx();
    c.fillStyle = '#fff';
    c.fillRect(0, 0, W, H);
    const s = Math.min(W / img.width, H / img.height, 1);
    c.drawImage(img, (W - img.width * s) / 2, (H - img.height * s) / 2, img.width * s, img.height * s);
    URL.revokeObjectURL(url);
    setPath(p.endsWith('.png') ? p : null);
    setDirty(false);
  }

  const pos = (e: React.PointerEvent | PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  const hexToRgba = (hex: string): [number, number, number, number] => { const v = parseInt(hex.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255, 255]; };

  const flood = (x: number, y: number) => {
    const c = ctx();
    const img = c.getImageData(0, 0, W, H);
    const d = img.data;
    const i0 = (Math.floor(y) * W + Math.floor(x)) * 4;
    const target = [d[i0], d[i0 + 1], d[i0 + 2], d[i0 + 3]];
    const fill = hexToRgba(color);
    if (target.every((v, i) => Math.abs(v - fill[i]) < 4)) return;
    const match = (i: number) => Math.abs(d[i] - target[0]) + Math.abs(d[i + 1] - target[1]) + Math.abs(d[i + 2] - target[2]) + Math.abs(d[i + 3] - target[3]) < 60;
    const stack = [[Math.floor(x), Math.floor(y)]];
    while (stack.length) {
      const [sx, sy] = stack.pop()!;
      let lx = sx;
      while (lx >= 0 && match((sy * W + lx) * 4)) lx--;
      lx++;
      let up = false, down = false;
      for (let cx2 = lx; cx2 < W && match((sy * W + cx2) * 4); cx2++) {
        const i = (sy * W + cx2) * 4;
        d[i] = fill[0]; d[i + 1] = fill[1]; d[i + 2] = fill[2]; d[i + 3] = 255;
        if (sy > 0) { const m = match(((sy - 1) * W + cx2) * 4); if (m && !up) { stack.push([cx2, sy - 1]); up = true; } else if (!m) up = false; }
        if (sy < H - 1) { const m = match(((sy + 1) * W + cx2) * 4); if (m && !down) { stack.push([cx2, sy + 1]); down = true; } else if (!m) down = false; }
      }
    }
    c.putImageData(img, 0, 0);
  };

  const down = async (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const p = pos(e);
    if (tool === 'picker') {
      const [r, g, b] = ctx().getImageData(p.x, p.y, 1, 1).data;
      setColor('#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join(''));
      setTool('pen');
      return;
    }
    if (tool === 'text') {
      const text = await dialog.prompt({ title: 'Add text', placeholder: 'Type something', confirmLabel: 'Place' });
      if (!text) return;
      snapshot();
      const c = ctx();
      c.globalAlpha = opacity / 100;
      c.fillStyle = color;
      c.font = `600 ${size * 6}px Inter Variable, system-ui`;
      c.fillText(text, p.x, p.y);
      c.globalAlpha = 1;
      setDirty(true);
      return;
    }
    snapshot();
    setDirty(true);
    if (tool === 'fill') { flood(p.x, p.y); return; }
    const c = ctx();
    const ov = overlayRef.current!.getContext('2d')!;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    let last = p;
    const style = (g: CanvasRenderingContext2D) => {
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.lineWidth = tool === 'marker' ? size * 3 : tool === 'eraser' ? size * 3 : size;
      g.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
      g.globalAlpha = tool === 'marker' ? Math.min(0.35, opacity / 100) : opacity / 100;
    };
    style(c); style(ov);
    if (tool === 'pen' || tool === 'marker' || tool === 'eraser') {
      if (tool === 'marker') { ov.clearRect(0, 0, W, H); ov.globalAlpha = 1; ov.strokeStyle = color; ov.beginPath(); ov.moveTo(p.x, p.y); }
      else { c.beginPath(); c.arc(p.x, p.y, c.lineWidth / 2, 0, Math.PI * 2); c.fillStyle = c.strokeStyle; c.fill(); }
    }
    const move = (ev: PointerEvent) => {
      const q = pos(ev);
      if (tool === 'pen' || tool === 'eraser') {
        c.beginPath(); c.moveTo(last.x, last.y); c.lineTo(q.x, q.y); c.stroke();
        last = q;
      } else if (tool === 'marker') {
        ov.lineTo(q.x, q.y); ov.clearRect(0, 0, W, H); ov.stroke();
      } else {
        ov.clearRect(0, 0, W, H);
        ov.beginPath();
        if (tool === 'line') { ov.moveTo(p.x, p.y); ov.lineTo(q.x, q.y); }
        else if (tool === 'rect') ov.rect(p.x, p.y, q.x - p.x, q.y - p.y);
        else ov.ellipse((p.x + q.x) / 2, (p.y + q.y) / 2, Math.abs(q.x - p.x) / 2, Math.abs(q.y - p.y) / 2, 0, 0, Math.PI * 2);
        ov.stroke();
      }
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (tool !== 'pen' && tool !== 'eraser') {
        c.globalAlpha = tool === 'marker' ? Math.min(0.35, opacity / 100) : 1;
        c.drawImage(overlayRef.current!, 0, 0);
        ov.clearRect(0, 0, W, H);
      }
      c.globalAlpha = 1;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const doUndo = () => { const s = undo.current.pop(); if (!s) return; redo.current.push(ctx().getImageData(0, 0, W, H)); ctx().putImageData(s, 0, 0); bump((x) => x + 1); };
  const doRedo = () => { const s = redo.current.pop(); if (!s) return; undo.current.push(ctx().getImageData(0, 0, W, H)); ctx().putImageData(s, 0, 0); bump((x) => x + 1); };

  const save = async (as = false) => {
    let target = path;
    if (!target || as) target = await dialog.save({ defaultName: 'Drawing.png', startDir: `${HOME}/Pictures`, extensions: ['png'] });
    if (!target) return;
    const blob = await new Promise<Blob>((r) => canvasRef.current!.toBlob((b) => r(b!), 'image/png'));
    await vfs.writeBytes(target, new Uint8Array(await blob.arrayBuffer()), 'image/png');
    setPath(target);
    setDirty(false);
    toast(`Saved ${basename(target)}`, 'success');
  };

  const onKey = (e: React.KeyboardEvent) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key === 'z') { e.preventDefault(); if (e.shiftKey) doRedo(); else doUndo(); }
    else if (mod && e.key === 'y') { e.preventDefault(); doRedo(); }
    else if (mod && e.key === 's') { e.preventDefault(); void save(e.shiftKey); }
    else if (!mod) {
      const map: Record<string, Tool> = { b: 'pen', m: 'marker', e: 'eraser', l: 'line', r: 'rect', o: 'ellipse', g: 'fill', i: 'picker', t: 'text' };
      if (map[e.key]) setTool(map[e.key]);
      if (e.key === '[') setSize((s) => Math.max(1, s - 1));
      if (e.key === ']') setSize((s) => Math.min(60, s + 1));
    }
  };

  const tools: [Tool, typeof Pencil, string][] = [['pen', Pencil, 'Brush (B)'], ['marker', Highlighter, 'Marker (M)'], ['eraser', Eraser, 'Eraser (E)'], ['line', Minus, 'Line (L)'], ['rect', Square, 'Rectangle (R)'], ['ellipse', Circle, 'Ellipse (O)'], ['fill', PaintBucket, 'Fill (G)'], ['picker', Pipette, 'Eyedropper (I)'], ['text', Type, 'Text (T)']];

  return (
    <div className="h-full flex flex-col outline-none" tabIndex={0} onKeyDown={onKey}>
      <div className="h-12 shrink-0 flex items-center gap-1 px-2 border-b border-line">
        <IconButton icon={FilePlus} label="New" onClick={async () => { if (dirty && !(await dialog.confirm({ title: 'Discard current drawing?', danger: true, confirmLabel: 'Discard' }))) return; snapshot(); const c = ctx(); c.fillStyle = '#fff'; c.fillRect(0, 0, W, H); setPath(null); setDirty(false); }} />
        <IconButton icon={FolderOpen} label="Open" onClick={async () => { const p = await dialog.open({ startDir: `${HOME}/Pictures`, extensions: ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'] }); if (p) await load(p); }} />
        <IconButton icon={Save} label="Save (Ctrl S)" onClick={() => save()} />
        <div className="w-px h-6 bg-line mx-1" />
        <IconButton icon={Undo2} label="Undo" disabled={!undo.current.length} onClick={doUndo} />
        <IconButton icon={Redo2} label="Redo" disabled={!redo.current.length} onClick={doRedo} />
        <div className="w-px h-6 bg-line mx-1" />
        {tools.map(([t, I, l]) => <IconButton key={t} icon={I} label={l} active={tool === t} onClick={() => setTool(t)} />)}
        <div className="flex-1" />
        <span className="text-[11.5px] text-muted">Size</span><div className="w-24"><Slider value={size} min={1} max={60} onChange={setSize} /></div>
        <span className="text-[11.5px] text-muted ml-2">Opacity</span><div className="w-20"><Slider value={opacity} min={5} max={100} onChange={setOpacity} /></div>
        <IconButton icon={Trash2} label="Clear" onClick={() => { snapshot(); const c = ctx(); c.fillStyle = '#fff'; c.fillRect(0, 0, W, H); setDirty(true); }} />
      </div>
      <div className="flex-1 flex min-h-0">
        <div className="w-14 shrink-0 border-r border-line flex flex-col items-center gap-1.5 py-3 overflow-y-auto">
          <label className="w-9 h-9 rounded-xl border-2 border-line-strong cursor-pointer relative overflow-hidden shadow-inner" style={{ background: color }} title="Custom color">
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="opacity-0 absolute inset-0 cursor-pointer" />
          </label>
          <div className="h-px w-8 bg-line my-1" />
          {PALETTE.map((c) => <button key={c} onClick={() => setColor(c)} className={cx('w-7 h-7 rounded-lg border border-line transition-transform', color === c && 'ring-2 ring-accent scale-110')} style={{ background: c }} />)}
        </div>
        <div className="flex-1 min-w-0 flex items-center justify-center p-5 bg-[repeating-conic-gradient(var(--hover)_0_25%,transparent_0_50%)] bg-[length:20px_20px]">
          <div className="relative shadow-2xl rounded-sm overflow-hidden" style={{ aspectRatio: `${W}/${H}`, maxWidth: '100%', maxHeight: '100%', height: '100%' }}>
            <canvas ref={canvasRef} width={W} height={H} className="absolute inset-0 w-full h-full" style={{ cursor: tool === 'picker' ? 'copy' : tool === 'text' ? 'text' : 'crosshair', touchAction: 'none' }} onPointerDown={down} />
            <canvas ref={overlayRef} width={W} height={H} className="absolute inset-0 w-full h-full pointer-events-none" />
          </div>
        </div>
      </div>
      <div className="h-6 shrink-0 border-t border-line flex items-center gap-4 px-3 text-[11px] text-faint">
        <span>{W} × {H}</span><span className="capitalize">{tool}</span><span>{size}px</span><span className="flex-1" />{path && <Button size="sm" variant="subtle" onClick={() => save(true)}>Save as…</Button>}
      </div>
    </div>
  );
}
