
import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useWindowManager } from '../../store/useWindowManager';

const generateData = (prev: any[], tick: number, windowCount: number) => {
  const baseLoad = 20;
  const windowLoad = windowCount * 5;
  const randomFluctuation = Math.random() * 10;
  
  const newDataPoint = {
    name: tick.toString(),
    memory: Math.min(100, baseLoad + windowLoad + randomFluctuation),
    cpu: Math.min(100, (Math.random() * 30) + (windowCount * 2)),
  };

  const newData = [...prev, newDataPoint];
  if (newData.length > 20) newData.shift();
  return newData;
};

export const SystemMonitor = () => {
  const { windows } = useWindowManager();
  const [data, setData] = useState<any[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
      setData(prev => generateData(prev, tick, Object.keys(windows).length));
    }, 1000);
    return () => clearInterval(interval);
  }, [tick, windows]);

  return (
    <div className="h-full flex flex-col p-4 text-gray-200 gap-4">
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
                {data.length > 0 ? Math.round(data[data.length - 1].memory) : 0}%
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
                {data.length > 0 ? Math.round(data[data.length - 1].cpu) : 0}%
            </div>
        </div>
      </div>
      
      <div className="bg-black/20 rounded-lg p-3 text-xs font-mono space-y-1 border border-white/5">
        <div className="flex justify-between"><span>Processes:</span> <span className="text-white">{Object.keys(windows).length}</span></div>
        <div className="flex justify-between"><span>Kernel:</span> <span className="text-blue-400">Active</span></div>
        <div className="flex justify-between"><span>VFS Status:</span> <span className="text-green-400">Mounted</span></div>
      </div>
    </div>
  );
};

export default SystemMonitor;
