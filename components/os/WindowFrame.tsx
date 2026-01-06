
import React, { useRef, useEffect, useState } from 'react';
import { useWindowManager } from '../../store/useWindowManager';
import { useSettingsStore } from '../../stores/settingsStore';
import { WindowState } from '../../types';
import { motion } from 'framer-motion';
import { SPRING_TRANSITION } from '../../utils/MotionConfig';

interface WindowFrameProps {
  windowState: WindowState;
  children: React.ReactNode;
}

export const WindowFrame: React.FC<WindowFrameProps> = ({ windowState, children }) => {
  const { focusWindow, closeWindow, minimizeWindow, maximizeWindow, restoreWindow, updateWindow } = useWindowManager();
  const { accentColor, blurStrength } = useSettingsStore();

  const windowRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; initialLeft: number; initialTop: number } | null>(null);
  
  const isActive = useWindowManager((state) => state.activeWindowId === windowState.id);
  const isMaximized = windowState.isMaximized;
  const [snapPreview, setSnapPreview] = useState<'left' | 'right' | 'full' | null>(null);

  useEffect(() => {
    if (windowRef.current && !isMaximized) {
      windowRef.current.style.transform = `translate(${windowState.position.x}px, ${windowState.position.y}px)`;
      windowRef.current.style.width = `${windowState.size.width}px`;
      windowRef.current.style.height = `${windowState.size.height}px`;
    }
  }, [windowState.position, windowState.size, isMaximized]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    focusWindow(windowState.id);
    if (isMaximized || (e.target as HTMLElement).closest('button')) return;
    
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const initialLeft = windowState.position.x;
    const initialTop = windowState.position.y;
    dragRef.current = { startX, startY, initialLeft, initialTop };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!dragRef.current || !windowRef.current) return;
      const deltaX = moveEvent.clientX - dragRef.current.startX;
      const deltaY = moveEvent.clientY - dragRef.current.startY;
      const newX = dragRef.current.initialLeft + deltaX;
      const newY = dragRef.current.initialTop + deltaY;
      
      windowRef.current.style.transform = `translate(${newX}px, ${newY}px)`;

      // Snap Detection
      if (moveEvent.clientX < 20) setSnapPreview('left');
      else if (moveEvent.clientX > window.innerWidth - 20) setSnapPreview('right');
      else if (moveEvent.clientY < 20) setSnapPreview('full');
      else setSnapPreview(null);
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      if (snapPreview) {
        if (snapPreview === 'left') updateWindow(windowState.id, { position: { x: 0, y: 0 }, size: { width: window.innerWidth / 2, height: window.innerHeight - 80 } });
        if (snapPreview === 'right') updateWindow(windowState.id, { position: { x: window.innerWidth / 2, y: 0 }, size: { width: window.innerWidth / 2, height: window.innerHeight - 80 } });
        if (snapPreview === 'full') maximizeWindow(windowState.id);
      } else if (dragRef.current) {
        const deltaX = upEvent.clientX - dragRef.current.startX;
        const deltaY = upEvent.clientY - dragRef.current.startY;
        updateWindow(windowState.id, { position: { x: dragRef.current.initialLeft + deltaX, y: dragRef.current.initialTop + deltaY } });
      }
      setSnapPreview(null);
      dragRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  if (windowState.isMinimized) return null;

  return (
    <>
      {isActive && snapPreview && (
        <div className={`fixed z-[9900] bg-white/10 backdrop-blur-md border border-white/20 rounded-xl transition-all duration-200 pointer-events-none ${snapPreview === 'full' ? 'inset-4 bottom-20' : snapPreview === 'left' ? 'top-4 left-4 bottom-20 w-[48%]' : 'top-4 right-4 bottom-20 w-[48%]'}`} />
      )}

      <motion.div
        layoutId={windowState.id} // Morph from Dock Icon
        transition={SPRING_TRANSITION}
        initial={false}
        className={`absolute flex flex-col overflow-hidden transition-shadow duration-300
          ${isActive ? 'shadow-[0_0_50px_rgba(0,0,0,0.4)] z-50' : 'shadow-2xl z-0 opacity-95 grayscale-[0.3]'}
          ${isMaximized ? '!transform-none !inset-0 !w-full !h-full !rounded-none' : 'rounded-lg border border-white/10'}
        `}
        style={{ 
            zIndex: windowState.zIndex,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: `blur(${blurStrength}px)`,
        }}
        ref={windowRef}
      >
        {/* Transparent Header */}
        <div
          onMouseDown={handleMouseDown}
          onDoubleClick={() => isMaximized ? restoreWindow(windowState.id) : maximizeWindow(windowState.id)}
          className="h-10 flex items-center justify-between px-4 select-none cursor-default bg-white/5"
        >
          <div className="text-xs font-medium tracking-widest text-white/40 uppercase flex items-center gap-2">
            <div 
              className="w-2 h-2 rounded-full transition-colors" 
              style={{ 
                  backgroundColor: isActive ? accentColor : 'rgba(255,255,255,0.2)',
                  boxShadow: isActive ? `0 0 8px ${accentColor}80` : 'none'
              }} 
            />
            {windowState.title}
          </div>
          <div className="flex items-center gap-3">
             <button onClick={(e) => { e.stopPropagation(); minimizeWindow(windowState.id); }} className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white">─</button>
             <button onClick={(e) => { e.stopPropagation(); isMaximized ? restoreWindow(windowState.id) : maximizeWindow(windowState.id); }} className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white">□</button>
             <button onClick={(e) => { e.stopPropagation(); closeWindow(windowState.id); }} className="w-8 h-8 flex items-center justify-center hover:bg-red-500/20 hover:text-red-400 rounded-full transition-colors text-white/50">×</button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 relative overflow-hidden">
          {!isActive && <div className="absolute inset-0 z-40" onMouseDown={() => focusWindow(windowState.id)} />}
          {children}
        </div>
      </motion.div>
    </>
  );
};
