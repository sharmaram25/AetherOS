
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderPlus, Image, RefreshCw, Trash2, Share2, FileText } from 'lucide-react';
import { useWindowManager } from '../../store/useWindowManager';
import { useFileSystem } from '../../store/useFileSystem';
import { useNotificationStore } from './NotificationCenter';

export const ContextMenu = () => {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [contextType, setContextType] = useState<'desktop' | 'file'>('desktop');
  const [targetFile, setTargetFile] = useState<string | null>(null);

  const { openWindow } = useWindowManager();
  const { addNotification } = useNotificationStore();
  const { mkdir } = useFileSystem();

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      
      const target = e.target as HTMLElement;
      const fileElement = target.closest('[data-file-path]');
      
      if (fileElement) {
        setContextType('file');
        setTargetFile(fileElement.getAttribute('data-file-path'));
      } else {
        setContextType('desktop');
        setTargetFile(null);
      }

      setPosition({ x: e.clientX, y: e.clientY });
      setVisible(true);
    };

    const handleClick = () => setVisible(false);

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('click', handleClick);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('click', handleClick);
    };
  }, []);

  const handleAction = (action: string) => {
    setVisible(false);
    switch (action) {
      case 'new-folder':
        mkdir(`/home/user/New Folder ${Math.floor(Math.random() * 100)}`);
        addNotification("System", "New folder created on Desktop", "success");
        break;
      case 'change-wallpaper':
        addNotification("Settings", "Wallpaper rotation is managed by the Aerogel Engine", "info");
        break;
      case 'refresh':
        window.location.reload();
        break;
      case 'open':
        if (targetFile) openWindow('aether-text', 'Aether Text'); // simplified for demo
        break;
      case 'delete':
        if (targetFile) addNotification("Filesystem", `Deleted ${targetFile}`, "warning");
        break;
      case 'share':
        openWindow('wormhole', 'Wormhole');
        break;
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.1 }}
          className="fixed z-[10002] bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl py-1 min-w-[200px]"
          style={{ top: position.y, left: position.x }}
        >
          {contextType === 'desktop' ? (
            <>
              <MenuItem icon={<FolderPlus size={14}/>} label="New Folder" onClick={() => handleAction('new-folder')} />
              <MenuItem icon={<Image size={14}/>} label="Change Wallpaper" onClick={() => handleAction('change-wallpaper')} />
              <div className="h-[1px] bg-white/10 my-1 mx-2" />
              <MenuItem icon={<RefreshCw size={14}/>} label="Refresh Aether" onClick={() => handleAction('refresh')} />
            </>
          ) : (
            <>
              <MenuItem icon={<FileText size={14}/>} label="Open" onClick={() => handleAction('open')} />
              <MenuItem icon={<Share2 size={14}/>} label="Share via Wormhole" onClick={() => handleAction('share')} />
              <div className="h-[1px] bg-white/10 my-1 mx-2" />
              <MenuItem icon={<Trash2 size={14}/>} label="Delete" onClick={() => handleAction('delete')} isDestructive />
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const MenuItem = ({ icon, label, onClick, isDestructive = false }: any) => (
  <button
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    className={`w-full px-3 py-2 text-xs flex items-center gap-3 hover:bg-white/10 transition-colors text-left
      ${isDestructive ? 'text-red-400 hover:text-red-300' : 'text-gray-300 hover:text-white'}
    `}
  >
    {icon}
    <span>{label}</span>
  </button>
);
