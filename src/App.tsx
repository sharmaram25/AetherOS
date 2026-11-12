import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSession, session } from './kernel/session';
import { useThemeEngine } from './shell/theme';
import { Wallpaper } from './shell/Wallpaper';
import { Boot } from './shell/Boot';
import { Setup } from './shell/Setup';
import { LockScreen } from './shell/LockScreen';
import { Desktop } from './shell/Desktop';
import { Dialogs } from './shell/Dialogs';
import { Toasts } from './shell/Toasts';
import { MenuHost } from './ui';

export default function App() {
  useThemeEngine();
  const phase = useSession((s) => s.phase);

  useEffect(() => {
    void session.boot();
  }, []);

  // Block the browser's own context menu everywhere except editable fields.
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, [contenteditable="true"], .cm-editor, .allow-native-menu')) return;
      e.preventDefault();
    };
    window.addEventListener('contextmenu', fn);
    return () => window.removeEventListener('contextmenu', fn);
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden text-fg">
      <Wallpaper forceBuiltIn={phase !== 'desktop'} />
      {phase === 'boot' && <div className="absolute inset-0"><Boot /></div>}
      <AnimatePresence>
        {phase === 'setup' && (
          <motion.div key="setup" className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.02 }} transition={{ duration: 0.35 }}>
            <Setup />
          </motion.div>
        )}
        {phase === 'locked' && (
          <motion.div key="lock" className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.04, filter: 'blur(8px)' }} transition={{ duration: 0.35 }}>
            <LockScreen />
          </motion.div>
        )}
        {phase === 'desktop' && (
          <motion.div key="desktop" className="absolute inset-0" initial={{ opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}>
            <Desktop />
          </motion.div>
        )}
      </AnimatePresence>
      <Dialogs />
      <Toasts />
      <MenuHost />
    </div>
  );
}
