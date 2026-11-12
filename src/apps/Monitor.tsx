import { useEffect, useRef, useState } from 'react';
import { Gauge, Cpu, MemoryStick, HardDrive, Layers, X, Globe, Monitor as MonitorIcon } from 'lucide-react';
import type { AppProps } from '../kernel/registry';
import { getApp } from '../kernel/registry';
import { useWindows, wm } from '../kernel/windows';
import { useSession } from '../kernel/session';
import { useNetwork } from '../kernel/privacy';
import { vfs } from '../kernel/vfs';
import { formatBytes } from '../lib/mime';
import { AppGlyph, Card, IconButton, Segmented, cx } from '../ui';

const N = 60;

function Spark({ data, max, color, fill = true }: { data: number[]; max: number; color: string; fill?: boolean }) {
  const pts = data.map((v, i) => `${(i / (N - 1)) * 100},${40 - (Math.min(v, max) / max) * 38}`);
  const line = pts.join(' ');
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-16">
      {[10, 20, 30].map((y) => <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="var(--line)" strokeWidth="0.3" />)}
      {fill && <polygon points={`0,40 ${line} 100,40`} fill={color} opacity="0.15" />}
      <polyline points={line} fill="none" stroke={color} strokeWidth="1.2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

export default function Monitor(_p: AppProps) {
  const [tab, setTab] = useState<'perf' | 'proc'>('perf');
  const [fps, setFps] = useState<number[]>(Array(N).fill(0));
  const [lag, setLag] = useState<number[]>(Array(N).fill(0));
  const [heap, setHeap] = useState<number[]>(Array(N).fill(0));
  const [heapInfo, setHeapInfo] = useState<{ used: number; limit: number } | null>(null);
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const [dom, setDom] = useState(0);
  const { wins, order } = useWindows();
  const unlockedAt = useSession((s) => s.unlockedAt);
  const net = useNetwork();
  const frames = useRef(0);

  useEffect(() => {
    let raf = 0;
    const loop = () => { frames.current++; raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    let expected = performance.now() + 100;
    let maxLag = 0;
    const lagTimer = setInterval(() => { const now = performance.now(); maxLag = Math.max(maxLag, now - expected); expected = now + 100; }, 100);
    const sample = setInterval(async () => {
      setFps((f) => [...f.slice(1), frames.current]);
      frames.current = 0;
      setLag((l) => [...l.slice(1), Math.max(0, maxLag)]);
      maxLag = 0;
      const mem = (performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
      if (mem) { setHeap((h) => [...h.slice(1), mem.usedJSHeapSize / 1048576]); setHeapInfo({ used: mem.usedJSHeapSize, limit: mem.jsHeapSizeLimit }); }
      setDom(document.getElementsByTagName('*').length);
      const est = await navigator.storage?.estimate?.().catch(() => undefined);
      if (est) setStorage({ usage: est.usage ?? 0, quota: est.quota ?? 0 });
    }, 1000);
    return () => { cancelAnimationFrame(raf); clearInterval(lagTimer); clearInterval(sample); };
  }, []);

  const last = (a: number[]) => a[a.length - 1];
  const up = Math.floor((Date.now() - unlockedAt) / 1000);
  const conn = (navigator as Navigator & { connection?: { effectiveType?: string; downlink?: number } }).connection;
  const usage = vfs.usage();

  return (
    <div className="h-full flex flex-col">
      <div className="h-12 shrink-0 flex items-center justify-center border-b border-line">
        <Segmented value={tab} onChange={setTab} options={[{ value: 'perf', label: 'Performance', icon: Gauge }, { value: 'proc', label: `Processes · ${order.length}`, icon: Layers }]} />
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'perf' ? (
          <div className="grid grid-cols-2 gap-3">
            <Metric icon={MonitorIcon} title="Frame rate" value={`${last(fps)} fps`} sub={last(fps) >= 55 ? 'Smooth' : last(fps) >= 30 ? 'OK' : 'Struggling'}><Spark data={fps} max={Math.max(65, ...fps)} color="#22c55e" /></Metric>
            <Metric icon={Cpu} title="Main thread latency" value={`${last(lag).toFixed(0)} ms`} sub={`${navigator.hardwareConcurrency} logical cores`}><Spark data={lag} max={Math.max(50, ...lag)} color="#f59e0b" /></Metric>
            <Metric icon={MemoryStick} title="JavaScript memory" value={heapInfo ? formatBytes(heapInfo.used) : 'n/a'} sub={heapInfo ? `of ${formatBytes(heapInfo.limit)} limit` : 'Not exposed by this browser'}><Spark data={heap} max={Math.max(64, ...heap) * 1.2} color="#6366f1" /></Metric>
            <Metric icon={HardDrive} title="Encrypted storage" value={storage ? formatBytes(storage.usage) : '—'} sub={storage ? `${((storage.usage / Math.max(1, storage.quota)) * 100).toFixed(2)}% of ${formatBytes(storage.quota)}` : ''}>
              <div className="h-16 flex flex-col justify-center gap-2">
                <div className="h-2.5 rounded-full bg-line overflow-hidden"><div className="h-full bg-sky-500 rounded-full" style={{ width: `${Math.max(1, ((storage?.usage ?? 0) / Math.max(1, storage?.quota ?? 1)) * 100)}%` }} /></div>
                <div className="text-[11.5px] text-muted">{usage.files} files · {usage.dirs} folders · {formatBytes(usage.bytes)} plaintext</div>
              </div>
            </Metric>
            <Card className="p-4 col-span-2 grid grid-cols-4 gap-4 text-[12px]">
              {[['Uptime', `${Math.floor(up / 3600)}h ${Math.floor((up % 3600) / 60)}m`], ['Windows', String(order.length)], ['DOM nodes', dom.toLocaleString()], ['Display', `${screen.width}×${screen.height} @${devicePixelRatio}x`], ['Network', navigator.onLine ? (conn?.effectiveType?.toUpperCase() ?? 'Online') : 'Offline'], ['Requests', `${net.total} (${net.external} external)`], ['Device memory', (navigator as Navigator & { deviceMemory?: number }).deviceMemory ? `${(navigator as Navigator & { deviceMemory?: number }).deviceMemory} GB` : 'n/a'], ['WebGPU', 'gpu' in navigator ? 'Available' : 'Unavailable']].map(([k, v]) => (
                <div key={k}><div className="text-faint">{k}</div><div className="font-medium mt-0.5 truncate">{v}</div></div>
              ))}
            </Card>
          </div>
        ) : (
          <Card className="overflow-hidden">
            <div className="grid grid-cols-[1fr_90px_70px_90px_40px] gap-2 px-4 h-9 items-center border-b border-line text-[11.5px] text-faint font-medium">
              <span>Process</span><span>PID</span><span>Space</span><span>State</span><span />
            </div>
            {[...order].reverse().map((id) => {
              const w = wins[id];
              const app = getApp(w.appId);
              return (
                <div key={id} className="grid grid-cols-[1fr_90px_70px_90px_40px] gap-2 px-4 h-11 items-center border-b border-line last:border-0 text-[12.5px] hover:bg-hover">
                  <button className="flex items-center gap-2.5 min-w-0 text-left" onClick={() => wm.focus(id)}>{app && <AppGlyph app={app} size={22} />}<span className="truncate"><b className="font-medium">{app?.name}</b> <span className="text-muted">· {w.title}</span></span></button>
                  <span className="font-mono text-muted">{id.split('-').pop()}</span>
                  <span className="text-muted">{w.ws + 1}</span>
                  <span className={cx('capitalize', w.state === 'minimized' ? 'text-faint' : 'text-success')}>{w.state}</span>
                  <IconButton icon={X} size={13} label="End process" className="hover:!text-danger" onClick={() => wm.close(id, true)} />
                </div>
              );
            })}
            {!order.length && <div className="p-8 text-center text-faint text-[12.5px]">No running processes</div>}
          </Card>
        )}
        <div className="text-[11px] text-faint mt-3 flex items-center gap-1.5"><Globe size={11} /> All metrics are measured locally and never reported anywhere.</div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, title, value, sub, children }: { icon: typeof Cpu; title: string; value: string; sub?: string; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-[12px] text-muted"><Icon size={14} /> {title}</div>
      <div className="text-[24px] font-semibold tabular-nums mt-1">{value}</div>
      {sub && <div className="text-[11.5px] text-faint">{sub}</div>}
      <div className="mt-2">{children}</div>
    </Card>
  );
}
