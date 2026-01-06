
import React, { useRef, useState, useEffect } from 'react';
import { Camera, Save, RefreshCw, AlertCircle, Trash2 } from 'lucide-react';
import { useFileSystem } from '../../store/useFileSystem';
import { AppProps } from '../../types';

export const Lens: React.FC<AppProps> = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [filter, setFilter] = useState('none');
  const [captured, setCaptured] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentPhotos, setRecentPhotos] = useState<string[]>([]);
  const { writeFile } = useFileSystem();

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    setError(null);
    try {
        const s = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: { ideal: 1280 }, 
                height: { ideal: 720 },
                facingMode: "user"
            },
            audio: false 
        });
        setStream(s);
        if (videoRef.current) {
            videoRef.current.srcObject = s;
            videoRef.current.play().catch(e => console.error("Play error", e));
        }
    } catch (e: any) {
        console.error("Camera access denied", e);
        setError("Camera access denied or device not found. Please allow permission.");
    }
  };

  const stopCamera = () => {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
    }
  };

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    // Set canvas size to video size
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Apply the current filter to the context before drawing
    ctx.filter = filter;
    ctx.drawImage(videoRef.current, 0, 0);
    
    const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.9);
    setCaptured(dataUrl);
    setRecentPhotos(prev => [dataUrl, ...prev]);
    
    // Flash effect
    const flash = document.createElement('div');
    flash.className = "absolute inset-0 bg-white z-50 animate-out fade-out duration-300 pointer-events-none";
    videoRef.current.parentElement?.appendChild(flash);
    setTimeout(() => flash.remove(), 300);
  };

  const savePhoto = async () => {
    if (!captured) return;
    const filename = `/home/user/pictures/photo_${Date.now()}.jpg`;
    await writeFile(filename, captured);
    // Continue capture flow
    setCaptured(null);
    if (videoRef.current && stream) videoRef.current.play();
  };

  const discardPhoto = () => {
      setCaptured(null);
      if (videoRef.current && stream) videoRef.current.play();
  };

  const filters = [
      { name: 'Normal', val: 'none' },
      { name: 'Noir', val: 'grayscale(100%) contrast(120%)' },
      { name: 'Warm', val: 'sepia(80%) saturate(140%)' },
      { name: 'Cool', val: 'hue-rotate(180deg) saturate(120%)' },
      { name: 'Vivid', val: 'saturate(200%) contrast(110%)' },
      { name: 'Cyber', val: 'invert(100%) hue-rotate(180deg)' },
  ];

  if (error) {
      return (
          <div className="h-full flex flex-col items-center justify-center bg-black text-white p-6 text-center">
              <AlertCircle size={48} className="text-red-500 mb-4" />
              <h2 className="text-xl font-bold mb-2">Camera Unavailable</h2>
              <p className="text-white/60 mb-6">{error}</p>
              <button onClick={startCamera} className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-full">Retry</button>
          </div>
      );
  }

  return (
    <div className="h-full flex flex-col bg-black text-white relative overflow-hidden">
        {/* Main Viewfinder */}
        <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-gray-900 w-full h-full">
            {!captured ? (
                <video 
                    ref={videoRef} 
                    playsInline 
                    muted
                    className="w-full h-full object-cover transition-all duration-300"
                    style={{ filter: filter }}
                />
            ) : (
                <img src={captured} className="w-full h-full object-contain" />
            )}
            
            {/* Filter Selector Overlay */}
            {!captured && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-md rounded-full px-4 py-2 flex gap-3 max-w-[90%] overflow-x-auto scrollbar-hide border border-white/10">
                    {filters.map(f => (
                        <button 
                            key={f.name}
                            onClick={() => setFilter(f.val)}
                            className={`text-[10px] font-medium transition-colors whitespace-nowrap ${filter === f.val ? 'text-blue-400' : 'text-white/70 hover:text-white'}`}
                        >
                            {f.name}
                        </button>
                    ))}
                </div>
            )}
        </div>

        {/* Control Bar & Filmstrip */}
        <div className="bg-black/90 backdrop-blur border-t border-white/10 flex flex-col shrink-0 pb-4">
            
            {/* Controls */}
            <div className="h-24 flex items-center justify-between px-10">
                {!captured ? (
                    <>
                         {/* Recent Thumbnail (Bottom Left) */}
                         <div className="w-12 h-12 rounded bg-white/10 overflow-hidden border border-white/20">
                            {recentPhotos.length > 0 && (
                                <img src={recentPhotos[0]} className="w-full h-full object-cover opacity-80" />
                            )}
                         </div>

                         {/* Shutter Button */}
                        <button 
                            onClick={takePhoto}
                            className="w-16 h-16 rounded-full border-[4px] border-white/30 flex items-center justify-center hover:border-white/60 transition-all active:scale-95 group"
                        >
                            <div className="w-14 h-14 bg-white rounded-full group-hover:scale-90 transition-transform" />
                        </button>

                         {/* Spacer to balance layout */}
                         <div className="w-12" />
                    </>
                ) : (
                    <div className="flex w-full items-center justify-center gap-12">
                        <button onClick={discardPhoto} className="flex flex-col items-center gap-1 text-xs text-white/70 hover:text-white transition-colors">
                            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center mb-1"><RefreshCw size={18} /></div>
                            Retake
                        </button>
                        <button onClick={savePhoto} className="flex flex-col items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                            <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center mb-1 shadow-lg shadow-blue-900/50"><Save size={24} className="text-white"/></div>
                            Save
                        </button>
                    </div>
                )}
            </div>

            {/* Filmstrip (Recent Photos) */}
            {recentPhotos.length > 0 && !captured && (
                <div className="h-16 flex items-center gap-2 px-4 overflow-x-auto scrollbar-hide border-t border-white/5 pt-2">
                    {recentPhotos.map((photo, i) => (
                        <div key={i} className="h-12 w-16 rounded bg-gray-800 shrink-0 border border-white/10 overflow-hidden relative group">
                            <img src={photo} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                {/* Only visual for now, functionally could open gallery */}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
        <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default Lens;
