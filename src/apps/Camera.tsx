import { useEffect, useRef, useState } from 'react';
import { Camera as CamIcon, Video, FlipHorizontal, Timer, CameraOff, ShieldCheck, Circle, Square, Images, RefreshCw } from 'lucide-react';
import type { AppProps } from '../kernel/registry';
import { requestPermission, trackStream } from '../kernel/privacy';
import { vfs } from '../kernel/vfs';
import { wm, useWindows } from '../kernel/windows';
import { notify, toast } from '../kernel/notify';
import { HOME } from '../lib/path';
import { sound } from '../lib/sound';
import { Button, Segmented, IconButton, cx, useObjectUrl } from '../ui';

const FILTERS: [string, string][] = [['None', 'none'], ['Vivid', 'saturate(1.5) contrast(1.1)'], ['Mono', 'grayscale(1) contrast(1.15)'], ['Warm', 'sepia(.35) saturate(1.3)'], ['Cool', 'hue-rotate(170deg) saturate(.9)'], ['Noir', 'grayscale(1) contrast(1.6) brightness(.9)'], ['Dream', 'saturate(1.3) blur(.6px) brightness(1.08)']];

export default function Camera({ win }: AppProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const [state, setState] = useState<'idle' | 'asking' | 'live' | 'denied' | 'error'>('idle');
  const [mode, setMode] = useState<'photo' | 'video'>('photo');
  const [filter, setFilter] = useState(0);
  const [mirror, setMirror] = useState(true);
  const [timer, setTimer] = useState(0);
  const [count, setCount] = useState(0);
  const [recording, setRecording] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [last, setLast] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceIdx, setDeviceIdx] = useState(0);
  const [, tick] = useState(0);
  const lastUrl = useObjectUrl(last && last.match(/\.(png|jpe?g)$/) ? () => vfs.objectUrl(last) : null, [last]);
  const active = useWindows((s) => s.activeId === win.id);

  const start = async (idx = deviceIdx) => {
    setState('asking');
    if (!(await requestPermission('camera', 'camera', 'Camera needs your webcam to take photos and videos. Captures are saved encrypted to your Pictures and Videos.'))) { setState('denied'); return; }
    try {
      stopRef.current?.();
      const devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
      setDevices(devs);
      const stream = await navigator.mediaDevices.getUserMedia({ video: devs[idx] ? { deviceId: devs[idx].deviceId, width: { ideal: 1920 }, height: { ideal: 1080 } } : { width: { ideal: 1920 } }, audio: mode === 'video' });
      stopRef.current = trackStream('camera', stream);
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}); }
      setState('live');
    } catch (e) {
      setState((e as Error).name === 'NotAllowedError' ? 'denied' : 'error');
    }
  };
  const stop = () => { stopRef.current?.(); stopRef.current = null; if (videoRef.current) videoRef.current.srcObject = null; setState('idle'); };

  useEffect(() => () => { recRef.current?.state === 'recording' && recRef.current.stop(); stopRef.current?.(); }, []);
  // Release the camera when switching modes so the mic is only requested for video.
  useEffect(() => { if (state === 'live') void start(); }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!recording) return; const id = setInterval(() => tick((x) => x + 1), 500); return () => clearInterval(id); }, [recording]);

  const snap = async () => {
    const v = videoRef.current!;
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    const g = c.getContext('2d')!;
    g.filter = FILTERS[filter][1];
    if (mirror) { g.translate(c.width, 0); g.scale(-1, 1); }
    g.drawImage(v, 0, 0);
    const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.92));
    const name = `Photo ${new Date().toISOString().slice(0, 19).replace('T', ' ').replace(/:/g, '.')}.jpg`;
    const p = vfs.uniquePath(`${HOME}/Pictures/Camera`, name);
    await vfs.writeBytes(p, new Uint8Array(await blob.arrayBuffer()), 'image/jpeg');
    setFlash(true);
    setTimeout(() => setFlash(false), 180);
    sound('click', 0.12);
    setLast(p);
  };

  const shutter = async () => {
    if (mode === 'video') {
      if (recRef.current?.state === 'recording') { recRef.current.stop(); return; }
      const stream = videoRef.current!.srcObject as MediaStream;
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : 'video/webm';
      const rec = new MediaRecorder(stream, { mimeType: mime });
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = async () => {
        setRecording(null);
        const blob = new Blob(chunks, { type: 'video/webm' });
        const p = vfs.uniquePath(`${HOME}/Videos`, `Video ${new Date().toISOString().slice(0, 19).replace('T', ' ').replace(/:/g, '.')}.webm`);
        await vfs.writeBytes(p, new Uint8Array(await blob.arrayBuffer()), 'video/webm');
        setLast(p);
        notify({ appId: 'camera', title: 'Video saved', body: 'Encrypted and stored in Videos.', tone: 'success', actions: [{ label: 'Play', run: () => wm.open('media', { path: p }) }] });
      };
      rec.start(1000);
      recRef.current = rec;
      setRecording(Date.now());
      return;
    }
    if (timer) {
      for (let i = timer; i > 0; i--) { setCount(i); sound('click', 0.05); await new Promise((r) => setTimeout(r, 1000)); }
      setCount(0);
    }
    await snap();
  };

  useEffect(() => {
    if (!active || state !== 'live') return;
    const k = (e: KeyboardEvent) => { if (e.code === 'Space' && !e.altKey && (e.target as HTMLElement).tagName !== 'INPUT') { e.preventDefault(); void shutter(); } };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  return (
    <div className="h-full flex flex-col bg-black text-white">
      <div className="flex-1 relative overflow-hidden flex items-center justify-center min-h-0">
        <video ref={videoRef} muted playsInline className={cx('w-full h-full object-cover', state !== 'live' && 'hidden')} style={{ filter: FILTERS[filter][1], transform: mirror ? 'scaleX(-1)' : undefined }} />
        {state !== 'live' && (
          <div className="text-center px-8 max-w-sm">
            <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-4">{state === 'denied' ? <CameraOff size={28} /> : <CamIcon size={28} />}</div>
            <div className="text-[16px] font-semibold">{state === 'denied' ? 'Camera access denied' : state === 'error' ? 'No camera available' : 'Camera is off'}</div>
            <div className="text-[12.5px] text-white/60 mt-1.5">{state === 'denied' ? 'You can change this in Shield → Permissions, or in your browser\'s site settings.' : 'The camera only turns on when you ask. A green indicator appears in the menu bar while it\'s in use.'}</div>
            <Button variant="primary" size="lg" className="mt-5" icon={state === 'idle' ? CamIcon : RefreshCw} loading={state === 'asking'} onClick={() => start()}>{state === 'idle' ? 'Turn on camera' : 'Try again'}</Button>
            <div className="text-[11px] text-white/40 mt-4 flex items-center justify-center gap-1.5"><ShieldCheck size={12} /> Photos never leave this device</div>
          </div>
        )}
        {flash && <div className="absolute inset-0 bg-white animate-fade-in" />}
        {count > 0 && <div className="absolute inset-0 flex items-center justify-center text-[120px] font-bold drop-shadow-2xl">{count}</div>}
        {recording && <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-red-600 text-[12.5px] font-semibold flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-white animate-pulse" />REC {Math.floor((Date.now() - recording) / 60000)}:{String(Math.floor(((Date.now() - recording) % 60000) / 1000)).padStart(2, '0')}</div>}
        {state === 'live' && (
          <div className="absolute top-3 right-3 flex gap-1.5">
            {devices.length > 1 && <IconButton icon={RefreshCw} label="Switch camera" className="!bg-black/40 !text-white" onClick={() => { const n = (deviceIdx + 1) % devices.length; setDeviceIdx(n); void start(n); }} />}
            <IconButton icon={FlipHorizontal} label="Mirror" active={mirror} className="!bg-black/40 !text-white" onClick={() => setMirror(!mirror)} />
            <IconButton icon={CameraOff} label="Turn off" className="!bg-black/40 !text-white" onClick={stop} />
          </div>
        )}
      </div>
      {state === 'live' && (
        <div className="shrink-0 bg-black/90 px-4 pt-3 pb-4">
          <div className="flex gap-1.5 justify-center mb-3 overflow-x-auto">
            {FILTERS.map(([n], i) => <button key={n} onClick={() => setFilter(i)} className={cx('px-3 h-7 rounded-full text-[12px] font-medium shrink-0', filter === i ? 'bg-white text-black' : 'bg-white/10 hover:bg-white/20')}>{n}</button>)}
          </div>
          <div className="flex items-center justify-between">
            <button onClick={() => last && (last.endsWith('.webm') ? wm.open('media', { path: last }) : wm.open('photos', { path: last }))} className="w-12 h-12 rounded-xl overflow-hidden bg-white/10 flex items-center justify-center border border-white/20">
              {lastUrl ? <img src={lastUrl} className="w-full h-full object-cover" alt="" /> : <Images size={18} className="text-white/60" />}
            </button>
            <button onClick={shutter} className="w-[68px] h-[68px] rounded-full border-4 border-white flex items-center justify-center active:scale-95 transition-transform">
              {mode === 'photo' ? <Circle size={52} className="fill-white text-white" /> : recording ? <Square size={26} className="fill-red-500 text-red-500" /> : <Circle size={52} className="fill-red-500 text-red-500" />}
            </button>
            <div className="flex flex-col items-end gap-2">
              <Segmented size="sm" value={mode} onChange={(m) => { if (!recording) setMode(m); }} options={[{ value: 'photo', label: '', icon: CamIcon }, { value: 'video', label: '', icon: Video }]} />
              {mode === 'photo' && <button onClick={() => setTimer(timer === 0 ? 3 : timer === 3 ? 10 : 0)} className={cx('text-[11.5px] flex items-center gap-1', timer ? 'text-amber-400' : 'text-white/60')}><Timer size={12} /> {timer ? `${timer}s` : 'Off'}</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { toast };
