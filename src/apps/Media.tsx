import { useEffect, useMemo, useRef, useState } from 'react';
import { Music, Video, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, Volume2, VolumeX, Upload, Disc3, ListMusic } from 'lucide-react';
import type { AppProps } from '../kernel/registry';
import { useVfs, vfs, type FsNode } from '../kernel/vfs';
import { wm } from '../kernel/windows';
import { importHostFiles, pickHostFiles } from '../kernel/launcher';
import { HOME, TRASH, isInside, stem, basename, dirname } from '../lib/path';
import { kindOf } from '../lib/mime';
import { formatDuration } from '../lib/format';
import { Button, IconButton, SidebarItem, SectionLabel, Empty, Slider, cx } from '../ui';

export default function Media({ win }: AppProps) {
  const nodes = useVfs((s) => s.nodes);
  const [tab, setTab] = useState<'audio' | 'video'>('audio');
  const [current, setCurrent] = useState<string | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [vol, setVol] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<'off' | 'all' | 'one'>('all');
  const mediaRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtx = useRef<{ ctx: AudioContext; analyser: AnalyserNode; el: HTMLMediaElement } | null>(null);

  const library = useMemo(() => Object.values(nodes).filter((n) => n.kind === 'file' && !isInside(n.path, TRASH) && kindOf(n.path) === tab).sort((a, b) => a.name.localeCompare(b.name)), [nodes, tab]);
  const isVideo = current ? kindOf(current) === 'video' : false;

  useEffect(() => {
    const p = win.data?.path as string | undefined;
    if (p) { setTab(kindOf(p) === 'video' ? 'video' : 'audio'); void play(p); }
  }, [win.data?._n]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { if (src) URL.revokeObjectURL(src); }, [src]);
  useEffect(() => () => { audioCtx.current?.ctx.close(); }, []);
  useEffect(() => { if (mediaRef.current) { mediaRef.current.volume = vol; mediaRef.current.muted = muted; } }, [vol, muted, src]);
  useEffect(() => { wm.setTitle(win.id, current ? `${stem(current)} — Media` : 'Media'); }, [current, win.id]);

  async function play(path: string) {
    const url = await vfs.objectUrl(path);
    setSrc((old) => { if (old) URL.revokeObjectURL(old); return url; });
    setCurrent(path);
    setTime(0);
    requestAnimationFrame(() => { void mediaRef.current?.play().catch(() => {}); });
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: stem(path), artist: basename(dirname(path)), album: 'AetherOS' });
      navigator.mediaSession.setActionHandler('nexttrack', () => next(1));
      navigator.mediaSession.setActionHandler('previoustrack', () => next(-1));
    }
  }

  const queue = current ? Object.values(nodes).filter((n) => n.kind === 'file' && kindOf(n.path) === kindOf(current) && !isInside(n.path, TRASH)).sort((a, b) => a.name.localeCompare(b.name)) : library;
  function next(d: number) {
    if (!queue.length) return;
    const i = queue.findIndex((n) => n.path === current);
    const j = shuffle ? Math.floor(Math.random() * queue.length) : i + d;
    if (j >= queue.length && repeat === 'off') { setPlaying(false); return; }
    void play(queue[(j + queue.length) % queue.length].path);
  }

  const toggle = () => {
    const m = mediaRef.current;
    if (!m) return;
    if (!current && library[0]) { void play(library[0].path); return; }
    if (m.paused) void m.play(); else m.pause();
  };

  // Visualizer
  useEffect(() => {
    if (!playing || isVideo) return;
    const el = mediaRef.current!;
    if (!audioCtx.current || audioCtx.current.el !== el) {
      try {
        const ctx = new AudioContext();
        const source = ctx.createMediaElementSource(el);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        source.connect(analyser).connect(ctx.destination);
        audioCtx.current = { ctx, analyser, el };
      } catch { return; }
    }
    void audioCtx.current.ctx.resume();
    const { analyser } = audioCtx.current;
    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const c = canvasRef.current;
      if (!c) return;
      const g = c.getContext('2d')!;
      c.width = c.clientWidth * devicePixelRatio;
      c.height = c.clientHeight * devicePixelRatio;
      analyser.getByteFrequencyData(data);
      g.clearRect(0, 0, c.width, c.height);
      const n = 48, bw = c.width / n;
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
      for (let i = 0; i < n; i++) {
        const v = data[Math.floor((i / n) * data.length * 0.85)] / 255;
        const h = Math.max(4, v * c.height * 0.95);
        const grad = g.createLinearGradient(0, c.height, 0, c.height - h);
        grad.addColorStop(0, accent);
        grad.addColorStop(1, '#ec4899');
        g.fillStyle = grad;
        g.beginPath();
        g.roundRect(i * bw + bw * 0.18, c.height - h, bw * 0.64, h, bw * 0.3);
        g.fill();
      }
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [playing, isVideo]);

  const importMedia = async () => {
    const files = await pickHostFiles({ accept: tab === 'audio' ? 'audio/*' : 'video/*' });
    if (files.length) await importHostFiles(files, `${HOME}/${tab === 'audio' ? 'Music' : 'Videos'}`);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 flex min-h-0">
        <div className="w-[260px] shrink-0 border-r border-line flex flex-col bg-hover/40">
          <div className="px-2">
            <SectionLabel>Library</SectionLabel>
            <SidebarItem icon={Music} label="Music" active={tab === 'audio'} onClick={() => setTab('audio')} count={Object.values(nodes).filter((n) => kindOf(n.path) === 'audio' && !isInside(n.path, TRASH)).length} />
            <SidebarItem icon={Video} label="Videos" active={tab === 'video'} onClick={() => setTab('video')} count={Object.values(nodes).filter((n) => kindOf(n.path) === 'video' && !isInside(n.path, TRASH)).length} />
            <SectionLabel action={<IconButton icon={Upload} size={13} className="w-6 h-6" label="Import" onClick={importMedia} />}>Tracks</SectionLabel>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-2">
            {library.length === 0 && <div className="text-[12px] text-faint px-2.5">No {tab === 'audio' ? 'music' : 'videos'} yet</div>}
            {library.map((n: FsNode) => (
              <button key={n.path} onDoubleClick={() => play(n.path)} onClick={() => play(n.path)} className={cx('w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left text-[12.5px]', current === n.path ? 'bg-accent/15 text-fg' : 'hover:bg-hover text-muted')}>
                {current === n.path && playing ? <Disc3 size={14} className="text-accent animate-spin shrink-0" style={{ animationDuration: '3s' }} /> : <ListMusic size={14} className="shrink-0" />}
                <span className="truncate">{stem(n.name)}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 min-w-0 flex flex-col items-center justify-center relative bg-gradient-to-b from-accent/10 to-transparent"
          onDragOver={(e) => e.preventDefault()} onDrop={async (e) => { e.preventDefault(); if (e.dataTransfer.files.length) { const p = await importHostFiles(e.dataTransfer.files, `${HOME}/${tab === 'audio' ? 'Music' : 'Videos'}`); if (p[0]) void play(p[0]); } }}>
          <video ref={mediaRef} src={src ?? undefined} className={cx(isVideo ? 'w-full h-full object-contain bg-black' : 'hidden')}
            onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
            onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)} onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
            onEnded={() => (repeat === 'one' ? void mediaRef.current?.play() : next(1))} onClick={toggle} />
          {!isVideo && (current ? (
            <div className="flex flex-col items-center gap-6 w-full max-w-md px-8">
              <div className={cx('w-56 h-56 rounded-3xl shadow-2xl flex items-center justify-center transition-transform duration-500', playing ? 'scale-100' : 'scale-95')} style={{ background: `linear-gradient(135deg, var(--accent), #ec4899)` }}>
                <Disc3 size={110} className={cx('text-white/90', playing && 'animate-spin')} style={{ animationDuration: '6s' }} />
              </div>
              <div className="text-center"><div className="text-[18px] font-semibold">{stem(current)}</div><div className="text-[13px] text-muted">{basename(dirname(current))}</div></div>
              <canvas ref={canvasRef} className="w-full h-16" />
            </div>
          ) : <Empty icon={Music} title="Nothing playing" body="Pick a track, or drop audio and video files here to import them (encrypted)." action={<Button icon={Upload} onClick={importMedia}>Import media</Button>} />)}
        </div>
      </div>
      <div className="h-[76px] shrink-0 border-t border-line flex items-center gap-4 px-5">
        <div className="flex items-center gap-1">
          <IconButton icon={Shuffle} active={shuffle} label="Shuffle" onClick={() => setShuffle(!shuffle)} />
          <IconButton icon={SkipBack} label="Previous" onClick={() => (time > 3 && mediaRef.current ? (mediaRef.current.currentTime = 0) : next(-1))} />
          <button onClick={toggle} className="w-11 h-11 rounded-full bg-accent text-accent-fg flex items-center justify-center shadow-lg shadow-accent/30 active:scale-95 transition-transform">{playing ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}</button>
          <IconButton icon={SkipForward} label="Next" onClick={() => next(1)} />
          <IconButton icon={repeat === 'one' ? Repeat1 : Repeat} active={repeat !== 'off'} label="Repeat" onClick={() => setRepeat(repeat === 'off' ? 'all' : repeat === 'all' ? 'one' : 'off')} />
        </div>
        <span className="text-[11.5px] text-muted tabular-nums w-11 text-right">{formatDuration(time * 1000)}</span>
        <div className="flex-1"><Slider value={time} min={0} max={dur || 1} step={0.1} onChange={(v) => { if (mediaRef.current) mediaRef.current.currentTime = v; setTime(v); }} /></div>
        <span className="text-[11.5px] text-muted tabular-nums w-11">{formatDuration((dur || 0) * 1000)}</span>
        <IconButton icon={muted || vol === 0 ? VolumeX : Volume2} onClick={() => setMuted(!muted)} />
        <div className="w-24"><Slider value={muted ? 0 : vol} min={0} max={1} step={0.01} onChange={(v) => { setVol(v); setMuted(false); }} /></div>
      </div>
    </div>
  );
}
