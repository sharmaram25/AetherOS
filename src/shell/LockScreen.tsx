import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, HelpCircle, Loader2, Lock, ShieldCheck } from 'lucide-react';
import { useSession, session } from '../kernel/session';
import { useSettings } from '../kernel/settings';
import { getLockout, destroyEverything } from '../kernel/vault';
import { dialog } from '../kernel/dialog';
import { useNow, cx } from '../ui';

export function LockScreen() {
  const now = useNow(1000);
  const { userName, avatarColor, use24h } = useSettings();
  const { header, busy } = useSession();
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [wait, setWait] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const needsPass = header?.mode === 'passphrase';

  useEffect(() => {
    const tick = () => setWait(Math.max(0, Math.ceil((getLockout().until - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const focus = () => inputRef.current?.focus();
    focus();
    const onKey = (e: KeyboardEvent) => {
      if (!needsPass && (e.key === 'Enter' || e.key === ' ')) void submit();
      else if (needsPass && document.activeElement !== inputRef.current && e.key.length === 1) focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const submit = async () => {
    if (busy || wait > 0) return;
    if (needsPass && !pass) return;
    setError('');
    try {
      await session.unlock(needsPass ? pass : undefined);
    } catch (e) {
      setError((e as Error).message);
      setPass('');
      setShake((s) => s + 1);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  };

  const reset = async () => {
    const ok = await dialog.confirm({
      title: 'Erase AetherOS?',
      message: 'Without your passphrase, your encrypted data cannot be recovered. Erasing deletes all files, notes, passwords and settings on this device and starts fresh.',
      confirmLabel: 'Erase everything', danger: true, requireText: 'ERASE',
    });
    if (!ok) return;
    await destroyEverything();
    location.reload();
  };

  const time = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: !use24h }).replace(/\s?[AP]M$/i, '');
  const date = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="absolute inset-0 flex flex-col items-center select-none" onClick={() => !needsPass && submit()}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[40px]" />
      <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.05, duration: 0.5 }} className="relative mt-[12vh] text-center text-white">
        <div className="text-[19px] font-medium text-white/75">{date}</div>
        <div className="text-[112px] leading-none font-semibold tracking-[-0.04em] mt-1" style={{ fontFeatureSettings: '"tnum"' }}>{time}</div>
      </motion.div>

      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.12, duration: 0.5 }} className="relative mt-auto mb-[14vh] flex flex-col items-center text-white">
        <div className="w-[84px] h-[84px] rounded-full flex items-center justify-center text-[34px] font-semibold shadow-2xl ring-4 ring-white/15" style={{ background: `linear-gradient(145deg, ${avatarColor}, ${avatarColor}99)` }}>
          {(userName[0] || 'A').toUpperCase()}
        </div>
        <div className="mt-4 text-[20px] font-semibold">{userName}</div>

        {needsPass ? (
          <motion.form
            key={shake}
            animate={shake ? { x: [0, -10, 10, -8, 8, -4, 4, 0] } : {}}
            transition={{ duration: 0.45 }}
            onSubmit={(e) => { e.preventDefault(); void submit(); }}
            className="mt-5 relative"
          >
            <input
              ref={inputRef}
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              disabled={busy || wait > 0}
              placeholder={wait > 0 ? `Try again in ${wait}s` : 'Enter passphrase'}
              autoComplete="current-password"
              className="w-[280px] h-11 rounded-full bg-white/15 border border-white/20 pl-5 pr-12 text-[14px] text-white placeholder:text-white/50 outline-none backdrop-blur-xl focus:bg-white/20 focus:border-white/40 transition-colors"
            />
            <button type="submit" disabled={busy || !pass} className="absolute right-1.5 top-1.5 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 disabled:opacity-40 flex items-center justify-center transition-colors">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={16} />}
            </button>
          </motion.form>
        ) : (
          <button onClick={(e) => { e.stopPropagation(); void submit(); }} className="mt-5 h-11 px-6 rounded-full bg-white/15 border border-white/20 hover:bg-white/25 backdrop-blur-xl text-[14px] font-medium inline-flex items-center gap-2">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />} Click to unlock
          </button>
        )}

        <div className={cx('mt-3 h-5 text-[12.5px]', error ? 'text-red-300' : 'text-white/60')}>
          {error || (busy && needsPass ? 'Deriving key…' : showHint && header?.hint ? `Hint: ${header.hint}` : '')}
        </div>

        {needsPass && (
          <div className="mt-2 flex items-center gap-4 text-[12px] text-white/55">
            {header?.hint && <button onClick={() => setShowHint(!showHint)} className="hover:text-white inline-flex items-center gap-1"><HelpCircle size={12} /> {showHint ? 'Hide hint' : 'Show hint'}</button>}
            <button onClick={reset} className="hover:text-white">Forgot passphrase?</button>
          </div>
        )}
      </motion.div>

      <div className="absolute bottom-5 left-0 right-0 flex justify-center text-[11.5px] text-white/45 gap-1.5 items-center">
        <ShieldCheck size={13} /> Your data is encrypted with AES-256-GCM {needsPass ? '· key derived from your passphrase' : '· device key'}
      </div>
    </div>
  );
}
