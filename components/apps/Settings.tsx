
import React, { useState, useEffect } from 'react';
import { 
    Monitor, HardDrive, Wifi, Activity, 
    Zap, Battery, Download, Trash2, Smartphone, 
    User, Palette, Info, Lock, Shield
} from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { createBackup } from '../../utils/backup';

type TabId = 'appearance' | 'system' | 'user' | 'about';

export const Settings = () => {
  const [activeTab, setActiveTab] = useState<TabId>('appearance');
  const { accentColor } = useSettingsStore();
  
  return (
    <div className="h-full flex bg-slate-900/90 text-white overflow-hidden">
        {/* Sidebar */}
        <div className="w-56 bg-black/20 border-r border-white/10 p-3 flex flex-col gap-1 shrink-0">
            <div className="px-4 py-4 mb-2">
                <h2 className="text-lg font-bold text-white tracking-tight">Settings</h2>
                <p className="text-xs text-white/40">Control Center</p>
            </div>
            
            <TabButton active={activeTab === 'appearance'} onClick={() => setActiveTab('appearance')} icon={<Palette size={18} />} label="Appearance" accentColor={accentColor} />
            <TabButton active={activeTab === 'system'} onClick={() => setActiveTab('system')} icon={<Monitor size={18} />} label="System" accentColor={accentColor} />
            <TabButton active={activeTab === 'user'} onClick={() => setActiveTab('user')} icon={<User size={18} />} label="User" accentColor={accentColor} />
            <TabButton active={activeTab === 'about'} onClick={() => setActiveTab('about')} icon={<Info size={18} />} label="About" accentColor={accentColor} />
        </div>

        {/* Content Panel */}
        <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
            <div className="max-w-2xl mx-auto">
                {activeTab === 'appearance' && <AppearanceTab accentColor={accentColor} />}
                {activeTab === 'system' && <SystemTab accentColor={accentColor} />}
                {activeTab === 'user' && <UserTab accentColor={accentColor} />}
                {activeTab === 'about' && <AboutTab accentColor={accentColor} />}
            </div>
        </div>
    </div>
  );
};

const TabButton = ({ active, onClick, icon, label, accentColor }: any) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${active ? 'text-white shadow-lg' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
        style={active ? { backgroundColor: accentColor, boxShadow: `0 4px 14px -4px ${accentColor}` } : {}}
    >
        {icon}
        {label}
    </button>
);

// --- TABS ---

const AppearanceTab = ({ accentColor }: { accentColor: string }) => {
    const { 
        setAccentColor,
        blurStrength, setBlurStrength,
        ecoMode, setEcoMode, 
    } = useSettingsStore();

    const colors = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f43f5e'];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Section title="Theme & Color" description="Customize the visual language of Aerogel.">
                <div className="bg-white/5 rounded-2xl p-6 border border-white/5 space-y-6">
                    <div>
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 block">Accent Color</label>
                        <div className="flex gap-3 flex-wrap">
                            {colors.map(c => (
                                <button 
                                    key={c}
                                    onClick={() => setAccentColor(c)}
                                    className={`w-10 h-10 rounded-full transition-transform hover:scale-110 ${accentColor === c ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-900' : ''}`}
                                    style={{ backgroundColor: c }}
                                />
                            ))}
                        </div>
                    </div>

                    <div>
                         <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 block">Glass Blur Strength</label>
                         <div className="flex items-center gap-4">
                             <input 
                                type="range" 
                                min="0" 
                                max="40" 
                                value={blurStrength} 
                                onChange={(e) => setBlurStrength(parseInt(e.target.value))}
                                className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                style={{ accentColor: accentColor }}
                             />
                             <span className="text-sm font-mono text-gray-300 w-12 text-right">{blurStrength}px</span>
                         </div>
                    </div>
                </div>
            </Section>

            <Section title="Wallpaper Engine">
                 <Toggle 
                    label="Live Wallpaper (WebGL)" 
                    description="Enable the fluid simulation background. Turn off for static background (Eco Mode)."
                    active={!ecoMode} 
                    onChange={(v: boolean) => setEcoMode(!v)}
                    icon={<Zap size={16} />}
                    accentColor={accentColor}
                />
            </Section>
        </div>
    );
};

const SystemTab = ({ accentColor }: { accentColor: string }) => {
    const { 
        reducedMotion, setReducedMotion, 
        scale, setScale,
        hardReset
    } = useSettingsStore();

    const [usage, setUsage] = useState<number>(0);
    const [quota, setQuota] = useState<number>(0);
    useEffect(() => {
        if (navigator.storage?.estimate) {
            navigator.storage.estimate().then(est => {
                setUsage(est.usage || 0);
                setQuota(est.quota || 1024 * 1024 * 1024);
            });
        }
    }, []);

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + ['B', 'KB', 'MB', 'GB'][i];
    };
    const percent = Math.min(100, Math.round((usage / quota) * 100));

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <Section title="Display & Motion">
                <div className="bg-white/5 rounded-2xl p-6 border border-white/5 space-y-6">
                    <div>
                         <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 block">UI Scale ({Math.round(scale * 100)}%)</label>
                         <input 
                            type="range" 
                            min="0.8" 
                            max="1.2" 
                            step="0.1" 
                            value={scale} 
                            onChange={(e) => setScale(parseFloat(e.target.value))}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            style={{ accentColor: accentColor }}
                         />
                         <div className="flex justify-between mt-2 text-xs text-gray-500">
                            <span>Compact</span>
                            <span>Large</span>
                         </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                        <div className="flex gap-3">
                            <Activity size={20} className="text-gray-400" />
                            <div>
                                <h4 className="text-sm font-medium">Reduced Motion</h4>
                                <p className="text-xs text-gray-500">Disable animations for faster response</p>
                            </div>
                        </div>
                        <Switch active={reducedMotion} onChange={setReducedMotion} accentColor={accentColor} />
                    </div>
                </div>
             </Section>

             <Section title="Storage & Reset">
                <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
                    <div className="flex justify-between mb-4">
                        <span className="text-sm font-medium">IndexedDB Usage</span>
                        <span className="text-sm font-mono text-gray-400">{formatBytes(usage)} / {formatBytes(quota)}</span>
                    </div>
                    <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden mb-6">
                        <div className="h-full transition-all duration-500" style={{ width: `${percent || 1}%`, backgroundColor: accentColor }} />
                    </div>
                    
                    <div className="flex gap-4">
                        <button onClick={createBackup} className="flex-1 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                            <Download size={16} /> Backup Data
                        </button>
                        <button onClick={hardReset} className="flex-1 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                            <Trash2 size={16} /> Factory Reset
                        </button>
                    </div>
                </div>
             </Section>
        </div>
    );
};

const UserTab = ({ accentColor }: { accentColor: string }) => {
    const { userName, userBio, setUserName, setUserBio } = useSettingsStore();

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Section title="Profile" description="Manage your digital identity.">
                <div className="bg-white/5 rounded-2xl p-6 border border-white/5 flex gap-6 items-start">
                    <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold shadow-lg shrink-0 text-white" style={{ backgroundColor: accentColor }}>
                        {userName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 space-y-4">
                        <div>
                            <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">Display Name</label>
                            <input 
                                type="text" 
                                value={userName}
                                onChange={(e) => setUserName(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-white/30 transition-colors"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">Bio</label>
                            <input 
                                type="text" 
                                value={userBio}
                                onChange={(e) => setUserBio(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-white/30 transition-colors"
                            />
                        </div>
                    </div>
                </div>
            </Section>

            <Section title="Security">
                <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
                     <div className="flex items-center gap-3 opacity-50 cursor-not-allowed">
                        <div className="p-2 bg-white/5 rounded-lg"><Lock size={18} /></div>
                        <div className="flex-1">
                            <h4 className="text-sm font-medium">Lock Screen</h4>
                            <p className="text-xs text-gray-500">Require password on startup (Coming Soon)</p>
                        </div>
                        <Switch active={false} onChange={() => {}} accentColor={accentColor} />
                     </div>
                </div>
            </Section>
        </div>
    );
};

const AboutTab = ({ accentColor }: { accentColor: string }) => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 text-center pt-10">
        <div className="w-24 h-24 mx-auto rounded-3xl flex items-center justify-center shadow-2xl mb-6" style={{ backgroundColor: accentColor, boxShadow: `0 20px 40px -10px ${accentColor}60` }}>
            <Shield size={48} className="text-white" />
        </div>
        
        <div>
            <h1 className="text-3xl font-bold text-white mb-2">AetherOS</h1>
            <p className="text-white/40">Version 1.5.0 (Beta)</p>
        </div>

        <div className="max-w-md mx-auto bg-white/5 rounded-xl p-6 border border-white/5 text-left space-y-2">
            <div className="flex justify-between text-sm">
                <span className="text-gray-500">Kernel</span>
                <span>WebWorker / TypeScript</span>
            </div>
            <div className="flex justify-between text-sm">
                <span className="text-gray-500">Render Engine</span>
                <span>React 18 / Three.js</span>
            </div>
            <div className="flex justify-between text-sm">
                <span className="text-gray-500">Storage</span>
                <span>IndexedDB / LocalStorage</span>
            </div>
        </div>
    </div>
);

// --- UI HELPERS ---

const Section = ({ title, description, children }: any) => (
    <div className="space-y-4">
        <div>
            <h3 className="text-lg font-medium text-white">{title}</h3>
            {description && <p className="text-sm text-gray-500">{description}</p>}
        </div>
        {children}
    </div>
);

const Toggle = ({ label, description, active, onChange, icon, accentColor }: any) => (
    <div className="flex items-center justify-between p-6 bg-white/5 rounded-2xl border border-white/5">
        <div className="flex items-start gap-4">
            <div className={`p-2 rounded-lg ${active ? 'text-white' : 'bg-white/5 text-gray-500'}`} style={active ? { backgroundColor: `${accentColor}30`, color: accentColor } : {}}>
                {icon}
            </div>
            <div className="max-w-[300px]">
                <h4 className="text-sm font-medium">{label}</h4>
                <p className="text-xs text-gray-500 leading-relaxed mt-1">{description}</p>
            </div>
        </div>
        <Switch active={active} onChange={onChange} accentColor={accentColor} />
    </div>
);

const Switch = ({ active, onChange, accentColor }: { active: boolean, onChange: (v: boolean) => void, accentColor: string }) => (
    <button 
        onClick={() => onChange(!active)}
        className={`w-12 h-6 rounded-full relative transition-colors bg-gray-700`}
        style={active ? { backgroundColor: accentColor } : {}}
    >
        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${active ? 'left-7' : 'left-1'}`} />
    </button>
);

export default Settings;
