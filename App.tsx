
import React, { useEffect, useState, Suspense } from 'react';
import { useFileSystem } from './store/useFileSystem';
import { WindowManager } from './components/os/WindowManager';
import { Dock } from './components/os/Dock';
import { Nexus } from './components/os/Nexus';
import { ContextMenu } from './components/os/ContextMenu';
import { NotificationCenter } from './components/os/NotificationCenter';
import { useAmbientLight } from './hooks/useAmbientLight';
import { DesktopOverlay } from './components/os/DesktopOverlay';
import { useTheme } from './hooks/useTheme';
import { useSettingsStore } from './stores/settingsStore';

// Lazy load 3D components to avoid blocking main thread on boot
const WallpaperEngine = React.lazy(() => import('./components/3d/WallpaperEngine'));
const DesktopWidgets = React.lazy(() => import('./components/3d/DesktopWidgets'));

// Simple Error Boundary for the 3D layer
class ThreeErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error("3D Context Error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) return <div className="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#0f172a]" />;
    return this.props.children;
  }
}

const App = () => {
  const { init } = useFileSystem();
  const [isNexusOpen, setIsNexusOpen] = useState(false);
  const { ecoMode } = useSettingsStore();
  
  useAmbientLight(); // Start the Mica Lighting Engine
  useTheme(); // Initialize Global Theme Engine

  useEffect(() => {
    init();
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0f172a] select-none text-white">
      {/* 3D Background Layers with Error Boundary - Conditionally Rendered via Eco Mode */}
      {!ecoMode && (
          <ThreeErrorBoundary>
            <Suspense fallback={<div className="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#0f172a]" />}>
              <WallpaperEngine />
              <DesktopWidgets />
            </Suspense>
          </ThreeErrorBoundary>
      )}

      {/* Fallback Background for Eco Mode */}
      {ecoMode && (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-black -z-50" />
      )}

      {/* Desktop Overlay (Clock & Quote) */}
      <DesktopOverlay />

      {/* OS UI Layers */}
      <WindowManager />
      
      {/* Controls */}
      <Dock onNexusClick={() => setIsNexusOpen(true)} />
      
      {/* Overlays */}
      <Nexus isOpen={isNexusOpen} onClose={() => setIsNexusOpen(false)} />
      <ContextMenu />
      <NotificationCenter />
    </div>
  );
};

export default App;
