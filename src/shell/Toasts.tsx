import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';
import { useNotify, dismissToast, type Note } from '../kernel/notify';
import { getApp } from '../kernel/registry';
import { AppGlyph, cx } from '../ui';

const TONE = {
  success: { icon: CheckCircle2, cls: 'text-success' },
  warn: { icon: AlertTriangle, cls: 'text-warn' },
  error: { icon: XCircle, cls: 'text-danger' },
  info: { icon: Info, cls: 'text-accent' },
};

function Toast({ n }: { n: Note }) {
  const [hover, setHover] = useState(false);
  const left = useRef(n.transient ? 2600 : 5500);
  useEffect(() => {
    if (hover) return;
    const start = Date.now();
    const t = setTimeout(() => dismissToast(n.id), left.current);
    return () => { clearTimeout(t); left.current -= Date.now() - start; };
  }, [hover, n.id]);

  const app = n.appId ? getApp(n.appId) : null;
  const tone = TONE[n.tone ?? 'info'];

  if (n.transient) {
    return (
      <motion.div
        layout initial={{ opacity: 0, y: -12, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
        className="self-center glass rounded-full border border-line-strong shadow-xl px-4 h-10 flex items-center gap-2 text-[13px] font-medium pointer-events-auto"
      >
        <tone.icon size={15} className={tone.cls} /> {n.title}
        {n.body && <span className="text-muted font-normal">· {n.body}</span>}
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 60, scale: 0.96 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 60, transition: { duration: 0.18 } }}
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className="group relative w-[360px] glass rounded-2xl border border-line-strong shadow-2xl shadow-black/25 p-3.5 flex gap-3 pointer-events-auto"
    >
      {app ? <AppGlyph app={app} size={34} /> : <div className={cx('w-[34px] h-[34px] rounded-xl bg-hover flex items-center justify-center shrink-0', tone.cls)}><tone.icon size={18} /></div>}
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold leading-tight">{n.title}</div>
        {n.body && <div className="text-[12.5px] text-muted mt-0.5 line-clamp-3 break-words">{n.body}</div>}
        {n.actions && (
          <div className="flex gap-1.5 mt-2.5">
            {n.actions.map((a) => (
              <button key={a.label} onClick={() => { a.run(); dismissToast(n.id); }} className="h-7 px-3 rounded-lg bg-active hover:bg-line-strong text-[12px] font-medium transition-colors">{a.label}</button>
            ))}
          </div>
        )}
      </div>
      <button onClick={() => dismissToast(n.id)} className="absolute top-2 right-2 w-6 h-6 rounded-md opacity-0 group-hover:opacity-100 hover:bg-hover flex items-center justify-center text-muted transition-opacity"><X size={13} /></button>
    </motion.div>
  );
}

export function Toasts() {
  const toasts = useNotify((s) => s.toasts);
  return (
    <div className="fixed top-[40px] right-3 left-3 z-[9600] flex flex-col items-end gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => <Toast key={t.id} n={t} />)}
      </AnimatePresence>
    </div>
  );
}
