
import React, { useMemo, useState } from 'react';
import { Folder, File, ArrowLeft, Home, HardDrive, Image as ImageIcon, Music, Search, FolderPlus, FilePlus2, Trash2, ArrowUpDown } from 'lucide-react';
import { useFileSystem } from '../../store/useFileSystem';
import { useWindowManager } from '../../store/useWindowManager';
import { AppProps, FileType } from '../../types';
import { getAppIdForExtension } from '../../utils/appRegistry';
import { useSettingsStore } from '../../stores/settingsStore';

export const FileManager: React.FC<AppProps> = () => {
  const { readdir, mkdir, writeFile, deleteFile } = useFileSystem();
  const { openWindow } = useWindowManager();
  const { accentColor } = useSettingsStore();
  const [currentPath, setCurrentPath] = useState('/home/user');
  const [query, setQuery] = useState('');
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'type' | 'updated'>('name');

  const files = readdir(currentPath);
  const visibleFiles = useMemo(() => {
    const filtered = files.filter((file) => file.name.toLowerCase().includes(query.toLowerCase()));
    return filtered.sort((a, b) => {
      if (sortBy === 'type') {
        if (a.type !== b.type) return a.type === FileType.DIRECTORY ? -1 : 1;
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'updated') {
        return b.updatedAt - a.updatedAt;
      }
      return a.name.localeCompare(b.name);
    });
  }, [files, query, sortBy]);

  const pathParts = useMemo(() => {
    const parts = currentPath.split('/').filter(Boolean);
    const crumbs = [{ label: 'root', path: '/' }];
    let running = '';
    for (const part of parts) {
      running += `/${part}`;
      crumbs.push({ label: part, path: running });
    }
    return crumbs;
  }, [currentPath]);

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
        setSelectedPath(null);
    } else {
        const appId = getAppIdForExtension(file.name);
        openWindow(appId, file.name, { filePath: file.path });
    }
  };

  const handleCreateFolder = async () => {
    const base = `${currentPath}/New Folder`;
    const suffix = Math.floor(Math.random() * 999);
    await mkdir(`${base} ${suffix}`);
  };

  const handleCreateFile = async () => {
    const base = `${currentPath}/untitled`;
    const suffix = Math.floor(Math.random() * 999);
    await writeFile(`${base}-${suffix}.txt`, '');
  };

  const handleDeleteSelection = async () => {
    if (!selectedPath) return;
    await deleteFile(selectedPath);
    setSelectedPath(null);
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
        <div className="flex-1 bg-black/20 h-8 rounded flex items-center px-3 text-xs font-mono text-white/70 gap-2 overflow-x-auto scrollbar-hide">
            {pathParts.map((crumb, index) => (
              <React.Fragment key={crumb.path}>
                {index > 0 && <span className="text-white/20">/</span>}
                <button onClick={() => setCurrentPath(crumb.path)} className="hover:text-white whitespace-nowrap">
                  {crumb.label}
                </button>
              </React.Fragment>
            ))}
        </div>
        <button onClick={handleCreateFolder} className="p-2 hover:bg-white/10 rounded-lg text-white/80 hover:text-white" title="New Folder"><FolderPlus size={16} /></button>
        <button onClick={handleCreateFile} className="p-2 hover:bg-white/10 rounded-lg text-white/80 hover:text-white" title="New File"><FilePlus2 size={16} /></button>
        <button onClick={handleDeleteSelection} disabled={!selectedPath} className="p-2 hover:bg-red-500/20 rounded-lg text-white/80 hover:text-red-300 disabled:opacity-40" title="Delete Selected"><Trash2 size={16} /></button>
      </div>

      <div className="h-11 border-b border-white/10 px-4 flex items-center gap-3 bg-black/10">
        <div className="flex-1 h-8 rounded-lg bg-black/20 border border-white/10 flex items-center px-2 gap-2">
          <Search size={14} className="text-white/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search in current folder"
            className="bg-transparent text-xs w-full focus:outline-none placeholder:text-white/30"
          />
        </div>
        <button
          className="h-8 px-3 rounded-lg bg-white/5 hover:bg-white/10 text-xs flex items-center gap-2"
          onClick={() => setSortBy((prev) => prev === 'name' ? 'type' : prev === 'type' ? 'updated' : 'name')}
          style={{ color: accentColor }}
        >
          <ArrowUpDown size={13} /> Sort: {sortBy}
        </button>
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
            {visibleFiles.length === 0 && <div className="col-span-full text-center text-white/30 text-sm mt-10">No files match this view</div>}
            {visibleFiles.map(file => (
                    <button 
                        key={file.path} 
                        onDoubleClick={() => handleOpen(file)}
                onClick={() => setSelectedPath(file.path)}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg hover:bg-white/5 transition-colors group border ${selectedPath === file.path ? 'bg-white/10 border-white/20' : 'border-transparent'}`}
                        data-file-path={file.path}
                title={new Date(file.updatedAt).toLocaleString()}
                    >
                        <div className="group-hover:scale-110 transition-transform">
                            {getIcon(file)}
                        </div>
                        <span className="text-xs text-center truncate w-full px-1">{file.name}</span>
                <span className="text-[10px] text-white/40">{file.type === FileType.DIRECTORY ? 'Folder' : `${Math.max((file.content || '').length, 0)} chars`}</span>
                    </button>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
};

export default FileManager;
