
import React, { useState, useEffect } from 'react';
import { Search, File } from 'lucide-react';
import { useWindowManager } from '../../store/useWindowManager';
import { useFileSystem } from '../../store/useFileSystem';
import { APP_REGISTRY } from '../../utils/appRegistry';
import { AppId } from '../../types';

interface NexusProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Nexus: React.FC<NexusProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const { openWindow } = useWindowManager();
  const { files } = useFileSystem();

  useEffect(() => {
    if (isOpen) setQuery('');
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLaunch = (appId: AppId) => {
    openWindow(appId, APP_REGISTRY[appId].title);
    onClose();
  };

  const filteredFiles = Object.values(files).filter(f => 
    f.name.toLowerCase().includes(query.toLowerCase()) && f.type === 'FILE'
  ).slice(0, 5);

  const apps = Object.values(APP_REGISTRY);

  return (
    <div className="absolute inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="w-[600px] bg-gray-900/80 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="h-16 border-b border-white/10 flex items-center px-6 gap-4">
          <Search className="text-white/50" />
          <input 
            autoFocus
            type="text" 
            placeholder="Search Aether..." 
            className="flex-1 bg-transparent text-xl text-white placeholder-white/20 focus:outline-none"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && onClose()}
          />
          <div className="flex gap-2">
            <kbd className="hidden sm:inline-block px-2 py-1 text-xs text-white/50 bg-white/5 rounded border border-white/10">ESC</kbd>
          </div>
        </div>

        <div className="p-4 max-h-[400px] overflow-y-auto">
          {query === '' && (
             <div className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-2 px-2">Applications</div>
          )}

          {/* Apps Grid */}
          <div className="grid grid-cols-2 gap-2 mb-4">
             {apps.filter(a => a.title.toLowerCase().includes(query.toLowerCase())).map(app => (
                <button 
                    key={app.id}
                    onClick={() => handleLaunch(app.id)}
                    className="w-full text-left px-3 py-3 rounded-lg hover:bg-white/10 flex items-center gap-3 group transition-colors"
                >
                    <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center text-white group-hover:bg-white/20 transition-colors">
                        {app.icon}
                    </div>
                    <div className="flex-1">
                        <div className="text-sm font-medium text-gray-200">{app.title}</div>
                    </div>
                </button>
             ))}
          </div>

          {/* Files Section */}
          {filteredFiles.length > 0 && (
            <>
                <div className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-2 px-2 mt-4">Files</div>
                <div className="space-y-1">
                    {filteredFiles.map(file => (
                        <button key={file.path} className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 flex items-center gap-3 group">
                             <File size={14} className="text-gray-500 group-hover:text-gray-300" />
                             <span className="text-sm text-gray-400 group-hover:text-white truncate">{file.name}</span>
                             <span className="ml-auto text-xs text-gray-600 font-mono">{file.path}</span>
                        </button>
                    ))}
                </div>
            </>
          )}

        </div>
        
        <div className="h-8 bg-black/20 border-t border-white/5 flex items-center px-4 justify-between text-[10px] text-white/30">
             <span>AetherOS v1.3</span>
             <div className="flex gap-3">
                 <span>Navigate <span className="text-white/50">↑↓</span></span>
                 <span>Select <span className="text-white/50">↵</span></span>
             </div>
        </div>
      </div>
    </div>
  );
};
