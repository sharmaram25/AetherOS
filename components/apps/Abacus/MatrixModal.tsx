
import React, { useState } from 'react';
import { X } from 'lucide-react';

export const MatrixModal = ({ onClose }: { onClose: () => void }) => {
    const [matrixA, setMatrixA] = useState([[1, 0], [0, 1]]);
    const [result, setResult] = useState<string | null>(null);

    const updateCell = (r: number, c: number, val: string) => {
        const newM = [...matrixA];
        newM[r][c] = parseFloat(val) || 0;
        setMatrixA(newM);
    };

    const calculateDet = () => {
        // Simple 2x2 determinant: ad - bc
        const det = (matrixA[0][0] * matrixA[1][1]) - (matrixA[0][1] * matrixA[1][0]);
        setResult(`Determinant: ${det}`);
    };

    return (
        <div className="absolute inset-0 bg-slate-900/95 z-50 flex flex-col p-4 animate-in fade-in">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-purple-400">Matrix Engine (2x2)</h3>
                <button onClick={onClose}><X size={16}/></button>
            </div>

            <div className="flex justify-center mb-6">
                <div className="grid grid-cols-2 gap-2 p-4 bg-black/40 rounded-xl border border-white/10">
                    {[0, 1].map(r => [0, 1].map(c => (
                        <input 
                            key={`${r}-${c}`}
                            type="number"
                            value={matrixA[r][c]}
                            onChange={(e) => updateCell(r, c, e.target.value)}
                            className="w-16 h-16 text-center bg-white/5 border border-white/10 rounded text-xl focus:outline-none focus:border-purple-500"
                        />
                    )))}
                </div>
            </div>

            <div className="flex gap-4 justify-center">
                <button 
                    onClick={calculateDet}
                    className="px-6 py-2 bg-purple-600 rounded-lg font-medium hover:bg-purple-500 transition-colors"
                >
                    Calculate Determinant
                </button>
            </div>

            {result && (
                <div className="mt-8 text-center p-4 bg-white/5 rounded-lg border border-white/10">
                    <div className="text-2xl font-light text-green-400">{result}</div>
                </div>
            )}
        </div>
    );
};
