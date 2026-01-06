
import React, { useMemo, useState } from 'react';
import { AppIcon } from './AppIcon';
import { motion, AnimatePresence } from 'framer-motion';
import { APP_REGISTRY } from '../../utils/appRegistry';
import { AppId } from '../../types';
import { useWindowManager } from '../../store/useWindowManager';
import { useSettingsStore } from '../../stores/settingsStore';
import { Grid } from 'lucide-react';
import { SystemTray } from './SystemTray';

interface DockProps {
  onNexusClick: () => void;
}

export const Dock: React.FC<DockProps> = ({ onNexusClick }) => {
  const { windows, activeWindowId, focusWindow, minimizeWindow, restoreWindow, openWindow } = useWindowManager();
  const { accentColor } = useSettingsStore();
  const [isHovering, setIsHovering] = useState(false);

  // Define pinned apps
  const pinnedApps: AppId[] = ['files', 'aether-text', 'terminal', 'lens', 'abacus'];

  // Combine pinned apps with currently open apps (deduplicated)
  const openAppIds = Object.values(windows).map(w => w.appId);
  const taskbarApps = Array.from(new Set([...pinnedApps, ...openAppIds]));

  // Check if any window is maximized
  const hasMaximizedWindow = useMemo(() => 
    Object.values(windows).some(w => w.isMaximized), 
  [windows]);

  // Logic: Hide if a window is maximized AND the user isn't hovering the dock area
  const shouldHide = hasMaximizedWindow && !isHovering;

  const handleTaskbarClick = (appId: AppId) => {
    // Find if there is an existing window for this app
    const windowId = Object.keys(windows).find(id => windows[id].appId === appId);
    
    if (windowId) {
       const win = windows[windowId];
       // If it is the active window and NOT minimized, minimize it (Toggle behavior)
       if (win.id === activeWindowId && !win.isMinimized) {
           minimizeWindow(win.id);
       } else {
           // Otherwise, bring it to front
           restoreWindow(win.id);
           focusWindow(win.id);
       }
    } else {
      // Not open? Launch it.
      openWindow(appId, APP_REGISTRY[appId].title);
    }
  };

  return (
    <>
      {/* 
         Proximity Sensor: 
         An invisible strip at the bottom of the screen to trigger the dock 
         when hidden.
      */}
      <div 
        className="fixed bottom-0 left-0 right-0 h-2 z-[99999]" 
        onMouseEnter={() => setIsHovering(true)}
      />

      {/* Container for Floating Decks */}
      <motion.div 
        className="fixed bottom-0 w-full flex justify-center items-end px-4 gap-4 pb-6 z-[10000]"
        animate={{ y: shouldHide ? '150%' : '0%' }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        
        {/* LEFT DECK: Apps & Nexus */}
        <div className="bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-2xl p-2 pl-3 shadow-2xl flex items-center gap-3 transition-all duration-300 hover:bg-slate-900/90 hover:scale-[1.01]">
            {/* Nexus Button */}
            <button 
                onClick={onNexusClick}
                className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all active:scale-95 group"
                style={{ color: accentColor }}
                title="Open Nexus"
            >
                <Grid size={24} className="group-hover:rotate-90 transition-transform duration-300" />
            </button>

            <div className="w-[1px] h-8 bg-white/10" />

            {/* App Icons */}
            <div className="flex items-center gap-1">
                {taskbarApps.map((id) => {
                    const isOpen = Object.values(windows).some(w => w.appId === id);
                    const isActive = Object.values(windows).some(w => w.appId === id && w.id === activeWindowId && !w.isMinimized);

                    return (
                    <div key={id} className="relative flex flex-col items-center justify-center h-full px-1 group">
                        <AppIcon 
                            id={id} 
                            title={APP_REGISTRY[id].title} 
                            icon={APP_REGISTRY[id].icon} 
                            color="bg-transparent" 
                            onClick={() => handleTaskbarClick(id)}
                        />
                        
                        {/* Indicators */}
                        {isOpen && (
                            <motion.div 
                                layoutId={`indicator-${id}`}
                                className="absolute -bottom-1 w-1 h-1 rounded-full transition-all"
                                style={{ 
                                    backgroundColor: isActive ? accentColor : 'rgba(255,255,255,0.2)',
                                    boxShadow: isActive ? `0 0 8px ${accentColor}` : 'none'
                                }}
                            />
                        )}
                    </div>
                    );
                })}
            </div>
        </div>

        {/* RIGHT DECK: System Tray */}
        <div className="bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-2xl p-2 shadow-2xl transition-all duration-300 hover:bg-slate-900/90 hover:scale-[1.01]">
            <SystemTray onClockClick={() => openWindow('chronos', 'Chronos')} />
        </div>

      </motion.div>
    </>
  );
};
