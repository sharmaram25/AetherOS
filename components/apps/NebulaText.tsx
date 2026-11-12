
import React, { useState, useEffect } from 'react';
import { Save, FolderOpen, FilePlus } from 'lucide-react';
import { useFileSystem } from '../../store/useFileSystem';

export const NebulaText = () => {
  const { readFile, writeFile, readdir, mkdir, files } = useFileSystem();
  const [content, setContent] = useState('');
  const [currentPath, setCurrentPath] = useState('/home/user/documents/welcome.txt');
  const [status, setStatus] = useState('Ready');

  useEffect(() => {
    loadFile(currentPath);
  }, []);

  const loadFile = async (path: string) => {
    try {
      setStatus('Loading...');
      const data = await readFile(path);
      setContent(data);
      setCurrentPath(path);
      setStatus('Loaded');
    } catch (e) {
      console.error(e);
      setStatus('Error loading file');
    }
  };

  const handleSave = async () => {
    try {
      setStatus('Saving...');
      await writeFile(currentPath, content);
      setStatus('Saved');
      setTimeout(() => setStatus('Ready'), 2000);
    } catch (e) {
      console.error(e);
      setStatus('Error saving');
    }
  };

  return (
    <div className="h-full flex flex-col text-gray-200">
      <div className="h-10 border-b border-white/10 flex items-center px-4 gap-4 bg-white/5">
        <button onClick={handleSave} className="flex items-center gap-1 hover:text-white text-xs">
            <Save size={14} /> Save
        </button>
        <span className="text-xs text-gray-500">|</span>
        <span className="text-xs font-mono opacity-70 truncate max-w-[200px]">{currentPath}</span>
        <div className="flex-1" />
        <span className="text-xs text-gray-500">{status}</span>
      </div>
      <textarea
        className="flex-1 bg-transparent p-4 resize-none focus:outline-none font-mono text-sm leading-relaxed"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        spellCheck={false}
      />
    </div>
  );
};

export default NebulaText;
