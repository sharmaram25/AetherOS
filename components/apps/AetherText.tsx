
import React, { useState, useEffect, useCallback } from 'react';
import { Save, Columns, FolderOpen, FilePlus2, Download, X } from 'lucide-react';
import { useFileSystem } from '../../store/useFileSystem';
import { AppProps, FileType } from '../../types';
import { useSettingsStore } from '../../stores/settingsStore';

export const AetherText: React.FC<AppProps> = ({ initialData }) => {
  const { readFile, writeFile, files } = useFileSystem();
  const { accentColor } = useSettingsStore();
  const [content, setContent] = useState('');
  const [currentPath, setCurrentPath] = useState(initialData?.filePath || '/home/user/documents/untitled.md');
  const [status, setStatus] = useState('Ready');
  const [mode, setMode] = useState<'edit' | 'split'>('edit');
  const [showFilePicker, setShowFilePicker] = useState(false);

  const availableFiles = Object.values(files)
    .filter((f) => f.type === FileType.FILE)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 50);

  const loadFile = useCallback(async (path: string) => {
    try {
      setStatus('Loading...');
      const data = await readFile(path);
      setContent(data);
      setCurrentPath(path);
      setStatus('Ready');
    } catch (e) {
      setStatus('New File');
    }
  }, [readFile]);

  const handleSave = useCallback(async (silent = false) => {
    try {
      if (!silent) setStatus('Saving...');
      await writeFile(currentPath, content);
      if (!silent) setStatus('Saved');
    } catch (e) {
      setStatus('Error saving');
    }
  }, [currentPath, content, writeFile]);

  useEffect(() => {
    const filePath = initialData?.filePath || currentPath;
    loadFile(filePath);
  }, [initialData?.filePath, loadFile]);

  // Auto-save logic
  useEffect(() => {
    const timer = setTimeout(() => {
        if (content.trim()) handleSave(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, [content, handleSave]);

  const lineCount = content ? content.split('\n').length : 1;
  const charCount = content.length;

  const handleNewFile = () => {
    setCurrentPath(`/home/user/documents/untitled-${Date.now()}.md`);
    setContent('');
    setStatus('New File');
  };

  const handleOpenFile = async (path: string) => {
    await loadFile(path);
    setShowFilePicker(false);
  };

  const handleSaveAs = async () => {
    const nextPath = window.prompt('Save as path', currentPath || '/home/user/documents/untitled.md');
    if (!nextPath) return;
    setCurrentPath(nextPath);
    try {
      setStatus('Saving...');
      await writeFile(nextPath, content);
      setStatus('Saved');
    } catch {
      setStatus('Error saving');
    }
  };

  // Simple Markdown Renderer (Mock)
  const renderMarkdown = (text: string) => {
      return text
        .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mb-2 text-purple-300">$1</h1>')
        .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mb-2 text-blue-300">$1</h2>')
        .replace(/\*\*(.*)\*\*/gim, '<b>$1</b>')
        .replace(/\n/gim, '<br />');
  };

  return (
    <div className="h-full flex flex-col text-gray-200 bg-slate-900/95 relative">
      <div className="h-10 border-b border-white/10 flex items-center px-4 gap-4 bg-white/5">
        <button onClick={handleNewFile} className="flex items-center gap-1 hover:text-white text-xs px-2 py-1 rounded-md hover:bg-white/10 transition-colors">
          <FilePlus2 size={14} /> New
        </button>
        <button onClick={() => setShowFilePicker(true)} className="flex items-center gap-1 hover:text-white text-xs px-2 py-1 rounded-md hover:bg-white/10 transition-colors">
          <FolderOpen size={14} /> Open
        </button>
        <button onClick={() => handleSave(false)} className="flex items-center gap-1 hover:text-white text-xs px-2 py-1 rounded-md hover:bg-white/10 transition-colors">
            <Save size={14} /> Save
        </button>
        <button onClick={handleSaveAs} className="flex items-center gap-1 hover:text-white text-xs px-2 py-1 rounded-md hover:bg-white/10 transition-colors">
          <Download size={14} /> Save As
        </button>
        <div className="h-4 w-[1px] bg-white/10" />
        <button onClick={() => setMode(mode === 'edit' ? 'split' : 'edit')} className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md hover:bg-white/10 transition-colors ${mode === 'split' ? 'text-blue-400' : 'hover:text-white'}`}>
            <Columns size={14} /> Preview
        </button>

        <span className="text-[11px] text-white/45 font-mono">{lineCount}L · {charCount}C</span>
        <span className="ml-auto text-xs font-mono opacity-50 truncate max-w-[200px]">{currentPath}</span>
        <span
          className={`text-[11px] w-20 text-right px-2 py-0.5 rounded-full border border-white/10 bg-white/5 ${status === 'Error saving' ? 'text-red-400' : ''}`}
          style={status === 'Error saving' ? undefined : { color: accentColor }}
        >
          {status}
        </span>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <textarea
            className={`bg-transparent p-4 resize-none focus:outline-none font-mono text-sm leading-relaxed ${mode === 'split' ? 'w-1/2 border-r border-white/10' : 'w-full'}`}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            spellCheck={false}
            placeholder="Start typing..."
        />
        {mode === 'split' && (
            <div 
            className="w-1/2 p-4 overflow-y-auto prose prose-invert prose-sm bg-black/10"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
            />
        )}
      </div>

      {showFilePicker && (
        <div className="absolute inset-0 z-30 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-xl bg-slate-900 border border-white/10 rounded-xl p-4 max-h-[70%] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Open File</h3>
              <button onClick={() => setShowFilePicker(false)} className="p-1 hover:bg-white/10 rounded"><X size={14} /></button>
            </div>
            <div className="overflow-y-auto space-y-1">
              {availableFiles.map((file) => (
                <button
                  key={file.path}
                  onClick={() => handleOpenFile(file.path)}
                  className="w-full text-left px-3 py-2 rounded hover:bg-white/10 text-sm flex items-center justify-between"
                >
                  <span className="truncate mr-2">{file.name}</span>
                  <span className="text-[10px] text-white/40 font-mono truncate">{file.path}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AetherText;
