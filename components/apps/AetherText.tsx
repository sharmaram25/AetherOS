
import React, { useState, useEffect } from 'react';
import { Save, Eye, Columns } from 'lucide-react';
import { useFileSystem } from '../../store/useFileSystem';
import { AppProps } from '../../types';

export const AetherText: React.FC<AppProps> = ({ initialData }) => {
  const { readFile, writeFile } = useFileSystem();
  const [content, setContent] = useState('');
  const [currentPath, setCurrentPath] = useState(initialData?.filePath || '/home/user/documents/untitled.md');
  const [status, setStatus] = useState('Ready');
  const [mode, setMode] = useState<'edit' | 'split'>('edit');

  useEffect(() => {
    if (initialData?.filePath) loadFile(initialData.filePath);
    else loadFile(currentPath); // Default
  }, [initialData]);

  // Auto-save logic
  useEffect(() => {
    const timer = setTimeout(() => {
        if (content) handleSave(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, [content]);

  const loadFile = async (path: string) => {
    try {
      setStatus('Loading...');
      const data = await readFile(path);
      setContent(data);
      setCurrentPath(path);
      setStatus('Ready');
    } catch (e) {
      // If file doesn't exist, we start empty
      setStatus('New File');
    }
  };

  const handleSave = async (silent = false) => {
    try {
      if (!silent) setStatus('Saving...');
      await writeFile(currentPath, content);
      if (!silent) setStatus('Saved');
    } catch (e) {
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
    <div className="h-full flex flex-col text-gray-200 bg-slate-900/95">
      <div className="h-10 border-b border-white/10 flex items-center px-4 gap-4 bg-white/5">
        <button onClick={() => handleSave(false)} className="flex items-center gap-1 hover:text-white text-xs">
            <Save size={14} /> Save
        </button>
        <div className="h-4 w-[1px] bg-white/10" />
        <button onClick={() => setMode(mode === 'edit' ? 'split' : 'edit')} className={`flex items-center gap-1 hover:text-white text-xs ${mode === 'split' ? 'text-blue-400' : ''}`}>
            <Columns size={14} /> Preview
        </button>

        <span className="ml-auto text-xs font-mono opacity-50 truncate max-w-[200px]">{currentPath}</span>
        <span className="text-xs text-gray-500 w-16 text-right">{status}</span>
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
                className="w-1/2 p-4 overflow-y-auto prose prose-invert prose-sm"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
            />
        )}
      </div>
    </div>
  );
};

export default AetherText;
