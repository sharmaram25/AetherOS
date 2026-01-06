
import React, { useRef, useState, useEffect } from 'react';
import { Bold, Italic, Type, AlignLeft, AlignCenter, Download, Eye, EyeOff } from 'lucide-react';
import { useWindowManager } from '../../../store/useWindowManager';
import { AppProps } from '../../../types';

export const Editor: React.FC<AppProps> = ({ windowId }) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const [wordCount, setWordCount] = useState(0);
    const [focusMode, setFocusMode] = useState(false);
    const { updateWindow, maximizeWindow, restoreWindow } = useWindowManager();

    const handleInput = () => {
        if (!editorRef.current) return;
        const text = editorRef.current.innerText || '';
        setWordCount(text.trim().split(/\s+/).filter(w => w.length > 0).length);
    };

    const exec = (cmd: string, val?: string) => {
        document.execCommand(cmd, false, val);
        editorRef.current?.focus();
    };

    const toggleFocus = () => {
        setFocusMode(!focusMode);
        if (!focusMode) {
            maximizeWindow(windowId);
        } else {
            restoreWindow(windowId);
        }
    };

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
        <div className={`h-full flex flex-col bg-[#0f172a] text-gray-300 transition-all duration-500 ${focusMode ? 'px-[20%]' : 'px-0'}`}>
            {/* Toolbar - Fades out in focus mode */}
            <div className={`h-12 border-b border-white/10 flex items-center px-4 gap-2 transition-opacity duration-300 ${focusMode ? 'opacity-0 hover:opacity-100' : 'opacity-100'}`}>
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
