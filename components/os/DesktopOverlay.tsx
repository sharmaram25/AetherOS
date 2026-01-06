
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettingsStore } from '../../stores/settingsStore';
import { Minus, Plus, Infinity as InfinityIcon } from 'lucide-react';

export const DesktopOverlay = () => {
  const [time, setTime] = useState(new Date());
  const { clockScale, setClockScale, accentColor } = useSettingsStore();
  const [showControls, setShowControls] = useState(false);
  const [format, setFormat] = useState<'minimal' | 'full'>('full');

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Time formatters
  const hours = time.toLocaleTimeString([], { hour: '2-digit', hour12: false }).split(':')[0];
  const minutes = time.toLocaleTimeString([], { minute: '2-digit' });
  const dayName = time.toLocaleDateString([], { weekday: 'long' });
  const dateStr = time.toLocaleDateString([], { month: 'long', day: 'numeric' });

  const handleScale = (delta: number) => {
    setClockScale(Math.min(2.0, Math.max(0.5, clockScale + delta)));
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-0 flex flex-col justify-between p-12 overflow-hidden">
      {/* Widget Container */}
      <div 
        className="mt-12 ml-6 pointer-events-auto relative inline-flex flex-col items-start group"
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => setShowControls(false)}
      >
        {/* The Clock Face */}
        <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0, scale: clockScale }}
            className="origin-top-left"
        >
            <div className="flex flex-col leading-none text-white drop-shadow-2xl">
                {/* Hours / Minutes Stacked for impact */}
                <div className="flex items-baseline gap-4">
                    <span className="font-bold tracking-tighter text-[8rem] bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
                        {hours}
                    </span>
                    <span className="font-light tracking-tighter text-[8rem] text-white/40">
                        {minutes}
                    </span>
                </div>
                
                {format === 'full' && (
                    <div className="text-2xl font-medium tracking-wide text-white/80 pl-2 -mt-4 uppercase">
                        {dayName}, <span style={{ color: accentColor }} className="font-bold opacity-90">{dateStr}</span>
                    </div>
                )}
            </div>
        </motion.div>

        {/* Minimal Control Pill (Appears on Hover) */}
        <AnimatePresence>
            {showControls && (
                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute -bottom-14 left-0 bg-black/40 backdrop-blur-md border border-white/10 rounded-full p-1 flex items-center gap-1"
                >
                    <button 
                        onClick={() => handleScale(-0.1)} 
                        className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
                    >
                        <Minus size={14} />
                    </button>
                    
                    <div className="w-[1px] h-4 bg-white/10 mx-1" />
                    
                    <button 
                        onClick={() => setFormat(f => f === 'full' ? 'minimal' : 'full')}
                        className="px-3 h-8 rounded-full hover:bg-white/10 text-xs font-medium text-white/80 transition-colors"
                    >
                        {format === 'full' ? 'Detailed' : 'Simple'}
                    </button>

                    <div className="w-[1px] h-4 bg-white/10 mx-1" />

                    <button 
                        onClick={() => handleScale(0.1)} 
                        className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
                    >
                        <Plus size={14} />
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
      </div>

      {/* Creative Quote Container - Center Screen */}
      <div className="absolute top-[35%] left-0 right-0 flex flex-col items-center justify-center text-center">
         <motion.div
            initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 1.5, delay: 0.5 }}
            className="flex flex-col items-center"
         >
            <p className="text-lg md:text-xl font-light tracking-[0.4em] text-white/60 uppercase mb-2">
                As long as I live
            </p>
            <div className="flex items-center gap-4">
                <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-white/20" />
                <p className="text-sm font-serif italic text-white/40">
                    there are
                </p>
                <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-white/20" />
            </div>
         </motion.div>

         <motion.div
            initial={{ scale: 0, opacity: 0, rotate: -90 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 50, damping: 20, delay: 1.2 }}
            className="relative my-6"
         >
             {/* The Icon */}
             <InfinityIcon
                size={160}
                strokeWidth={0.5}
                className="text-white opacity-90"
                style={{
                    filter: `drop-shadow(0 0 40px ${accentColor}80)`
                }}
             />
             {/* Inner Glow Duplicate */}
             <InfinityIcon
                size={160}
                strokeWidth={1}
                className="absolute inset-0 opacity-50 blur-sm"
                style={{ color: accentColor }}
             />
         </motion.div>

         <motion.h1
            initial={{ opacity: 0, letterSpacing: '0em', y: 20 }}
            animate={{ opacity: 1, letterSpacing: '0.3em', y: 0 }}
            transition={{ duration: 1.5, delay: 1.8, ease: "easeOut" }}
            className="text-4xl md:text-6xl font-bold text-white/90"
            style={{ textShadow: '0 10px 40px rgba(0,0,0,0.5)' }}
         >
            POSSIBILITIES
         </motion.h1>
      </div>
    </div>
  );
};

export default DesktopOverlay;
