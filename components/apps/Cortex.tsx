
import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, Cpu, Sparkles, Trash2 } from 'lucide-react';
import { cortexService } from '../../services/CortexService';
import { useFileSystem } from '../../store/useFileSystem';
import { useWindowManager } from '../../store/useWindowManager';

interface Message {
    id: string;
  role: 'user' | 'assistant';
  content: string;
    createdAt: number;
}

const CORTEX_CHAT_KEY = 'aether_cortex_chat_v1';
const INITIAL_MESSAGE: Message = {
    id: 'bootstrap',
    role: 'assistant',
    content: 'Hello. I am Cortex, your local AI. I can control this OS. How can I help?',
    createdAt: Date.now(),
};

const QUICK_ACTIONS = [
    'Open Aether Files',
    'List documents folder',
    'Write a short poem',
    'Open System Monitor',
];

export const Cortex = () => {
    const [messages, setMessages] = useState<Message[]>(() => {
        const saved = localStorage.getItem(CORTEX_CHAT_KEY);
        if (!saved) return [INITIAL_MESSAGE];
        try {
            return JSON.parse(saved) as Message[];
        } catch {
            return [INITIAL_MESSAGE];
        }
    });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [initProgress, setInitProgress] = useState<string>('');
    const [error, setError] = useState<string>('');
  
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
        localStorage.setItem(CORTEX_CHAT_KEY, JSON.stringify(messages));
    }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

    const createMessage = (role: Message['role'], content: string): Message => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role,
        content,
        createdAt: Date.now(),
    });

    const sendMessage = async (rawMessage: string) => {
        if (!rawMessage.trim()) return;
    
        const userMsg = rawMessage.trim();
    setInput('');
        setError('');
        setMessages(prev => [...prev, createMessage('user', userMsg)]);
    setIsLoading(true);

        try {
            const response = await cortexService.chat(userMsg, { fs, wm });
            setMessages(prev => [...prev, createMessage('assistant', response)]);
        } catch {
            const fallback = 'Cortex could not process that request. Please try again.';
            setMessages(prev => [...prev, createMessage('assistant', fallback)]);
            setError('Request failed. Check model initialization/network state.');
        } finally {
            setIsLoading(false);
        }
  };

    const handleSend = async () => sendMessage(input);

    const clearConversation = () => {
        setMessages([INITIAL_MESSAGE]);
        localStorage.removeItem(CORTEX_CHAT_KEY);
    };

  return (
    <div className="h-full flex flex-col bg-slate-900/90 text-white">
        {/* Status Bar */}
        <div className="h-8 border-b border-white/10 flex items-center px-4 gap-2 text-[10px] text-purple-300 font-mono">
            <Cpu size={10} />
            <span>CORE: {initProgress.includes('Safe') ? 'SAFE_MODE' : 'WEB_GPU_QUANTIZED'}</span>
            <span className="ml-auto opacity-50">{initProgress || 'Ready'}</span>
                        <button onClick={clearConversation} className="ml-2 opacity-70 hover:opacity-100 text-white/70" title="Clear conversation">
                            <Trash2 size={12} />
                        </button>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        <div className="flex flex-wrap gap-2">
                            {QUICK_ACTIONS.map((prompt) => (
                                <button
                                    key={prompt}
                                    onClick={() => sendMessage(prompt)}
                                    disabled={isLoading}
                                    className="px-2 py-1 text-[10px] rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 disabled:opacity-50"
                                >
                                    {prompt}
                                </button>
                            ))}
                        </div>

            {messages.map((m) => (
                                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${m.role === 'user' ? 'bg-purple-600 text-white rounded-tr-sm' : 'bg-white/10 text-gray-200 rounded-tl-sm'}`}>
                        {m.role === 'assistant' && (
                            <div className="flex items-center gap-2 mb-1 text-purple-400 text-xs font-bold uppercase tracking-wider">
                                <Bot size={12} /> Cortex
                            </div>
                        )}
                        {m.content}
                                                <div className="text-[10px] opacity-40 mt-2">{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
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
            {error && <div className="text-[11px] text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>}
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
