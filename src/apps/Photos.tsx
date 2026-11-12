import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Images, Folder, Upload, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Play, Pause, Wand2, RotateCw, FlipHorizontal, Trash2, Image as ImageIcon,
  Download, Star, X, Check, Info, Sparkles, ShieldCheck,
} from 'lucide-react';
import type { AppProps } from '../kernel/registry';
import { useVfs, vfs, type FsNode } from '../kernel/vfs';
import { wm } from '../kernel/windows';
import { toast, notify } from '../kernel/notify';
import { useSettings } from '../kernel/settings';
import { importHostFiles, pickHostFiles, exportToHost } from '../kernel/launcher';
import { HOME, TRASH, dirname, basename, isInside, prettyPath, stem, extname } from '../lib/path';
import { kindOf, formatBytes } from '../lib/mime';
import { formatDate } from '../lib/format';
import { Button, IconButton, SidebarItem, SectionLabel, Empty, Slider, cx, openMenu, useObjectUrl, useInterval } from '../ui';

interface Adjust { brightness: number; contrast: number; saturate: number; hue: number; blur: number; sepia: number; grayscale: number; rotate: number; flip: boolean }
const NEUTRAL: Adjust = { brightness: 100, contrast: 100, saturate: 100, hue: 0, blur: 0, sepia: 0, grayscale: 0, rotate: 0, flip: false };
const PRESETS: { name: string; a: Partial<Adjust> }[] = [
  { name: 'Original', a: {} },
  { name: 'Vivid', a: { saturate: 145, contrast: 112 } },
  { name: 'Warm', a: { sepia: 25, saturate: 120, brightness: 104 } },
  { name: 'Cool', a: { hue: 190, saturate: 90 } },
  { name: 'Noir', a: { grayscale: 100, contrast: 130 } },
  { name: 'Fade', a: { contrast: 82, brightness: 110, saturate: 80 } },
  { name: 'Drama', a: { contrast: 145, brightness: 92, saturate: 110 } },
];
const filterCss = (a: Adjust) => `brightness(${a.brightness}%) contrast(${a.contrast}%) saturate(${a.saturate}%) hue-rotate(${a.hue}deg) blur(${a.blur}px) sepia(${a.sepia}%) grayscale(${a.grayscale}%)`;

function Thumb({ node, onClick, selected, onContextMenu }: { node: FsNode; onClick: () => void; selected?: boolean; onContextMenu?: (e: React.MouseEvent) => void }) {
  const url = useObjectUrl(() => vfs.objectUrl(node.path), [node.path, node.modified]);
  return (
    <button onClick={onClick} onContextMenu={onContextMenu} className={cx('relative aspect-square rounded-lg overflow-hidden bg-hover group', selected && 'ring-2 ring-accent')}>
      {url && <img src={url} alt="" draggable={false} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />}
      {node.starred && <Star size={13} className="absolute top-1.5 right-1.5 text-amber-400 fill-amber-400 drop-shadow" />}
    </button>
  );
}

export default function Photos({ win }: AppProps) {
  const nodes = useVfs((s) => s.nodes);
  const [album, setAlbum] = useState<string>('all');
  const [viewing, setViewing] = useState<string | null>(win.data?.path ?? null);
  const [editing, setEditing] = useState(false);

  useEffect(() => { if (win.data?.path) { setViewing(win.data.path); setEditing(false); } }, [win.data?._n]); // eslint-disable-line react-hooks/exhaustive-deps

  const all = useMemo(() => Object.values(nodes).filter((n) => n.kind === 'file' && kindOf(n.path) === 'image' && !isInside(n.path, TRASH) && !n.path.startsWith('/System')).sort((a, b) => b.modified - a.modified), [nodes]);
  const albums = useMemo(() => {
    const m = new Map<string, number>();
    all.forEach((n) => m.set(dirname(n.path), (m.get(dirname(n.path)) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [all]);
  const list = album === 'all' ? all : album === 'starred' ? all.filter((n) => n.starred) : all.filter((n) => dirname(n.path) === album);

  useEffect(() => { wm.setTitle(win.id, viewing ? `${basename(viewing)} — Photos` : 'Photos'); }, [viewing, win.id]);

  const importPhotos = async () => {
    const files = await pickHostFiles({ accept: 'image/*' });
    if (files.length) await importHostFiles(files, `${HOME}/Pictures`);
  };

  const groups = useMemo(() => {
    const g = new Map<string, FsNode[]>();
    list.forEach((n) => {
      const k = new Date(n.modified).toLocaleDateString([], { month: 'long', year: 'numeric' });
      if (!g.has(k)) g.set(k, []);
      g.get(k)!.push(n);
    });
    return [...g.entries()];
  }, [list]);

  const menu = (e: React.MouseEvent, n: FsNode) => openMenu(e, [
    { label: 'Open', onClick: () => setViewing(n.path) },
    { label: 'Edit', icon: Wand2, onClick: () => { setViewing(n.path); setEditing(true); } },
    { label: n.starred ? 'Unfavorite' : 'Favorite', icon: Star, onClick: () => vfs.setStarred(n.path, !n.starred) },
    { label: 'Set as wallpaper', icon: ImageIcon, onClick: () => { useSettings.getState().set({ wallpaper: 'custom:' + n.path }); toast('Wallpaper updated', 'success'); } },
    { label: 'Export', icon: Download, onClick: () => void exportToHost(n.path) },
    { label: 'Show in Files', icon: Folder, onClick: () => { wm.open('files', { path: dirname(n.path), select: n.path }); } },
    { separator: true },
    { label: 'Move to Trash', icon: Trash2, danger: true, onClick: () => void vfs.trash([n.path]) },
  ]);

  if (viewing && vfs.exists(viewing)) {
    return editing
      ? <Editor path={viewing} onClose={() => setEditing(false)} onSaved={(p) => { setViewing(p); setEditing(false); }} />
      : <Viewer path={viewing} list={list.some((n) => n.path === viewing) ? list : all} onClose={() => setViewing(null)} onNav={setViewing} onEdit={() => setEditing(true)} />;
  }

  return (
    <div className="h-full flex">
      <div className="w-[190px] shrink-0 border-r border-line bg-hover/40 px-2 pb-2 overflow-y-auto">
        <SectionLabel>Library</SectionLabel>
        <SidebarItem icon={Images} label="All photos" count={all.length} active={album === 'all'} onClick={() => setAlbum('all')} />
        <SidebarItem icon={Star} label="Favorites" count={all.filter((n) => n.starred).length} active={album === 'starred'} onClick={() => setAlbum('starred')} color="#f59e0b" />
        <SectionLabel>Albums</SectionLabel>
        {albums.map(([p, c]) => <SidebarItem key={p} icon={Folder} label={p === HOME ? 'Home' : basename(p)} count={c} active={album === p} onClick={() => setAlbum(p)} />)}
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-12 shrink-0 flex items-center gap-2 px-4 border-b border-line">
          <div className="text-[16px] font-semibold flex-1">{album === 'all' ? 'All photos' : album === 'starred' ? 'Favorites' : basename(album)} <span className="text-muted font-normal text-[13px]">· {list.length}</span></div>
          <span className="text-[11.5px] text-faint flex items-center gap-1"><ShieldCheck size={12} className="text-success" /> Location data stripped on import</span>
          <Button size="sm" icon={Upload} onClick={importPhotos}>Import</Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4"
          onDragOver={(e) => e.preventDefault()}
          onDrop={async (e) => { e.preventDefault(); if (e.dataTransfer.files.length) await importHostFiles(e.dataTransfer.files, `${HOME}/Pictures`); }}>
          {list.length === 0 ? <Empty icon={Images} title="No photos yet" body="Import photos or take one with Camera. GPS location and camera metadata are removed automatically." action={<Button variant="primary" icon={Upload} onClick={importPhotos}>Import photos</Button>} />
            : groups.map(([k, items]) => (
              <div key={k} className="mb-6">
                <div className="text-[13px] font-semibold mb-2">{k}</div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-1.5">
                  {items.map((n) => <Thumb key={n.path} node={n} onClick={() => setViewing(n.path)} onContextMenu={(e) => menu(e, n)} />)}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function Viewer({ path, list, onClose, onNav, onEdit }: { path: string; list: FsNode[]; onClose: () => void; onNav: (p: string) => void; onEdit: () => void }) {
  const node = useVfs((s) => s.nodes[path]);
  const url = useObjectUrl(() => vfs.objectUrl(path), [path, node?.modified]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [playing, setPlaying] = useState(false);
  const [info, setInfo] = useState(false);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const idx = list.findIndex((n) => n.path === path);
  const go = (d: number) => { if (list.length) { onNav(list[(idx + d + list.length) % list.length].path); setZoom(1); setPan({ x: 0, y: 0 }); } };
  useInterval(() => go(1), playing ? 3500 : null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { ref.current?.focus(); }, []);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') go(1);
    else if (e.key === 'ArrowLeft') go(-1);
    else if (e.key === 'Escape') onClose();
    else if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(8, z * 1.25));
    else if (e.key === '-') setZoom((z) => Math.max(0.2, z / 1.25));
    else if (e.key === '0') { setZoom(1); setPan({ x: 0, y: 0 }); }
    else if (e.key === ' ') { e.preventDefault(); setPlaying((p) => !p); }
  };

  const onDrag = (e: React.PointerEvent) => {
    if (zoom <= 1) return;
    const sx = e.clientX - pan.x, sy = e.clientY - pan.y;
    const move = (ev: PointerEvent) => setPan({ x: ev.clientX - sx, y: ev.clientY - sy });
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div ref={ref} tabIndex={0} onKeyDown={onKey} className="h-full flex flex-col bg-black/90 text-white outline-none">
      <div className="h-11 shrink-0 flex items-center gap-1 px-2 bg-black/40">
        <IconButton icon={ChevronLeft} label="Library" onClick={onClose} className="!text-white/80 hover:!bg-white/10" />
        <div className="flex-1 text-center text-[13px] truncate">{basename(path)} <span className="text-white/50">· {idx + 1} of {list.length}</span></div>
        {[
          { i: ZoomOut, f: () => setZoom((z) => Math.max(0.2, z / 1.25)), l: 'Zoom out' },
          { i: ZoomIn, f: () => setZoom((z) => Math.min(8, z * 1.25)), l: 'Zoom in' },
          { i: playing ? Pause : Play, f: () => setPlaying(!playing), l: 'Slideshow' },
          { i: Star, f: () => node && vfs.setStarred(path, !node.starred), l: 'Favorite' },
          { i: Info, f: () => setInfo(!info), l: 'Info' },
          { i: Wand2, f: onEdit, l: 'Edit' },
          { i: Trash2, f: async () => { const next = list[idx + 1] ?? list[idx - 1]; await vfs.trash([path]); if (next && next.path !== path) onNav(next.path); else onClose(); }, l: 'Delete' },
        ].map(({ i, f, l }) => <IconButton key={l} icon={i} label={l} onClick={f} className={cx('!text-white/80 hover:!bg-white/10', l === 'Favorite' && node?.starred && '!text-amber-400')} />)}
      </div>
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 relative overflow-hidden flex items-center justify-center select-none"
          onWheel={(e) => setZoom((z) => Math.min(8, Math.max(0.2, z * (e.deltaY < 0 ? 1.1 : 0.9))))}
          onDoubleClick={() => { setZoom(zoom === 1 ? 2.5 : 1); setPan({ x: 0, y: 0 }); }}
          onPointerDown={onDrag}>
          {url && <img src={url} alt="" draggable={false} onLoad={(e) => setDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} className="max-w-full max-h-full object-contain transition-transform duration-150" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, cursor: zoom > 1 ? 'grab' : 'zoom-in' }} />}
          <button onClick={() => go(-1)} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center"><ChevronLeft size={20} /></button>
          <button onClick={() => go(1)} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center"><ChevronRight size={20} /></button>
          {zoom !== 1 && <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/60 text-[12px]">{Math.round(zoom * 100)}%</div>}
        </div>
        {info && node && (
          <div className="w-[240px] shrink-0 bg-black/40 p-4 text-[12px] space-y-2.5">
            <div className="font-semibold text-[13px] break-all">{node.name}</div>
            {[['Dimensions', dims ? `${dims.w} × ${dims.h}` : '—'], ['Size', formatBytes(node.size)], ['Type', node.mime ?? '—'], ['Modified', formatDate(node.modified)], ['Location', prettyPath(dirname(node.path))], ['Metadata', 'None stored']].map(([k, v]) => (
              <div key={k}><div className="text-white/50">{k}</div><div className="break-all">{v}</div></div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Editor({ path, onClose, onSaved }: { path: string; onClose: () => void; onSaved: (p: string) => void }) {
  const url = useObjectUrl(() => vfs.objectUrl(path), [path]);
  const [a, setA] = useState<Adjust>(NEUTRAL);
  const [saving, setSaving] = useState(false);
  const set = (p: Partial<Adjust>) => setA((x) => ({ ...x, ...p }));
  const sliders: [keyof Adjust, string, number, number][] = [['brightness', 'Brightness', 30, 200], ['contrast', 'Contrast', 30, 200], ['saturate', 'Saturation', 0, 250], ['hue', 'Hue', -180, 180], ['sepia', 'Warmth', 0, 100], ['grayscale', 'Mono', 0, 100], ['blur', 'Blur', 0, 12]];

  const save = async (copy: boolean) => {
    if (!url) return;
    setSaving(true);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const rot = ((a.rotate % 360) + 360) % 360;
      const swap = rot === 90 || rot === 270;
      const canvas = document.createElement('canvas');
      canvas.width = swap ? img.naturalHeight : img.naturalWidth;
      canvas.height = swap ? img.naturalWidth : img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.filter = filterCss(a);
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rot * Math.PI) / 180);
      if (a.flip) ctx.scale(-1, 1);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      const isJpg = /jpe?g|webp/.test(extname(path));
      const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), isJpg ? 'image/jpeg' : 'image/png', 0.93));
      const ext = isJpg ? 'jpg' : 'png';
      const target = copy ? vfs.uniquePath(dirname(path), `${stem(path)} (edited).${ext}`) : extname(path) === 'svg' ? vfs.uniquePath(dirname(path), `${stem(path)}.png`) : path;
      await vfs.writeBytes(target, new Uint8Array(await blob.arrayBuffer()), blob.type);
      notify({ appId: 'photos', title: copy ? 'Saved a copy' : 'Photo saved', body: `${basename(target)} · metadata-free`, tone: 'success' });
      onSaved(target);
    } catch (e) { toast((e as Error).message, 'error'); } finally { setSaving(false); }
  };

  return (
    <div className="h-full flex">
      <div className="flex-1 bg-black/85 flex items-center justify-center p-6 relative min-w-0">
        {url && <img src={url} alt="" className="max-w-full max-h-full object-contain transition-all" style={{ filter: filterCss(a), transform: `rotate(${a.rotate}deg) scaleX(${a.flip ? -1 : 1})` }} />}
      </div>
      <div className="w-[270px] shrink-0 border-l border-line flex flex-col">
        <div className="h-12 flex items-center px-3 border-b border-line gap-2">
          <Sparkles size={15} className="text-accent" /><span className="font-semibold text-[13.5px] flex-1">Edit</span>
          <IconButton icon={X} onClick={onClose} />
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          <div>
            <div className="text-[12px] font-semibold text-muted mb-2">Filters</div>
            <div className="grid grid-cols-4 gap-1.5">
              {PRESETS.map((p) => (
                <button key={p.name} onClick={() => setA({ ...NEUTRAL, rotate: a.rotate, flip: a.flip, ...p.a })} className="flex flex-col items-center gap-1">
                  <div className="w-full aspect-square rounded-lg overflow-hidden bg-hover">{url && <img src={url} alt="" className="w-full h-full object-cover" style={{ filter: filterCss({ ...NEUTRAL, ...p.a }) }} />}</div>
                  <span className="text-[10.5px] text-muted">{p.name}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" icon={RotateCw} onClick={() => set({ rotate: a.rotate + 90 })} className="flex-1">Rotate</Button>
            <Button size="sm" icon={FlipHorizontal} onClick={() => set({ flip: !a.flip })} className="flex-1">Flip</Button>
          </div>
          <div className="space-y-3.5">
            {sliders.map(([k, l, min, max]) => (
              <div key={k}>
                <div className="flex justify-between text-[12px] mb-1.5"><span>{l}</span><button onClick={() => set({ [k]: NEUTRAL[k] } as Partial<Adjust>)} className="text-faint tabular-nums hover:text-fg">{a[k] as number}</button></div>
                <Slider value={a[k] as number} min={min} max={max} onChange={(v) => set({ [k]: v } as Partial<Adjust>)} />
              </div>
            ))}
          </div>
        </div>
        <div className="p-3 border-t border-line space-y-2">
          <Button className="w-full" icon={RotateCw} variant="ghost" onClick={() => setA(NEUTRAL)}>Reset</Button>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => save(true)} loading={saving}>Save copy</Button>
            <Button className="flex-1" variant="primary" icon={Check} onClick={() => save(false)} loading={saving}>Save</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
