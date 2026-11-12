import { motion } from 'framer-motion';
import { Logo } from './Logo';

export function Boot() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-2xl">
      <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}>
        <Logo size={84} glow />
      </motion.div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mt-8 w-40 h-[3px] rounded-full bg-white/10 overflow-hidden">
        <motion.div className="h-full bg-white/70 rounded-full" initial={{ x: '-100%' }} animate={{ x: '100%' }} transition={{ repeat: Infinity, duration: 1.1, ease: 'easeInOut' }} style={{ width: '50%' }} />
      </motion.div>
      <div className="mt-4 text-[11px] tracking-[0.3em] uppercase text-white/40">Securing your space</div>
    </div>
  );
}
