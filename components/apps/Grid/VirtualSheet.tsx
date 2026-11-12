
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Save, FolderOpen, FilePlus2, Download, X } from 'lucide-react';
import { AppProps, FileType } from '../../../types';
import { useFileSystem } from '../../../store/useFileSystem';

// Constants for Virtualization
const ROW_HEIGHT = 28;
const COL_WIDTH = 100;
const HEADER_HEIGHT = 32;
const TOTAL_ROWS = 1000;
const TOTAL_COLS = 26; // A-Z

// Formula Logic
const evaluateFormula = (formula: string, cells: Record<string, string>): string => {
    if (!formula.startsWith('=')) return formula;
    
    try {
        const expression = formula.substring(1).toUpperCase();
        // Replace cell refs (A1) with values
        const parsed = expression.replace(/([A-Z]+[0-9]+)/g, (match) => {
            const val = cells[match] || '0';
            return isNaN(Number(val)) ? `"${val}"` : val;
        });
        
        // Use Function constructor for safe-ish eval of math
        // eslint-disable-next-line no-new-func
        return new Function(`return ${parsed}`)().toString();
    } catch (e) {
        return '#ERR';
    }
};

export const VirtualSheet: React.FC<AppProps> = () => {
    const [cells, setCells] = useState<Record<string, string>>({});
    const [scrollTop, setScrollTop] = useState(0);
        const [currentPath, setCurrentPath] = useState('/home/user/documents/sheet.grid.json');
        const [status, setStatus] = useState('Ready');
        const [showPicker, setShowPicker] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
        const { files, readFile, writeFile } = useFileSystem();

        const gridFiles = Object.values(files)
            .filter((file) => file.type === FileType.FILE && (file.name.endsWith('.grid.json') || file.name.endsWith('.csv') || file.name.endsWith('.json')))
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .slice(0, 40);

    // Calculate visible range
    const visibleStartIndex = Math.floor(scrollTop / ROW_HEIGHT);
    const visibleEndIndex = Math.min(TOTAL_ROWS, visibleStartIndex + Math.ceil(600 / ROW_HEIGHT) + 5);

    // Generate column headers (A, B, C...)
    const cols = useMemo(() => Array.from({ length: TOTAL_COLS }, (_, i) => String.fromCharCode(65 + i)), []);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        setScrollTop(e.currentTarget.scrollTop);
    };

    const handleChange = (cellId: string, value: string) => {
        setCells(prev => ({ ...prev, [cellId]: value }));
                setStatus('Editing');
    };

        const saveSheet = async () => {
            try {
                setStatus('Saving...');
                await writeFile(currentPath, JSON.stringify({ cells }, null, 2));
                setStatus('Saved');
            } catch {
                setStatus('Error');
            }
        };

        const saveSheetAs = async () => {
            const nextPath = window.prompt('Save sheet as', currentPath || '/home/user/documents/sheet.grid.json');
            if (!nextPath) return;
            setCurrentPath(nextPath);
            try {
                setStatus('Saving...');
                await writeFile(nextPath, JSON.stringify({ cells }, null, 2));
                setStatus('Saved');
            } catch {
                setStatus('Error');
            }
        };

        const newSheet = () => {
            setCells({});
            setCurrentPath(`/home/user/documents/sheet-${Date.now()}.grid.json`);
            setStatus('New Sheet');
        };

        const openSheet = async (path: string) => {
            try {
                setStatus('Loading...');
                const fileData = await readFile(path);
                const parsed = JSON.parse(fileData);
                setCells(parsed.cells || {});
                setCurrentPath(path);
                setStatus('Ready');
                setShowPicker(false);
            } catch {
                setStatus('Invalid File');
            }
        };

        useEffect(() => {
            const onKeyDown = (event: KeyboardEvent) => {
                if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
                    event.preventDefault();
                    saveSheet();
                }
            };
            window.addEventListener('keydown', onKeyDown);
            return () => window.removeEventListener('keydown', onKeyDown);
        }, [currentPath, cells]);

    // Derived State for Rendering
    const rowsToRender = [];
    for (let i = visibleStartIndex; i < visibleEndIndex; i++) {
        rowsToRender.push(i + 1);
    }

    return (
        <div className="h-full flex flex-col bg-white text-black text-sm relative">
            {/* Toolbar */}
            <div className="h-10 bg-gray-100 border-b border-gray-300 flex items-center px-4 gap-4">
                <button onClick={newSheet} className="flex items-center gap-1 text-gray-600 hover:text-black">
                    <FilePlus2 size={14}/> New
                </button>
                <button onClick={() => setShowPicker(true)} className="flex items-center gap-1 text-gray-600 hover:text-black">
                    <FolderOpen size={14}/> Open
                </button>
                <button onClick={saveSheet} className="flex items-center gap-1 text-gray-600 hover:text-black">
                    <Save size={14}/> Save
                </button>
                <button onClick={saveSheetAs} className="flex items-center gap-1 text-gray-600 hover:text-black">
                    <Download size={14}/> Save As
                </button>
                <div className="text-gray-400">|</div>
                <div className="font-mono text-xs text-gray-500">fx = SUM(A1, B1) supported</div>
                <div className="ml-auto text-[10px] font-mono text-gray-500 truncate max-w-[320px]">{currentPath} · {status}</div>
            </div>

            {/* Header Row */}
            <div className="flex bg-gray-200 border-b border-gray-300 font-bold text-gray-600" style={{ paddingLeft: 40, height: HEADER_HEIGHT }}>
                {cols.map(c => (
                    <div key={c} className="border-r border-gray-300 flex items-center justify-center" style={{ width: COL_WIDTH, minWidth: COL_WIDTH }}>
                        {c}
                    </div>
                ))}
            </div>

            {/* Virtualized Body */}
            <div 
                ref={containerRef}
                className="flex-1 overflow-auto relative" 
                onScroll={handleScroll}
            >
                {/* Phantom spacer to force scrollbar */}
                <div style={{ height: TOTAL_ROWS * ROW_HEIGHT, width: '100%' }} />

                {/* Rendered Rows */}
                {rowsToRender.map(rowIndex => (
                    <div 
                        key={rowIndex} 
                        className="absolute left-0 right-0 flex border-b border-gray-200"
                        style={{ top: (rowIndex - 1) * ROW_HEIGHT, height: ROW_HEIGHT }}
                    >
                        {/* Row Header */}
                        <div className="w-10 bg-gray-100 border-r border-gray-300 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0 select-none">
                            {rowIndex}
                        </div>
                        
                        {/* Cells */}
                        {cols.map(col => {
                            const cellId = `${col}${rowIndex}`;
                            const rawValue = cells[cellId] || '';
                            const displayValue = evaluateFormula(rawValue, cells);
                            
                            return (
                                <input
                                    key={cellId}
                                    className="border-r border-gray-200 px-2 outline-none focus:ring-2 focus:ring-blue-500 focus:z-10"
                                    style={{ width: COL_WIDTH, minWidth: COL_WIDTH }}
                                    value={document.activeElement?.getAttribute('data-id') === cellId ? rawValue : displayValue}
                                    data-id={cellId}
                                    onChange={(e) => handleChange(cellId, e.target.value)}
                                />
                            );
                        })}
                    </div>
                ))}
            </div>

                        {showPicker && (
                            <div className="absolute inset-0 z-30 bg-black/40 flex items-center justify-center p-6">
                                <div className="w-full max-w-xl bg-white rounded-xl border border-gray-200 p-4 max-h-[70%] flex flex-col">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-sm font-semibold text-gray-800">Open Sheet</h3>
                                        <button onClick={() => setShowPicker(false)} className="p-1 hover:bg-gray-100 rounded"><X size={14} /></button>
                                    </div>
                                    <div className="overflow-y-auto space-y-1">
                                        {gridFiles.map((file) => (
                                            <button
                                                key={file.path}
                                                onClick={() => openSheet(file.path)}
                                                className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm flex items-center justify-between"
                                            >
                                                <span className="truncate mr-2">{file.name}</span>
                                                <span className="text-[10px] text-gray-500 font-mono truncate">{file.path}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
        </div>
    );
};

export default VirtualSheet;
