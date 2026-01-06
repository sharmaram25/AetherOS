
import React, { useState } from 'react';
import { Folder, File, ArrowLeft, Home, HardDrive, Image as ImageIcon, Music } from 'lucide-react';
import { useFileSystem } from '../../store/useFileSystem';
import { useWindowManager } from '../../store/useWindowManager';
import { AppProps, FileType } from '../../types';
import { getAppIdForExtension } from '../../utils/appRegistry';

export const FileManager: React.FC<AppProps> = () => {
  const { readdir } = useFileSystem();
  const { openWindow } = useWindowManager();
  const [currentPath, setCurrentPath] = useState('/home/user');

  const files = readdir(currentPath);

  const handleNavigate = (path: string) => {
    setCurrentPath(path);
  };

  const handleUp = () => {
    if (currentPath === '/') return;
    const parts = currentPath.split('/');
    parts.pop();
    const newPath = parts.join('/') || '/';
    setCurrentPath(newPath);
  };

  const handleOpen = (file: any) => {
    if (file.type === FileType.DIRECTORY) {
        handleNavigate(file.path);
    } else {
        const appId = getAppIdForExtension(file.name);
        openWindow(appId, file.name, { filePath: file.path });
    }
  };

  const getIcon = (file: any) => {
    if (file.type === FileType.DIRECTORY) return <Folder size={32} className="text-blue-400" fill="currentColor" fillOpacity={0.2} />;
    const ext = file.name.split('.').pop();
    if (['jpg', 'png'].includes(ext)) return <ImageIcon size={32} className="text-purple-400" />;
    if (['mp3', 'wav'].includes(ext)) return <Music size={32} className="text-pink-400" />;
    return <File size={32} className="text-gray-400" />;
  };

  return (
    <div className="h-full flex flex-col bg-slate-900/90 text-white">
      {/* Toolbar */}
      <div className="h-12 border-b border-white/10 flex items-center px-4 gap-2">
        <button onClick={handleUp} className="p-2 hover:bg-white/10 rounded-full disabled:opacity-30" disabled={currentPath === '/'}>
            <ArrowLeft size={16} />
        </button>
        <div className="flex-1 bg-black/20 h-8 rounded flex items-center px-3 text-xs font-mono text-white/70">
            {currentPath}
        </div>
      </div>

      {/* Main View */}
      <div className="flex-1 flex">
        {/* Sidebar */}
        <div className="w-40 border-r border-white/10 bg-black/20 p-2 flex flex-col gap-1">
            <button onClick={() => setCurrentPath('/home/user')} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/10 text-sm text-left"><Home size={14}/> Home</button>
            <button onClick={() => setCurrentPath('/home/user/documents')} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/10 text-sm text-left"><File size={14}/> Documents</button>
            <button onClick={() => setCurrentPath('/home/user/pictures')} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/10 text-sm text-left"><ImageIcon size={14}/> Pictures</button>
            <div className="mt-auto opacity-50 px-2 text-[10px] uppercase">
                <div className="flex items-center gap-2"><HardDrive size={12}/> VFS (IndexedDB)</div>
            </div>
        </div>

        {/* Grid */}
        <div className="flex-1 p-4 overflow-y-auto">
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-4">
                {files.length === 0 && <div className="col-span-full text-center text-white/30 text-sm mt-10">Folder is empty</div>}
                {files.map(file => (
                    <button 
                        key={file.path} 
                        onDoubleClick={() => handleOpen(file)}
                        className="flex flex-col items-center gap-2 p-4 rounded-lg hover:bg-white/5 transition-colors group"
                        data-file-path={file.path}
                    >
                        <div className="group-hover:scale-110 transition-transform">
                            {getIcon(file)}
                        </div>
                        <span className="text-xs text-center truncate w-full px-1">{file.name}</span>
                    </button>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
};

export default FileManager;
