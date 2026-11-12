
import React from 'react';
import { motion } from 'framer-motion';
import { useWindowManager } from '../../store/useWindowManager';
import { AppId } from '../../types';
import { useSound } from '../../hooks/useSound';

interface AppIconProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  onClick?: () => void;
  isActive?: boolean;
  accentColor?: string;
}

export const AppIcon: React.FC<AppIconProps> = ({ id, title, icon, color, onClick, isActive = false, accentColor }) => {
  const { openWindow, windows } = useWindowManager();
  const { play } = useSound();
  
  // Check if window is open to handle "Morphing"
  // If open and NOT minimized, the icon effectively disappears (becomes the window)
  const isWindowOpen = windows[id] && !windows[id].isMinimized;

  const handleClick = () => {
    play('click');
    
    if (onClick) {
        onClick();
        return;
    }

    if (!isWindowOpen) play('open');
    openWindow(id as AppId, title);
  };

  return (
    <div className="relative w-12 h-12 flex items-center justify-center">
      {!isWindowOpen ? (
        <motion.button
          layoutId={id} // The Magic Morph Key
          onClick={handleClick}
          className="group relative w-12 h-12 flex items-center justify-center transition-all"
          whileHover={{ scale: 1.1, y: -2 }}
          whileTap={{ scale: 0.95 }}
        >
          <div
            className={`relative w-10 h-10 rounded-xl ${color} flex items-center justify-center text-white shadow-lg shadow-black/30 border border-white/10 transition-all duration-200 group-hover:border-white/20`}
            style={{ boxShadow: isActive && accentColor ? `0 0 0 1px ${accentColor}66, 0 12px 28px rgba(0,0,0,0.35)` : undefined }}
          >
            {icon}

            {isActive && (
              <span
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: accentColor || 'rgba(255,255,255,0.8)' }}
              />
            )}
          </div>
          
          {/* Tooltip */}
          <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900/90 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-white/10 backdrop-blur-md shadow-xl shadow-black/30">
            {title}
          </span>
        </motion.button>
      ) : (
        // Placeholder to keep spacing, but keeps interactions enabled for toggling
        <div 
            className="w-12 h-12 opacity-0 cursor-pointer" 
            onClick={handleClick}
        />
      )}
    </div>
  );
};
