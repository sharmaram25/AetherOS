import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { startNetworkMonitor } from './kernel/privacy';

startNetworkMonitor();

// Dev-only handle for debugging and automated testing. Stripped from production builds.
if (import.meta.env.DEV) {
  void Promise.all([import('./kernel/windows'), import('./kernel/vfs'), import('./kernel/session')]).then(([w, v, s]) => {
    (window as unknown as Record<string, unknown>).__aether = { wm: w.wm, useWindows: w.useWindows, vfs: v.vfs, useVfs: v.useVfs, session: s.session, useSession: s.useSession };
  });
}

// Ask the browser not to evict our encrypted storage under pressure.
navigator.storage?.persist?.().catch(() => {});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
