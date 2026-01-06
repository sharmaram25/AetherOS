
import React, { useState, useEffect } from 'react';
import { Wifi, Battery, Bluetooth } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';

interface SystemTrayProps {
  onClockClick?: () => void;
}

export const SystemTray: React.FC<SystemTrayProps> = ({ onClockClick }) => {
  const [time, setTime] = useState(new Date());
  const [batteryLevel, setBatteryLevel] = useState(100);
  const [isCharging, setIsCharging] = useState(false);
  const [btStatus, setBtStatus] = useState<'off' | 'scanning' | 'connected'>('off');
  const { accentColor } = useSettingsStore();

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Battery API
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        setBatteryLevel(battery.level * 100);
        setIsCharging(battery.charging);
        
        battery.addEventListener('levelchange', () => setBatteryLevel(battery.level * 100));
        battery.addEventListener('chargingchange', () => setIsCharging(battery.charging));
      });
    }
  }, []);

  const toggleBluetooth = async () => {
    if (btStatus !== 'off') {
        setBtStatus('off');
        return;
    }

    if ('bluetooth' in navigator) {
        try {
            setBtStatus('scanning');
            const device = await (navigator as any).bluetooth.requestDevice({
                acceptAllDevices: true,
            });
            if (device) setBtStatus('connected');
        } catch (e) {
            console.log("Bluetooth cancelled or failed");
            setBtStatus('off');
        }
    } else {
        alert("Bluetooth API not supported in this browser context.");
    }
  };

  return (
    <div className="h-full flex items-center px-1 gap-1">
       {/* Status Icons Area */}
       <div className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer group">
          <button onClick={toggleBluetooth} title="Bluetooth">
             <Bluetooth size={16} 
                className={btStatus === 'scanning' ? "animate-pulse" : ""} 
                style={{ color: btStatus !== 'off' ? accentColor : 'rgba(255,255,255,0.6)' }}
             />
          </button>
          
          <Wifi size={16} className="text-white" />
          
          <div className="flex items-center gap-1" title={`${Math.round(batteryLevel)}%`}>
             <div className="relative">
                <Battery size={16} className={isCharging ? "text-green-400" : "text-white"} />
                <div 
                    className="absolute top-[5px] left-[2px] h-[6px] bg-current rounded-[1px]" 
                    style={{ width: `${(batteryLevel / 100) * 10}px` }} 
                />
             </div>
          </div>
       </div>

       {/* Clock Area */}
       <button 
         onClick={onClockClick}
         className="flex flex-col items-end justify-center px-4 py-1 rounded-xl hover:bg-white/10 transition-colors cursor-pointer active:scale-95 text-right"
       >
          <div className="text-sm font-semibold text-white leading-tight">
             {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="text-[10px] text-white/60 leading-tight font-medium uppercase tracking-wide">
             {time.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
          </div>
       </button>
    </div>
  );
};
