import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, CloudOff, Cpu, Eye, EyeOff, Ghost, KeyRound, Lock, Moon, MonitorSmartphone, ShieldCheck, Sun, SunMoon } from 'lucide-react';
import { Logo } from './Logo';
import { Button, Input, cx } from '../ui';
import { useSettings, ACCENTS, type ThemePref } from '../kernel/settings';
import { session, useSession } from '../kernel/session';
import { strength } from '../lib/strength';
import { readLegacyV1 } from '../kernel/db';
import { WALLPAPERS } from './Wallpaper';

const AVATAR_COLORS = ['#6d7cff', '#8b5cf6', '#ec4899', '#f97316', '#22c55e', '#14b8a6', '#0ea5e9', '#64748b'];

export function Setup() {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const s = useSettings();
  const busy = useSession((x) => x.busy);
  const [name, setName] = useState(s.userName === 'Aether User' ? '' : s.userName);
  const [mode, setMode] = useState<'passphrase' | 'device'>('passphrase');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [hint, setHint] = useState('');
  const [show, setShow] = useState(false);
  const [legacyCount, setLegacyCount] = useState(0);
  const [importLegacy, setImportLegacy] = useState(true);
  const [error, setError] = useState('');
  const st = useMemo(() => strength(pass, true), [pass]);

  useEffect(() => { readLegacyV1().then((l) => setLegacyCount(l.length)); }, []);

  const go = (n: number) => { setDir(n > step ? 1 : -1); setError(''); setStep(n); };

  const securityValid = mode === 'device' || (pass.length >= 8 && pass === pass2 && st.score >= 2);

  const finish = async (guest = false) => {
    setError('');
    if (!guest) s.set({ userName: name.trim() || 'Aether User' });
    else s.set({ userName: 'Guest' });
    try {
      await session.setup({ passphrase: !guest && mode === 'passphrase' ? pass : null, hint: hint.trim() || undefined, guest, importLegacy: legacyCount > 0 && importLegacy });
    } catch (e) {
      setError((e as Error).message);
      useSession.setState({ busy: false });
    }
  };

  const steps = [
    // 0 — Welcome
    <div key="w" className="flex flex-col items-center text-center">
      <Logo size={76} glow />
      <h1 className="mt-6 text-[34px] font-semibold tracking-tight">Welcome to AetherOS</h1>
      <p className="mt-2 text-muted text-[15px] max-w-md">A private operating system that lives in your browser. Your files are encrypted on this device — nobody else can read them. Not even us.</p>
      <div className="grid grid-cols-3 gap-3 mt-8 w-full">
        {[
          { icon: ShieldCheck, t: 'Encrypted', d: 'AES-256 at rest, always' },
          { icon: CloudOff, t: 'No cloud', d: 'Zero accounts or tracking' },
          { icon: Cpu, t: 'On-device', d: 'Even the AI runs locally' },
        ].map((f) => (
          <div key={f.t} className="rounded-xl bg-hover border border-line p-4 text-left">
            <f.icon size={20} className="text-accent" />
            <div className="mt-3 font-semibold text-[13.5px]">{f.t}</div>
            <div className="text-[12px] text-muted mt-0.5">{f.d}</div>
          </div>
        ))}
      </div>
      <Button variant="primary" size="lg" className="mt-8 w-full" onClick={() => go(1)}>Get started <ArrowRight size={16} /></Button>
      <button onClick={() => finish(true)} disabled={busy} className="mt-3 text-[12.5px] text-muted hover:text-fg inline-flex items-center gap-1.5"><Ghost size={13} /> Try a guest session — nothing is saved</button>
    </div>,

    // 1 — Profile
    <div key="p">
      <StepHeader n={1} title="What should we call you?" sub="This stays on this device. It's only used to greet you." />
      <div className="flex items-center gap-4 mt-6">
        <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-semibold text-white shrink-0 shadow-lg" style={{ background: `linear-gradient(145deg, ${s.avatarColor}, ${s.avatarColor}aa)` }}>
          {(name.trim()[0] || 'A').toUpperCase()}
        </div>
        <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="h-11 text-[15px]" maxLength={40} onKeyDown={(e) => e.key === 'Enter' && go(2)} />
      </div>
      <div className="flex gap-2 mt-4 ml-20">
        {AVATAR_COLORS.map((c) => (
          <button key={c} onClick={() => s.set({ avatarColor: c })} className={cx('w-6 h-6 rounded-full transition-transform', s.avatarColor === c && 'ring-2 ring-offset-2 ring-offset-transparent ring-white scale-110')} style={{ background: c }} />
        ))}
      </div>
      <Nav onBack={() => go(0)} onNext={() => go(2)} />
    </div>,

    // 2 — Security
    <div key="s">
      <StepHeader n={2} title="Protect your space" sub="Everything you store is encrypted. Choose how the key is unlocked." />
      <div className="grid grid-cols-2 gap-3 mt-6">
        <Choice active={mode === 'passphrase'} onClick={() => setMode('passphrase')} icon={KeyRound} title="Passphrase" badge="Recommended" desc="Only you can unlock. Protects against anyone with access to this device." />
        <Choice active={mode === 'device'} onClick={() => setMode('device')} icon={MonitorSmartphone} title="This device" desc="Encrypted with a hidden device key. Opens without a password." />
      </div>
      {mode === 'passphrase' ? (
        <div className="mt-5 space-y-2.5">
          <div className="relative">
            <Input type={show ? 'text' : 'password'} autoFocus value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Create a passphrase (8+ characters)" className="h-10 pr-10" />
            <button onClick={() => setShow(!show)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint hover:text-fg">{show ? <EyeOff size={15} /> : <Eye size={15} />}</button>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 flex gap-1">
              {[0, 1, 2, 3].map((i) => <div key={i} className="h-1 flex-1 rounded-full transition-colors" style={{ background: pass && st.score > i ? st.color : 'var(--line-strong)' }} />)}
            </div>
            <span className="text-[11.5px] w-56 text-right" style={{ color: pass ? st.color : 'var(--faint)' }}>{pass ? `${st.label} · cracking takes ${st.crack}` : 'Tip: use 4+ random words'}</span>
          </div>
          <Input type={show ? 'text' : 'password'} value={pass2} onChange={(e) => setPass2(e.target.value)} placeholder="Confirm passphrase" className={cx('h-10', pass2 && pass2 !== pass && 'border-danger')} />
          <Input value={hint} onChange={(e) => setHint(e.target.value)} placeholder="Optional hint (visible on the lock screen)" className="h-10" />
          <p className="text-[12px] text-warn/90 flex gap-2 pt-1"><Lock size={13} className="shrink-0 mt-0.5" /> There is no reset. If you forget your passphrase, your data cannot be recovered — by design.</p>
        </div>
      ) : (
        <p className="mt-5 text-[12.5px] text-muted leading-relaxed rounded-xl bg-hover border border-line p-3.5">Your data is still encrypted with AES-256-GCM, using a non-extractable key held by this browser. It protects your files from being read as raw storage, but anyone who can open this browser profile can open AetherOS. You can add a passphrase later in Settings.</p>
      )}
      {legacyCount > 0 && (
        <label className="mt-4 flex items-center gap-2 text-[12.5px] text-muted cursor-pointer">
          <input type="checkbox" checked={importLegacy} onChange={(e) => setImportLegacy(e.target.checked)} className="accent-[var(--accent)]" />
          Import {legacyCount} file{legacyCount > 1 ? 's' : ''} from AetherOS v1 (then securely remove the unencrypted copy)
        </label>
      )}
      <Nav onBack={() => go(1)} onNext={() => go(3)} disabled={!securityValid} />
    </div>,

    // 3 — Personalize
    <div key="l">
      <StepHeader n={3} title="Make it yours" sub="You can change all of this later in Settings." />
      <div className="mt-6 space-y-5">
        <div>
          <Label>Appearance</Label>
          <div className="grid grid-cols-3 gap-2">
            {([['dark', 'Dark', Moon], ['light', 'Light', Sun], ['auto', 'Auto', SunMoon]] as [ThemePref, string, typeof Moon][]).map(([v, l, I]) => (
              <button key={v} onClick={() => s.set({ theme: v })} className={cx('h-11 rounded-xl border flex items-center justify-center gap-2 text-[13px] font-medium transition-all', s.theme === v ? 'border-accent bg-accent/12 text-fg' : 'border-line bg-hover text-muted hover:text-fg')}>
                <I size={15} /> {l}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label>Accent</Label>
          <div className="flex gap-2 flex-wrap">
            {ACCENTS.map((c) => (
              <button key={c} onClick={() => s.set({ accent: c })} className="w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110" style={{ background: c }}>
                {s.accent === c && <Check size={15} className="text-white drop-shadow" />}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label>Wallpaper</Label>
          <div className="grid grid-cols-4 gap-2">
            {WALLPAPERS.map((w) => (
              <button key={w.id} onClick={() => s.set({ wallpaper: w.id, theme: w.light && s.theme === 'dark' ? 'light' : !w.light && s.theme === 'light' ? 'dark' : s.theme })} className={cx('h-14 rounded-xl overflow-hidden relative border-2 transition-all', s.wallpaper === w.id ? 'border-accent scale-[1.03]' : 'border-transparent opacity-80 hover:opacity-100')}
                style={{ background: `radial-gradient(90% 90% at 25% 20%, ${w.colors[1]}, transparent 70%), radial-gradient(90% 90% at 80% 90%, ${w.colors[2]}, transparent 70%), ${w.colors[0]}` }}>
                <span className={cx('absolute bottom-1 left-2 text-[10.5px] font-medium', w.light ? 'text-black/60' : 'text-white/80')}>{w.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      {error && <div className="mt-4 text-[12.5px] text-danger">{error}</div>}
      <div className="flex justify-between mt-8">
        <Button variant="ghost" onClick={() => go(2)} disabled={busy}><ArrowLeft size={15} /> Back</Button>
        <Button variant="primary" size="lg" onClick={() => finish(false)} loading={busy}>
          {busy ? (mode === 'passphrase' ? 'Deriving keys…' : 'Encrypting…') : <>Create my space <ShieldCheck size={16} /></>}
        </Button>
      </div>
    </div>,
  ];

  return (
    <div className="absolute inset-0 flex items-center justify-center p-6 overflow-auto">
      <div className="absolute inset-0 bg-black/25" />
      <div className="relative w-full max-w-[560px] glass rounded-[28px] border border-line-strong shadow-2xl shadow-black/40 p-9 overflow-hidden">
        {step > 0 && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-line">
            <motion.div className="h-full bg-accent" animate={{ width: `${(step / 3) * 100}%` }} transition={{ type: 'spring', stiffness: 200, damping: 30 }} />
          </div>
        )}
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            initial={{ opacity: 0, x: dir * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -40 }}
            transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {steps[step]}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function StepHeader({ n, title, sub }: { n: number; title: string; sub: string }) {
  return (
    <div>
      <div className="text-[11.5px] font-semibold text-accent uppercase tracking-widest">Step {n} of 3</div>
      <h2 className="mt-2 text-[24px] font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 text-muted text-[13.5px]">{sub}</p>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[12px] font-semibold text-muted mb-2">{children}</div>;
}

function Nav({ onBack, onNext, disabled }: { onBack: () => void; onNext: () => void; disabled?: boolean }) {
  return (
    <div className="flex justify-between mt-8">
      <Button variant="ghost" onClick={onBack}><ArrowLeft size={15} /> Back</Button>
      <Button variant="primary" size="lg" onClick={onNext} disabled={disabled}>Continue <ArrowRight size={16} /></Button>
    </div>
  );
}

function Choice({ active, onClick, icon: Icon, title, desc, badge }: { active: boolean; onClick: () => void; icon: typeof Lock; title: string; desc: string; badge?: string }) {
  return (
    <button onClick={onClick} className={cx('text-left rounded-xl border p-4 transition-all relative', active ? 'border-accent bg-accent/10 ring-3 ring-accent/15' : 'border-line bg-hover hover:border-line-strong')}>
      <div className="flex items-center justify-between">
        <Icon size={20} className={active ? 'text-accent' : 'text-muted'} />
        {badge && <span className="text-[10px] font-semibold uppercase tracking-wide text-accent">{badge}</span>}
      </div>
      <div className="mt-3 font-semibold text-[13.5px]">{title}</div>
      <div className="text-[12px] text-muted mt-1 leading-snug">{desc}</div>
    </button>
  );
}
