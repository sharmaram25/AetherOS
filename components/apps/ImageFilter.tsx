
import React, { useState, useRef, useEffect } from 'react';
import { Upload, Image as ImageIcon, Sliders, RotateCcw, RotateCw, Download, Layers } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';

interface Adjustments {
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
  rotation: number;
  grayscale: number;
  sepia: number;
}

const DEFAULT_ADJUSTMENTS: Adjustments = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  blur: 0,
  rotation: 0,
  grayscale: 0,
  sepia: 0,
};

export const ImageFilter = () => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [adjustments, setAdjustments] = useState<Adjustments>(DEFAULT_ADJUSTMENTS);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { accentColor } = useSettingsStore();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImageSrc(ev.target?.result as string);
        setAdjustments(DEFAULT_ADJUSTMENTS);
      };
      reader.readAsDataURL(file);
    }
  };

  // Real-time canvas rendering
  useEffect(() => {
    if (!imageSrc || !canvasRef.current) return;

    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Reset canvas logic
      // Handle Rotation Dimensions
      const rads = (adjustments.rotation * Math.PI) / 180;
      const sin = Math.abs(Math.sin(rads));
      const cos = Math.abs(Math.cos(rads));
      canvas.width = img.width * cos + img.height * sin;
      canvas.height = img.width * sin + img.height * cos;

      // Apply Filters
      const filterString = `
        brightness(${adjustments.brightness}%) 
        contrast(${adjustments.contrast}%) 
        saturate(${adjustments.saturation}%) 
        blur(${adjustments.blur}px)
        grayscale(${adjustments.grayscale}%)
        sepia(${adjustments.sepia}%)
      `;
      ctx.filter = filterString;

      // Draw
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(rads);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
    };
  }, [imageSrc, adjustments]);

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `edited-image-${Date.now()}.png`;
    link.href = canvasRef.current.toDataURL();
    link.click();
  };

  const updateAdj = (key: keyof Adjustments, val: number) => {
    setAdjustments(prev => ({ ...prev, [key]: val }));
  };

  const ControlRange = ({ label, value, min, max, onChange, unit = '' }: any) => (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-400">
        <span>{label}</span>
        <span>{value}{unit}</span>
      </div>
      <input 
        type="range" min={min} max={max} value={value} 
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
        style={{ accentColor: accentColor }}
      />
    </div>
  );

  return (
    <div className="h-full bg-slate-900 flex text-white overflow-hidden">
      {/* Sidebar Controls */}
      <div className="w-64 bg-black/20 border-r border-white/10 flex flex-col p-4 gap-6 overflow-y-auto">
        <div>
          <h2 className="font-semibold flex items-center gap-2 mb-4 text-sm text-gray-300">
            <Sliders size={16} style={{ color: accentColor }} /> Adjustments
          </h2>
          <div className="space-y-4">
            <ControlRange label="Brightness" value={adjustments.brightness} min={0} max={200} onChange={(v: number) => updateAdj('brightness', v)} unit="%" />
            <ControlRange label="Contrast" value={adjustments.contrast} min={0} max={200} onChange={(v: number) => updateAdj('contrast', v)} unit="%" />
            <ControlRange label="Saturation" value={adjustments.saturation} min={0} max={200} onChange={(v: number) => updateAdj('saturation', v)} unit="%" />
            <ControlRange label="Blur" value={adjustments.blur} min={0} max={20} onChange={(v: number) => updateAdj('blur', v)} unit="px" />
          </div>
        </div>

        <div className="h-[1px] bg-white/10" />

        <div>
           <h2 className="font-semibold flex items-center gap-2 mb-4 text-sm text-gray-300">
            <Layers size={16} style={{ color: accentColor }} /> Filters
          </h2>
          <div className="space-y-4">
            <ControlRange label="Grayscale" value={adjustments.grayscale} min={0} max={100} onChange={(v: number) => updateAdj('grayscale', v)} unit="%" />
            <ControlRange label="Sepia" value={adjustments.sepia} min={0} max={100} onChange={(v: number) => updateAdj('sepia', v)} unit="%" />
          </div>
        </div>

        <div className="mt-auto pt-4 space-y-2">
            <label className="flex items-center justify-center gap-2 w-full py-2 bg-white/10 hover:bg-white/20 rounded cursor-pointer transition-colors text-xs font-medium">
                <Upload size={14} /> Open Image
                <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
            </label>
            <button 
                onClick={handleDownload}
                disabled={!imageSrc}
                className="flex items-center justify-center gap-2 w-full py-2 rounded text-xs font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: accentColor }}
            >
                <Download size={14} /> Save Image
            </button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col bg-dots-pattern relative">
        <div className="h-12 border-b border-white/5 flex items-center justify-center gap-4 bg-white/5">
             <button onClick={() => updateAdj('rotation', adjustments.rotation - 90)} className="p-2 hover:bg-white/10 rounded-full text-white/70 hover:text-white" title="Rotate Left">
                <RotateCcw size={18} />
             </button>
             <button onClick={() => setAdjustments(DEFAULT_ADJUSTMENTS)} className="px-3 py-1 bg-white/5 hover:bg-white/10 rounded text-xs">
                Reset
             </button>
             <button onClick={() => updateAdj('rotation', adjustments.rotation + 90)} className="p-2 hover:bg-white/10 rounded-full text-white/70 hover:text-white" title="Rotate Right">
                <RotateCw size={18} />
             </button>
        </div>

        <div className="flex-1 flex items-center justify-center p-8 overflow-hidden">
            {imageSrc ? (
                <canvas 
                    ref={canvasRef} 
                    className="max-w-full max-h-full object-contain shadow-2xl border border-white/10 bg-[url('https://upload.wikimedia.org/wikipedia/commons/2/20/Transparent_square_tiles_texture.png')]" 
                />
            ) : (
                <div className="flex flex-col items-center text-white/20 gap-4">
                    <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center border-2 border-dashed border-white/10">
                        <ImageIcon size={48} />
                    </div>
                    <p>Open an image to start editing</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default ImageFilter;
