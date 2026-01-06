
import React, { useEffect, useRef, useState } from 'react';
import { MatrixModal } from './MatrixModal';

interface Props {
    onInsert: (val: string) => void;
    onFunc: (func: string) => void;
}

export const ScientificPanel: React.FC<Props> = ({ onInsert, onFunc }) => {
    const [showMatrix, setShowMatrix] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Simple Graphing of sin(x)
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        for (let x = 0; x < canvas.width; x++) {
            const normalizedX = (x - canvas.width / 2) / 20;
            const y = Math.sin(normalizedX);
            const canvasY = canvas.height / 2 - y * 40;
            if (x === 0) ctx.moveTo(x, canvasY);
            else ctx.lineTo(x, canvasY);
        }
        ctx.stroke();

        // Axis
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, canvas.height/2);
        ctx.lineTo(canvas.width, canvas.height/2);
        ctx.moveTo(canvas.width/2, 0);
        ctx.lineTo(canvas.width/2, canvas.height);
        ctx.stroke();
    }, []);

    return (
        <div className="h-full flex flex-col gap-4 w-[300px]">
            {/* Graph Preview */}
            <div className="h-32 bg-black/40 rounded-lg border border-white/10 overflow-hidden relative">
                <canvas ref={canvasRef} width={300} height={128} className="w-full h-full" />
                <span className="absolute bottom-1 right-1 text-[10px] text-white/30">y = sin(x)</span>
            </div>

            <div className="grid grid-cols-3 gap-2 flex-1">
                <SciBtn label="sin" onClick={() => onFunc('sin')} />
                <SciBtn label="cos" onClick={() => onFunc('cos')} />
                <SciBtn label="tan" onClick={() => onFunc('tan')} />
                
                <SciBtn label="log" onClick={() => onFunc('log')} />
                <SciBtn label="ln" onClick={() => onFunc('log')} />
                <SciBtn label="e" onClick={() => onInsert(String(Math.E))} />
                
                <SciBtn label="π" onClick={() => onInsert(String(Math.PI))} />
                <SciBtn label="√" onClick={() => onFunc('sqrt')} />
                <SciBtn label="^" onClick={() => onInsert('^')} />
                
                <button 
                    onClick={() => setShowMatrix(true)}
                    className="col-span-3 bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 rounded-lg h-10 text-sm font-medium transition-colors"
                >
                    Matrix Operations
                </button>
            </div>

            {showMatrix && <MatrixModal onClose={() => setShowMatrix(false)} />}
        </div>
    );
};

const SciBtn = ({ label, onClick }: any) => (
    <button onClick={onClick} className="h-10 rounded bg-white/5 hover:bg-white/10 text-xs font-mono text-blue-200">
        {label}
    </button>
);
