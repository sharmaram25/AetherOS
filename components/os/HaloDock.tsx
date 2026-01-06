
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, FileText, Share2, Sparkles, Activity, Bot, Grid } from 'lucide-react';
import { useWindowManager } from '../../store/useWindowManager';

interface HaloDockProps {
  onNexusClick: () => void;
}

export const HaloDock: React.FC<HaloDockProps> = ({ onNexusClick }) => {
  const { openWindow } = useWindowManager();
  const [isOpen, setIsOpen] = useState(false);

  const apps = [
    { id: 'terminal', title: 'Terminal', icon: <Terminal size={20} />, color: 'bg-gray-800' },
    { id: 'aether-text', title: 'Text', icon: <FileText size={20} />, color: 'bg-blue-600' },
    { id: 'wormhole', title: 'Share', icon: <Share2 size={20} />, color: 'bg-indigo-600' },
    { id: 'image-filter', title: 'WASM', icon: <Sparkles size={20} />, color: 'bg-pink-600' },
    { id: 'system-monitor', title: 'Sys', icon: <Activity size={20} />, color: 'bg-green-600' },
    { id: 'cortex', title: 'AI', icon: <Bot size={20} />, color: 'bg-purple-600' },
  ];

  return (
    <div 
      className="fixed bottom-10 right-10 z-[10000] flex flex-col items-end"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <div className="relative w-16 h-16">
        {/* Main Knob */}
        <motion.button
          onClick={onNexusClick}
          className="absolute inset-0 bg-white/10 backdrop-blur-md border border-white/20 rounded-full shadow-2xl flex items-center justify-center text-white z-20"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          animate={{ rotate: isOpen ? 45 : 0 }}
        >
           <Grid size={24} />
        </motion.button>

        {/* Halo Ring Indicator */}
        <motion.div 
            className="absolute inset-[-10px] rounded-full border border-white/10 z-10"
            animate={{ scale: isOpen ? 1.5 : 1, opacity: isOpen ? 1 : 0 }}
        />

        {/* Radial Items */}
        <AnimatePresence>
          {isOpen && apps.map((app, index) => {
             // Calculate position on a quarter circle (top-left of the button)
             const totalAngle = 90; // Degrees
             const startAngle = 180; // Start from left
             const step = totalAngle / (apps.length - 1);
             const angle = startAngle + (index * step);
             const radian = (angle * Math.PI) / 180;
             const radius = 100; // Distance from center

             const x = Math.cos(radian) * radius;
             const y = Math.sin(radian) * radius;

             return (
               <motion.button
                 key={app.id}
                 initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                 animate={{ x, y, opacity: 1, scale: 1 }}
                 exit={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                 transition={{ type: "spring", stiffness: 300, damping: 20, delay: index * 0.05 }}
                 onClick={() => openWindow(app.id as any, app.title)}
                 className={`absolute inset-0 w-10 h-10 rounded-full ${app.color} flex items-center justify-center text-white shadow-lg border border-white/20 hover:brightness-125 z-0`}
                 title={app.title}
               >
                 {app.icon}
               </motion.button>
             );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default HaloDock;
