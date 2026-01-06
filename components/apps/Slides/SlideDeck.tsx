
import React, { useState, useRef } from 'react';
import { Play, Plus, Trash2, Layout } from 'lucide-react';
import { AppProps } from '../../../types';

interface Slide {
    id: string;
    content: string;
    bg: string;
}

export const SlideDeck: React.FC<AppProps> = () => {
    const [slides, setSlides] = useState<Slide[]>([
        { id: '1', content: '<h1>Welcome to Aether</h1><p>The Future of Work</p>', bg: 'from-blue-900 to-slate-900' },
        { id: '2', content: '<h2>Agenda</h2><ul><li>Physics Engine</li><li>AI Core</li></ul>', bg: 'from-purple-900 to-slate-900' }
    ]);
    const [currentSlide, setCurrentSlide] = useState(0);
    const viewerRef = useRef<HTMLDivElement>(null);

    const addSlide = () => {
        setSlides([...slides, { 
            id: Math.random().toString(), 
            content: '<h2>New Slide</h2><p>Click to edit</p>', 
            bg: 'from-slate-800 to-black' 
        }]);
    };

    const updateContent = (html: string) => {
        const newSlides = [...slides];
        newSlides[currentSlide].content = html;
        setSlides(newSlides);
    };

    const startPresentation = () => {
        if (viewerRef.current) {
            viewerRef.current.requestFullscreen();
        }
    };

    return (
        <div className="h-full flex bg-slate-900 text-white">
            {/* Sidebar Filmstrip */}
            <div className="w-48 bg-black/20 border-r border-white/10 flex flex-col p-2 gap-2 overflow-y-auto">
                {slides.map((slide, i) => (
                    <div 
                        key={slide.id}
                        onClick={() => setCurrentSlide(i)}
                        className={`aspect-video rounded border cursor-pointer relative group overflow-hidden ${currentSlide === i ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-white/10'}`}
                    >
                        <div className={`w-full h-full bg-gradient-to-br ${slide.bg} scale-50 origin-top-left p-2`} dangerouslySetInnerHTML={{ __html: slide.content }} />
                        <div className="absolute top-1 left-1 text-xs font-bold drop-shadow-md">{i + 1}</div>
                    </div>
                ))}
                <button onClick={addSlide} className="aspect-video rounded border border-dashed border-white/20 flex items-center justify-center hover:bg-white/5">
                    <Plus size={24} className="opacity-50" />
                </button>
            </div>

            {/* Main Canvas */}
            <div className="flex-1 flex flex-col relative">
                <div className="h-12 border-b border-white/10 flex items-center px-4 justify-between bg-white/5">
                    <div className="flex gap-2">
                        <button className="p-2 hover:bg-white/10 rounded"><Layout size={16}/></button>
                        <button className="p-2 hover:bg-red-500/20 text-red-400 rounded"><Trash2 size={16}/></button>
                    </div>
                    <button 
                        onClick={startPresentation}
                        className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium transition-colors"
                    >
                        <Play size={14} fill="currentColor" /> Present
                    </button>
                </div>

                <div className="flex-1 bg-black/50 p-8 flex items-center justify-center overflow-hidden">
                    <div 
                        ref={viewerRef}
                        className={`aspect-video w-full max-w-4xl bg-gradient-to-br ${slides[currentSlide].bg} shadow-2xl rounded-xl p-12 flex flex-col items-center justify-center text-center prose prose-invert prose-2xl`}
                        contentEditable
                        onInput={(e) => updateContent(e.currentTarget.innerHTML)}
                        dangerouslySetInnerHTML={{ __html: slides[currentSlide].content }}
                        style={{ outline: 'none' }}
                    />
                </div>
            </div>
        </div>
    );
};

export default SlideDeck;
