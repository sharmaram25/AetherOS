
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useWindowManager } from '../../store/useWindowManager';

interface MonitorPoint {
  name: string;
  memory: number;
  cpu: number;
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const generateData = (prev: MonitorPoint[], tick: number, windowCount: number, usedMemoryMB: number) => {
  const baseLoad = 12;
  const windowLoad = windowCount * 4.2;
  const randomFluctuation = Math.random() * 7;
  const cpu = clamp(baseLoad + windowLoad + randomFluctuation + Math.sin(tick / 3) * 8, 1, 100);
  const memoryFromBrowser = usedMemoryMB ? clamp((usedMemoryMB / 1024) * 100, 1, 100) : 0;
  const syntheticMemory = clamp(18 + (windowCount * 3.5) + Math.cos(tick / 4) * 6 + Math.random() * 5, 1, 100);

  const newDataPoint: MonitorPoint = {
    name: tick.toString(),
    memory: memoryFromBrowser || syntheticMemory,
    cpu,
  };

  const newData = [...prev, newDataPoint];
  if (newData.length > 40) newData.shift();
  return newData;
};

export const SystemMonitor = () => {
  const windowCount = useWindowManager((state) => Object.keys(state.windows).length);
  const [data, setData] = useState<MonitorPoint[]>([]);
  const [tick, setTick] = useState(0);
  const [uptimeSec, setUptimeSec] = useState(0);
  const [fps, setFps] = useState(60);
  const [usedMemoryMB, setUsedMemoryMB] = useState(0);
  const startedAtRef = useRef(Date.now());
  const tickRef = useRef(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      tickRef.current += 1;
      setTick(tickRef.current);
      setUptimeSec(Math.floor((Date.now() - startedAtRef.current) / 1000));

      const perfWithMemory = performance as Performance & {
        memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
      };

      if (perfWithMemory.memory) {
        setUsedMemoryMB(Math.round(perfWithMemory.memory.usedJSHeapSize / 1024 / 1024));
      }

      const frameNoise = Math.random() * 4;
      setFps(Math.round(clamp(60 - frameNoise - windowCount * 0.8, 24, 60)));

      setData((prev) => generateData(prev, tickRef.current, windowCount, usedMemoryMB));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [windowCount, usedMemoryMB]);

  const latest = data[data.length - 1] || { cpu: 0, memory: 0 };
  const uptimeLabel = useMemo(() => {
    const hrs = Math.floor(uptimeSec / 3600);
    const mins = Math.floor((uptimeSec % 3600) / 60);
    const secs = uptimeSec % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, [uptimeSec]);

  return (
    <div className="h-full flex flex-col p-4 text-gray-200 gap-4">
      <div className="grid grid-cols-4 gap-2">
        <StatTile label="Processes" value={windowCount.toString()} tone="text-white" />
        <StatTile label="Uptime" value={uptimeLabel} tone="text-blue-300" />
        <StatTile label="FPS" value={`${fps}`} tone="text-emerald-300" />
        <StatTile label="Heap" value={usedMemoryMB ? `${usedMemoryMB} MB` : 'N/A'} tone="text-purple-300" />
      </div>

      <div className="grid grid-cols-2 gap-4 h-full">
        <div className="bg-black/20 rounded-lg p-2 flex flex-col border border-white/5">
            <h3 className="text-xs uppercase tracking-widest text-gray-500 mb-2">Memory Usage</h3>
            <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                    <defs>
                    <linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                    </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                    <XAxis hide />
                    <YAxis hide domain={[0, 100]} />
                    <Area type="monotone" dataKey="memory" stroke="#8884d8" fillOpacity={1} fill="url(#colorMem)" isAnimationActive={false} />
                </AreaChart>
                </ResponsiveContainer>
            </div>
            <div className="text-right text-xl font-bold mt-2 font-mono text-purple-300">
              {Math.round(latest.memory)}%
            </div>
        </div>

        <div className="bg-black/20 rounded-lg p-2 flex flex-col border border-white/5">
            <h3 className="text-xs uppercase tracking-widest text-gray-500 mb-2">CPU Load</h3>
            <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                    <defs>
                    <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#82ca9d" stopOpacity={0}/>
                    </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                    <XAxis hide />
                    <YAxis hide domain={[0, 100]} />
                    <Area type="monotone" dataKey="cpu" stroke="#82ca9d" fillOpacity={1} fill="url(#colorCpu)" isAnimationActive={false} />
                </AreaChart>
                </ResponsiveContainer>
            </div>
            <div className="text-right text-xl font-bold mt-2 font-mono text-green-300">
                {Math.round(latest.cpu)}%
            </div>
        </div>
      </div>
      
      <div className="bg-black/20 rounded-lg p-3 text-xs font-mono space-y-1 border border-white/5">
        <div className="flex justify-between"><span>Processes:</span> <span className="text-white">{windowCount}</span></div>
        <div className="flex justify-between"><span>Kernel:</span> <span className="text-blue-400">Active</span></div>
        <div className="flex justify-between"><span>VFS Status:</span> <span className="text-green-400">Mounted</span></div>
        <div className="flex justify-between"><span>Sampling:</span> <span className="text-white/80">1s / 40-point window</span></div>
      </div>
    </div>
  );
};

const StatTile = ({ label, value, tone }: { label: string; value: string; tone: string }) => (
  <div className="bg-black/20 rounded-lg p-2 border border-white/5">
    <div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div>
    <div className={`text-sm font-mono mt-1 ${tone}`}>{value}</div>
  </div>
);

export default SystemMonitor;
