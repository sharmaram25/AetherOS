
import React, { useState, useEffect, useRef } from 'react';
import { AppProps } from '../../types';
import { Clock, Hourglass, Timer as TimerIcon, Watch, Bell, Plus, Trash2 } from 'lucide-react';
import { useNotificationStore } from '../os/NotificationCenter';

type Tab = 'clock' | 'stopwatch' | 'timer' | 'alarm';
type Design = 'analog' | 'digital' | 'hybrid';

interface Alarm {
  id: string;
  time: string; // HH:MM
  label: string;
  active: boolean;
}

export const Chronos: React.FC<AppProps> = () => {
  const [activeTab, setActiveTab] = useState<Tab>('clock');
  const [design, setDesign] = useState<Design>('hybrid');
  
  return (
    <div className="h-full flex flex-col bg-slate-900 text-white relative overflow-hidden">
       {/* Tab Bar */}
       <div className="flex items-center justify-center p-2 gap-1 bg-black/20 border-b border-white/5 shrink-0 z-10 relative">
           <TabButton active={activeTab === 'clock'} onClick={() => setActiveTab('clock')} icon={<Clock size={16} />} label="Clock" />
           <TabButton active={activeTab === 'alarm'} onClick={() => setActiveTab('alarm')} icon={<Bell size={16} />} label="Alarm" />
           <TabButton active={activeTab === 'stopwatch'} onClick={() => setActiveTab('stopwatch')} icon={<Watch size={16} />} label="Stopwatch" />
           <TabButton active={activeTab === 'timer'} onClick={() => setActiveTab('timer')} icon={<Hourglass size={16} />} label="Timer" />
       </div>

       <div className="flex-1 relative overflow-hidden w-full h-full">
           {activeTab === 'clock' && <ClockView design={design} onSwitchDesign={setDesign} />}
           {activeTab === 'alarm' && <AlarmView />}
           {activeTab === 'stopwatch' && <StopwatchView />}
           {activeTab === 'timer' && <TimerView />}
       </div>
    </div>
  );
};

const TabButton = ({ active, onClick, icon, label }: any) => (
    <button 
        onClick={onClick}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${active ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/80'}`}
    >
        {icon} <span className="hidden sm:inline">{label}</span>
    </button>
);

// --- ALARM VIEW ---
const AlarmView = () => {
  const [alarms, setAlarms] = useState<Alarm[]>(() => {
    const saved = localStorage.getItem('chronos_alarms');
    return saved ? JSON.parse(saved) : [];
  });
  const [newTime, setNewTime] = useState('08:00');
  const [newLabel, setNewLabel] = useState('Wake Up');
  const [isAdding, setIsAdding] = useState(false);
  const { addNotification } = useNotificationStore();

  useEffect(() => {
    localStorage.setItem('chronos_alarms', JSON.stringify(alarms));
  }, [alarms]);

  useEffect(() => {
    const interval = setInterval(() => {
        const now = new Date();
        const currentParams = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        
        alarms.forEach(alarm => {
            if (alarm.active && alarm.time === currentParams && now.getSeconds() === 0) {
                addNotification("Alarm", `${alarm.label} - ${alarm.time}`, "warning");
                // Play sound logic here could go here
            }
        });
    }, 1000);
    return () => clearInterval(interval);
  }, [alarms, addNotification]);

  const addAlarm = () => {
      setAlarms([...alarms, { id: Math.random().toString(), time: newTime, label: newLabel, active: true }]);
      setIsAdding(false);
  };

  const toggleAlarm = (id: string) => {
      setAlarms(alarms.map(a => a.id === id ? { ...a, active: !a.active } : a));
  };

  const deleteAlarm = (id: string) => {
      setAlarms(alarms.filter(a => a.id !== id));
  };

  return (
      <div className="h-full p-4 overflow-y-auto relative">
          {!isAdding && (
              <button 
                onClick={() => setIsAdding(true)}
                className="w-full py-3 border border-dashed border-white/20 rounded-xl flex items-center justify-center gap-2 text-white/50 hover:bg-white/5 hover:text-white transition-colors mb-4"
              >
                  <Plus size={16} /> Add Alarm
              </button>
          )}

          {isAdding && (
              <div className="bg-white/10 rounded-xl p-4 mb-4 animate-in fade-in slide-in-from-top-4">
                  <div className="flex gap-4 mb-4">
                      <input 
                        type="time" 
                        value={newTime} 
                        onChange={e => setNewTime(e.target.value)}
                        className="bg-black/20 border border-white/10 rounded px-3 py-2 text-white focus:outline-none"
                      />
                      <input 
                        type="text" 
                        value={newLabel}
                        onChange={e => setNewLabel(e.target.value)}
                        placeholder="Label"
                        className="flex-1 bg-black/20 border border-white/10 rounded px-3 py-2 text-white focus:outline-none"
                      />
                  </div>
                  <div className="flex justify-end gap-2">
                      <button onClick={() => setIsAdding(false)} className="px-3 py-1 text-xs text-white/50 hover:text-white">Cancel</button>
                      <button onClick={addAlarm} className="px-3 py-1 bg-blue-600 rounded text-xs text-white">Save</button>
                  </div>
              </div>
          )}

          <div className="space-y-2">
              {alarms.map(alarm => (
                  <div key={alarm.id} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                      <div>
                          <div className={`text-2xl font-light ${alarm.active ? 'text-white' : 'text-white/30'}`}>{alarm.time}</div>
                          <div className="text-xs text-white/40">{alarm.label}</div>
                      </div>
                      <div className="flex items-center gap-4">
                          <button 
                            onClick={() => toggleAlarm(alarm.id)} 
                            className={`w-10 h-6 rounded-full relative transition-colors ${alarm.active ? 'bg-green-500' : 'bg-white/20'}`}
                          >
                              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${alarm.active ? 'left-5' : 'left-1'}`} />
                          </button>
                          <button onClick={() => deleteAlarm(alarm.id)} className="text-white/30 hover:text-red-400">
                              <Trash2 size={16} />
                          </button>
                      </div>
                  </div>
              ))}
              {alarms.length === 0 && !isAdding && (
                  <div className="text-center text-white/20 mt-10">No alarms set</div>
              )}
          </div>
      </div>
  );
};

// --- CLOCK VIEW ---
const ClockView = ({ design, onSwitchDesign }: { design: Design, onSwitchDesign: (d: Design) => void }) => {
    const [time, setTime] = useState(new Date());
    const requestRef = useRef<number>(0);

    const animate = () => {
        setTime(new Date());
        requestRef.current = requestAnimationFrame(animate);
    };

    useEffect(() => {
        requestRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(requestRef.current);
    }, []);

    const seconds = time.getSeconds() + time.getMilliseconds() / 1000;
    const minutes = time.getMinutes() + seconds / 60;
    const hours = (time.getHours() % 12) + minutes / 60;

    return (
        <div className="h-full flex flex-col items-center justify-center relative w-full overflow-hidden">
            <div className="absolute top-4 right-4 flex gap-2 z-20">
                {(['analog', 'digital', 'hybrid'] as Design[]).map(d => (
                    <button 
                        key={d} 
                        onClick={() => onSwitchDesign(d)}
                        className={`w-6 h-6 rounded-full border border-white/20 text-[8px] uppercase flex items-center justify-center ${design === d ? 'bg-white text-black' : 'text-white/50'}`}
                    >
                        {d[0]}
                    </button>
                ))}
            </div>

            {/* Analog / Hybrid Face */}
            {(design === 'analog' || design === 'hybrid') && (
                <div className="relative w-64 h-64 rounded-full border-4 border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl mb-8 shrink-0">
                    {/* Markers */}
                    {[...Array(12)].map((_, i) => (
                        <div key={i} className="absolute w-1 h-3 bg-white/30"
                            style={{ top: '10px', left: '50%', marginLeft: '-2px', transformOrigin: '50% 118px', transform: `rotate(${i * 30}deg)` }}
                        />
                    ))}
                    {/* Hands */}
                    <div className="absolute w-1.5 h-16 bg-white rounded-full origin-bottom left-1/2 -ml-[3px] top-[64px]" style={{ transform: `rotate(${hours * 30}deg)` }} />
                    <div className="absolute w-1 h-24 bg-white/80 rounded-full origin-bottom left-1/2 -ml-[2px] top-[32px]" style={{ transform: `rotate(${minutes * 6}deg)` }} />
                    <div className="absolute w-0.5 h-28 bg-red-500 rounded-full origin-bottom left-1/2 -ml-[1px] top-[16px]" style={{ transform: `rotate(${seconds * 6}deg)` }} />
                    <div className="absolute w-3 h-3 bg-red-500 rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 shadow-lg" />
                </div>
            )}

            {/* Digital Time */}
            {(design === 'digital' || design === 'hybrid') && (
                <div className="text-center shrink-0">
                    <h2 className="text-5xl font-thin tracking-wider tabular-nums">
                        {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </h2>
                    <p className="text-white/40 uppercase tracking-widest text-xs mt-2">
                        {time.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
                    </p>
                </div>
            )}
        </div>
    );
};

// --- STOPWATCH VIEW ---
const StopwatchView = () => {
    const [running, setRunning] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const startTimeRef = useRef(0);
    const requestRef = useRef(0);

    const update = () => {
        if (startTimeRef.current) {
            setElapsed(Date.now() - startTimeRef.current);
            requestRef.current = requestAnimationFrame(update);
        }
    };

    const toggle = () => {
        if (running) {
            setRunning(false);
            cancelAnimationFrame(requestRef.current);
        } else {
            setRunning(true);
            startTimeRef.current = Date.now() - elapsed;
            requestRef.current = requestAnimationFrame(update);
        }
    };

    const reset = () => {
        setRunning(false);
        cancelAnimationFrame(requestRef.current);
        setElapsed(0);
    };

    const formatTime = (ms: number) => {
        const mins = Math.floor(ms / 60000);
        const secs = Math.floor((ms % 60000) / 1000);
        const centis = Math.floor((ms % 1000) / 10);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${centis.toString().padStart(2, '0')}`;
    };

    return (
        <div className="h-full flex flex-col items-center justify-center gap-8 relative overflow-hidden">
            <div className="text-7xl font-mono tabular-nums font-light">{formatTime(elapsed)}</div>
            <div className="flex gap-4">
                <button onClick={toggle} className={`px-8 py-3 rounded-full text-lg font-medium transition-colors ${running ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'}`}>
                    {running ? 'Stop' : 'Start'}
                </button>
                <button onClick={reset} className="px-8 py-3 rounded-full text-lg font-medium bg-white/10 text-white hover:bg-white/20">
                    Reset
                </button>
            </div>
        </div>
    );
};

// --- TIMER VIEW ---
const TimerView = () => {
    const [timeLeft, setTimeLeft] = useState(300); 
    const [running, setRunning] = useState(false);
    const [initialTime, setInitialTime] = useState(300);
    
    useEffect(() => {
        let interval: any;
        if (running && timeLeft > 0) {
            interval = setInterval(() => setTimeLeft(t => t - 1), 1000);
        } else if (timeLeft === 0) {
            setRunning(false);
        }
        return () => clearInterval(interval);
    }, [running, timeLeft]);

    const format = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const setTimer = (m: number) => {
        setTimeLeft(m * 60);
        setInitialTime(m * 60);
        setRunning(false);
    };

    return (
        <div className="h-full flex flex-col items-center justify-center gap-8 relative overflow-hidden">
            <div className="flex gap-2 mb-4">
                {[1, 5, 10, 30].map(m => (
                    <button key={m} onClick={() => setTimer(m)} className="px-3 py-1 rounded bg-white/5 hover:bg-white/10 text-xs">
                        {m}m
                    </button>
                ))}
            </div>
            
            <div className="relative w-64 h-64 flex items-center justify-center shrink-0">
                 <svg className="absolute inset-0 w-full h-full -rotate-90">
                     <circle cx="128" cy="128" r="120" stroke="rgba(255,255,255,0.1)" strokeWidth="4" fill="none" />
                     <circle 
                        cx="128" cy="128" r="120" 
                        stroke="#3b82f6" 
                        strokeWidth="4" 
                        fill="none" 
                        strokeDasharray={753}
                        strokeDashoffset={753 - (753 * timeLeft) / initialTime} 
                        className="transition-all duration-1000 ease-linear"
                     />
                 </svg>
                 <div className="text-6xl font-mono tabular-nums">{format(timeLeft)}</div>
            </div>

            <button onClick={() => setRunning(!running)} className={`px-8 py-3 rounded-full text-lg font-medium ${running ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
                {running ? 'Pause' : 'Start'}
            </button>
        </div>
    );
};

export default Chronos;
