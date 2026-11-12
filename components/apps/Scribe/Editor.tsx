
import React, { useRef, useState, useEffect } from 'react';
import { Bold, Italic, Type, AlignLeft, AlignCenter, Download, Eye, EyeOff, FolderOpen, FilePlus2, Save, X } from 'lucide-react';
import { useWindowManager } from '../../../store/useWindowManager';
import { AppProps, FileType } from '../../../types';
import { useFileSystem } from '../../../store/useFileSystem';

export const Editor: React.FC<AppProps> = ({ windowId, initialData }) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const [wordCount, setWordCount] = useState(0);
    const [focusMode, setFocusMode] = useState(false);
        const [status, setStatus] = useState('Ready');
        const [currentPath, setCurrentPath] = useState(initialData?.filePath || '/home/user/documents/untitled.scribe.txt');
        const [showFilePicker, setShowFilePicker] = useState(false);
    const { maximizeWindow, restoreWindow } = useWindowManager();
        const { files, readFile, writeFile } = useFileSystem();

        const availableFiles = Object.values(files)
            .filter((f) => f.type === FileType.FILE)
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .slice(0, 40);

    const handleInput = () => {
        if (!editorRef.current) return;
        const text = editorRef.current.innerText || '';
        setWordCount(text.trim().split(/\s+/).filter(w => w.length > 0).length);
        setStatus('Editing');
    };

    const exec = (cmd: string, val?: string) => {
        document.execCommand(cmd, false, val);
        editorRef.current?.focus();
    };

    const enterFocusMode = () => {
        setFocusMode(true);
        maximizeWindow(windowId);
    };

    const exitFocusMode = () => {
        setFocusMode(false);
        restoreWindow(windowId);
    };

    const toggleFocus = () => {
        if (!focusMode) {
            maximizeWindow(windowId);
            setFocusMode(true);
        } else {
            restoreWindow(windowId);
            setFocusMode(false);
        }
    };

    const handleSave = async () => {
        if (!editorRef.current) return;
        try {
            setStatus('Saving...');
            await writeFile(currentPath, editorRef.current.innerText || '');
            setStatus('Saved');
        } catch {
            setStatus('Error');
        }
    };

    const handleNew = () => {
        const nextPath = `/home/user/documents/untitled-${Date.now()}.txt`;
        setCurrentPath(nextPath);
        if (editorRef.current) editorRef.current.innerText = '';
        setWordCount(0);
        setStatus('New File');
    };

    const handleOpen = async (path: string) => {
        try {
            setStatus('Loading...');
            const data = await readFile(path);
            setCurrentPath(path);
            if (editorRef.current) editorRef.current.innerText = data;
            const words = (data || '').trim().split(/\s+/).filter((w) => w.length > 0).length;
            setWordCount(words);
            setStatus('Ready');
            setShowFilePicker(false);
        } catch {
            setStatus('Error');
        }
    };

    const handleSaveAs = async () => {
        if (!editorRef.current) return;
        const nextPath = window.prompt('Save as path', currentPath || '/home/user/documents/untitled.txt');
        if (!nextPath) return;
        setCurrentPath(nextPath);
        try {
            setStatus('Saving...');
            await writeFile(nextPath, editorRef.current.innerText || '');
            setStatus('Saved');
        } catch {
            setStatus('Error');
        }
    };

    useEffect(() => {
        if (!initialData?.filePath) return;
        handleOpen(initialData.filePath);
    }, [initialData?.filePath]);

    useEffect(() => {
      const onKey = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && focusMode) {
          event.preventDefault();
          exitFocusMode();
        }
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
          event.preventDefault();
          handleSave();
        }
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, [focusMode, currentPath]);

    const exportPDF = () => {
        const printWindow = window.open('', '_blank');
        if (printWindow && editorRef.current) {
            printWindow.document.write(`
                <html>
                <head><title>Aether Scribe Export</title></head>
                <body style="font-family: serif; padding: 40px; line-height: 1.6;">
                    ${editorRef.current.innerHTML}
                </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.print();
        }
    };

    return (
        <div className={`h-full flex flex-col bg-[#0f172a] text-gray-300 transition-all duration-500 relative ${focusMode ? 'px-[20%]' : 'px-0'}`}>
            {/* Toolbar - Fades out in focus mode */}
            <div className={`h-12 border-b border-white/10 flex items-center px-4 gap-2 transition-opacity duration-300 ${focusMode ? 'opacity-0 hover:opacity-100' : 'opacity-100'}`}>
                                <ToolBtn icon={<FilePlus2 size={16}/>} onClick={handleNew} label="New" />
                                <ToolBtn icon={<FolderOpen size={16}/>} onClick={() => setShowFilePicker(true)} label="Open" />
                                <ToolBtn icon={<Save size={16}/>} onClick={handleSave} label="Save" />
                                <ToolBtn icon={<Download size={16}/>} onClick={handleSaveAs} label="Save As" />
                                <div className="w-[1px] h-6 bg-white/10 mx-1" />
                <ToolBtn icon={<Bold size={16}/>} onClick={() => exec('bold')} />
                <ToolBtn icon={<Italic size={16}/>} onClick={() => exec('italic')} />
                <div className="w-[1px] h-6 bg-white/10 mx-2" />
                <ToolBtn icon={<Type size={16}/>} onClick={() => exec('formatBlock', '<h2>')} />
                <ToolBtn icon={<AlignLeft size={16}/>} onClick={() => exec('justifyLeft')} />
                <ToolBtn icon={<AlignCenter size={16}/>} onClick={() => exec('justifyCenter')} />
                <div className="flex-1" />
                <ToolBtn icon={focusMode ? <EyeOff size={16}/> : <Eye size={16}/>} onClick={toggleFocus} label="Focus" />
                                <ToolBtn icon={<Download size={16}/>} onClick={exportPDF} label="Export" />
            </div>

                        {focusMode && (
                            <button
                                onClick={exitFocusMode}
                                className="absolute top-3 right-4 z-20 pointer-events-auto px-3 py-1.5 rounded-full bg-black/40 border border-white/15 text-xs text-white/80 hover:text-white hover:bg-black/60"
                            >
                                Exit Focus (Esc)
                            </button>
                        )}

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
                                                onClick={() => handleOpen(file.path)}
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

            {/* Paper */}
            <div className="flex-1 overflow-y-auto cursor-text" onClick={() => editorRef.current?.focus()}>
                <div 
                    ref={editorRef}
                    contentEditable
                    onInput={handleInput}
                    className="max-w-3xl mx-auto min-h-[calc(100%-2rem)] mt-8 p-8 outline-none prose prose-invert prose-lg"
                    data-placeholder="Start writing..."
                />
            </div>

            {/* Status Bar */}
            <div className="h-8 border-t border-white/5 flex items-center justify-between px-6 text-xs text-white/30 font-mono">
                <span>{wordCount} words</span>
                <span>{currentPath}</span>
                <span>{status}</span>
                <span>{Math.ceil(wordCount / 200)} min read</span>
            </div>
        </div>
    );
};

const ToolBtn = ({ icon, onClick, label }: any) => (
    <button onClick={onClick} className="flex items-center gap-2 p-2 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors">
        {icon}
        {label && <span className="text-xs font-medium">{label}</span>}
    </button>
);

export default Editor;
