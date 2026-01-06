
import React, { useState, useEffect } from 'react';
import { History, Trash2, Box, Activity } from 'lucide-react';
import { AppProps } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';
import { useWindowManager } from '../../store/useWindowManager';
import { ScientificPanel } from './Abacus/ScientificPanel';

export const Abacus: React.FC<AppProps> = ({ windowId }) => {
  const [display, setDisplay] = useState('0');
  const [equation, setEquation] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [mode, setMode] = useState<'basic' | 'scientific'>('basic');
  const { updateWindow } = useWindowManager();

  useEffect(() => {
    // Resize window based on mode
    if (mode === 'scientific') {
        updateWindow(windowId, { size: { width: 680, height: 480 } });
    } else {
        updateWindow(windowId, { size: { width: 320, height: 480 } });
    }
  }, [mode]);

  const handleNum = (num: string) => {
    if (display === '0') setDisplay(num);
    else setDisplay(display + num);
  };

  const calculate = () => {
    try {
        // Safe Eval using MathJS global if available, else standard eval
        const math = (window as any).math;
        const result = math ? math.evaluate(equation + display) : eval(equation + display);
        setHistory(prev => [`${equation}${display} = ${result}`, ...prev]);
        setDisplay(String(result));
        setEquation('');
    } catch (e) {
        setDisplay('Error');
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-900/95 text-white overflow-hidden">
        {/* Toggle Mode Bar */}
        <div className="h-8 flex items-center justify-between px-2 bg-white/5 border-b border-white/5 shrink-0">
            <button 
                onClick={() => setMode(mode === 'basic' ? 'scientific' : 'basic')}
                className="text-xs flex items-center gap-1 px-2 py-1 rounded hover:bg-white/10 text-blue-300 transition-colors"
            >
                {mode === 'basic' ? <Box size={12}/> : <Activity size={12}/>}
                {mode === 'basic' ? 'Scientific Mode' : 'Basic Mode'}
            </button>
            <button onClick={() => setShowHistory(!showHistory)} className="text-white/50 hover:text-white">
                <History size={14}/>
            </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 flex flex-col p-4 relative">
                {/* Display */}
                <div className="flex flex-col items-end justify-end mb-4 bg-black/20 rounded-xl p-4 h-24 border border-white/5">
                    <div className="text-white/40 text-xs h-4">{equation}</div>
                    <div className="text-4xl font-light tracking-tight truncate w-full text-right">{display}</div>
                </div>

                <div className="flex gap-4 h-full">
                    {/* Basic Keypad */}
                    <div className="grid grid-cols-4 gap-2 flex-1 content-start">
                        <Button label="C" onClick={() => { setDisplay('0'); setEquation(''); }} className="text-red-300 bg-white/5" />
                        <Button label="(" onClick={() => setEquation(equation + '(')} />
                        <Button label=")" onClick={() => setEquation(equation + ')')} />
                        <Button label="÷" onClick={() => { setEquation(display + '/'); setDisplay('0'); }} className="text-amber-400" />

                        <Button label="7" onClick={() => handleNum('7')} />
                        <Button label="8" onClick={() => handleNum('8')} />
                        <Button label="9" onClick={() => handleNum('9')} />
                        <Button label="×" onClick={() => { setEquation(display + '*'); setDisplay('0'); }} className="text-amber-400" />

                        <Button label="4" onClick={() => handleNum('4')} />
                        <Button label="5" onClick={() => handleNum('5')} />
                        <Button label="6" onClick={() => handleNum('6')} />
                        <Button label="-" onClick={() => { setEquation(display + '-'); setDisplay('0'); }} className="text-amber-400" />

                        <Button label="1" onClick={() => handleNum('1')} />
                        <Button label="2" onClick={() => handleNum('2')} />
                        <Button label="3" onClick={() => handleNum('3')} />
                        <Button label="+" onClick={() => { setEquation(display + '+'); setDisplay('0'); }} className="text-amber-400" />

                        <Button label="0" onClick={() => handleNum('0')} className="col-span-2" />
                        <Button label="." onClick={() => handleNum('.')} />
                        <Button label="=" onClick={calculate} className="bg-amber-500 text-white" />
                    </div>

                    {/* Scientific Expansion */}
                    <AnimatePresence>
                        {mode === 'scientific' && (
                            <motion.div 
                                initial={{ width: 0, opacity: 0 }} 
                                animate={{ width: 320, opacity: 1 }} 
                                exit={{ width: 0, opacity: 0 }}
                                className="border-l border-white/10 pl-4 overflow-hidden"
                            >
                                <ScientificPanel 
                                    onInsert={(val) => setDisplay(val)} 
                                    onFunc={(func) => { setEquation(func + '(' + display + ')'); calculate(); }}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* History Tape */}
            {showHistory && (
                 <div className="w-48 bg-black/40 border-l border-white/10 flex flex-col animate-in slide-in-from-right">
                    <div className="p-2 border-b border-white/10 flex justify-between items-center">
                        <span className="text-xs text-white/50 uppercase">Tape</span>
                        <button onClick={() => setHistory([])}><Trash2 size={12}/></button>
                    </div>
                    <div className="overflow-y-auto p-2 space-y-2">
                        {history.map((h, i) => (
                            <div key={i} className="text-right text-sm hover:bg-white/5 p-1 rounded cursor-pointer" onClick={() => setDisplay(h.split('=')[1].trim())}>
                                <div className="text-white/40 text-xs">{h.split('=')[0]}</div>
                                <div className="text-amber-400">{h.split('=')[1]}</div>
                            </div>
                        ))}
                    </div>
                 </div>
            )}
        </div>
    </div>
  );
};

const Button = ({ label, onClick, className = '' }: any) => (
    <button 
        onClick={onClick} 
        className={`h-12 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 transition-all font-medium text-lg ${className}`}
    >
        {label}
    </button>
);

export default Abacus;
