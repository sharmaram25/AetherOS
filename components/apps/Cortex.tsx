
import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, Cpu, Sparkles } from 'lucide-react';
import { cortexService } from '../../services/CortexService';
import { useFileSystem } from '../../store/useFileSystem';
import { useWindowManager } from '../../store/useWindowManager';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export const Cortex = () => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hello. I am Cortex, your local AI. I can control this OS. How can I help?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [initProgress, setInitProgress] = useState<string>('');
  
  // OS Context Access
  const fs = useFileSystem();
  const wm = useWindowManager();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Try to init Cortex (or check status)
    cortexService.init((progress) => {
        setInitProgress(progress.text);
    }).catch(() => {
        setInitProgress("WebGPU not available. Running in Safe Mode (Mock).");
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    // Pass OS context to the service
    const response = await cortexService.chat(userMsg, { fs, wm });
    
    setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    setIsLoading(false);
  };

  return (
    <div className="h-full flex flex-col bg-slate-900/90 text-white">
        {/* Status Bar */}
        <div className="h-8 border-b border-white/10 flex items-center px-4 gap-2 text-[10px] text-purple-300 font-mono">
            <Cpu size={10} />
            <span>CORE: {initProgress.includes('Safe') ? 'SAFE_MODE' : 'WEB_GPU_QUANTIZED'}</span>
            <span className="ml-auto opacity-50">{initProgress || 'Ready'}</span>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${m.role === 'user' ? 'bg-purple-600 text-white rounded-tr-sm' : 'bg-white/10 text-gray-200 rounded-tl-sm'}`}>
                        {m.role === 'assistant' && (
                            <div className="flex items-center gap-2 mb-1 text-purple-400 text-xs font-bold uppercase tracking-wider">
                                <Bot size={12} /> Cortex
                            </div>
                        )}
                        {m.content}
                    </div>
                </div>
            ))}
            {isLoading && (
                <div className="flex justify-start">
                    <div className="bg-white/5 p-3 rounded-2xl rounded-tl-sm flex items-center gap-2">
                        <Sparkles size={16} className="animate-spin text-purple-400" />
                        <span className="text-xs text-white/50 animate-pulse">Processing intent...</span>
                    </div>
                </div>
            )}
            <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-white/10 bg-black/20">
            <div className="relative">
                <input 
                    type="text" 
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                    placeholder="Ask Cortex to open apps or write files..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-4 pr-12 focus:outline-none focus:border-purple-500 transition-colors"
                />
                <button 
                    onClick={handleSend}
                    disabled={isLoading}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors disabled:opacity-50"
                >
                    <Send size={16} />
                </button>
            </div>
        </div>
    </div>
  );
};

export default Cortex;
