
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Save } from 'lucide-react';
import { AppProps } from '../../../types';

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
    const containerRef = useRef<HTMLDivElement>(null);

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
    };

    // Derived State for Rendering
    const rowsToRender = [];
    for (let i = visibleStartIndex; i < visibleEndIndex; i++) {
        rowsToRender.push(i + 1);
    }

    return (
        <div className="h-full flex flex-col bg-white text-black text-sm">
            {/* Toolbar */}
            <div className="h-10 bg-gray-100 border-b border-gray-300 flex items-center px-4 gap-4">
                <button className="flex items-center gap-1 text-gray-600 hover:text-black">
                    <Save size={14}/> Save
                </button>
                <div className="text-gray-400">|</div>
                <div className="font-mono text-xs text-gray-500">fx = SUM(A1, B1) supported</div>
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
        </div>
    );
};

export default VirtualSheet;
