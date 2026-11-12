import { useEffect, useMemo, useState } from 'react';
import {
  User, Palette, Monitor, ShieldCheck, Bell, HardDrive, Keyboard, Info, Check, Moon, Sun, SunMoon, Upload, Image as ImageIcon, KeyRound,
  Lock, Download, RotateCcw, Trash2, AlertTriangle, Search, Eye, Clipboard, Camera, Link2, Timer, Sparkles, Droplets, Accessibility,
} from 'lucide-react';
import type { AppProps } from '../kernel/registry';
import { useSettings, ACCENTS, type ThemePref } from '../kernel/settings';
import { useSession } from '../kernel/session';
import { rekeyVault, verifyPassphrase, destroyEverything, readHeader } from '../kernel/vault';
import { vfs, useVfs } from '../kernel/vfs';
import { wm } from '../kernel/windows';
import { dialog } from '../kernel/dialog';
import { toast, notify } from '../kernel/notify';
import { createBackup, readBackupInfo, restoreBackup } from '../kernel/backup';
import { importHostFiles, pickHostFiles } from '../kernel/launcher';
import { WALLPAPERS } from '../shell/Wallpaper';
import { shell } from '../shell/store';
import { Logo } from '../shell/Logo';
import { strength } from '../lib/strength';
import { formatBytes, kindOf } from '../lib/mime';
import { HOME } from '../lib/path';
import { Button, Card, Row, Switch, Slider, Select, Segmented, Input, Badge, cx, useObjectUrl } from '../ui';

const PAGES = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'desktop', label: 'Desktop & Dock', icon: Monitor },
  { id: 'privacy', label: 'Privacy & Security', icon: ShieldCheck },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'storage', label: 'Storage & Backup', icon: HardDrive },
  { id: 'accessibility', label: 'Accessibility', icon: Accessibility },
  { id: 'keyboard', label: 'Keyboard', icon: Keyboard },
  { id: 'about', label: 'About', icon: Info },
] as const;
type PageId = (typeof PAGES)[number]['id'];

export default function Settings({ win }: AppProps) {
  const [page, setPage] = useState<PageId>((win.data?.page as PageId) ?? 'appearance');
  const [q, setQ] = useState('');
  useEffect(() => { if (win.data?.page) setPage(win.data.page); }, [win.data?._n]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = PAGES.filter((p) => p.label.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="h-full flex">
      <div className="w-[210px] shrink-0 border-r border-line bg-hover/40 p-2 flex flex-col gap-0.5">
        <div className="p-1 pb-2"><Input icon={Search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="h-7" /></div>
        {filtered.map((p) => (
          <button key={p.id} onClick={() => setPage(p.id)} className={cx('flex items-center gap-2.5 h-8 px-2.5 rounded-lg text-[13px] text-left transition-colors', page === p.id ? 'bg-accent text-accent-fg font-medium' : 'text-fg hover:bg-hover')}>
            <p.icon size={15} className={page === p.id ? '' : 'text-muted'} /> {p.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[660px] mx-auto p-7 space-y-6">
          <h1 className="text-[22px] font-semibold tracking-tight">{PAGES.find((p) => p.id === page)?.label}</h1>
          {page === 'profile' && <ProfilePage />}
          {page === 'appearance' && <AppearancePage />}
          {page === 'desktop' && <DesktopPage />}
          {page === 'privacy' && <PrivacyPage />}
          {page === 'notifications' && <NotificationsPage />}
          {page === 'storage' && <StoragePage />}
          {page === 'accessibility' && <AccessibilityPage />}
          {page === 'keyboard' && <KeyboardPage />}
          {page === 'about' && <AboutPage />}
        </div>
      </div>
    </div>
  );
}

function Group({ title, children, desc }: { title?: string; children: React.ReactNode; desc?: string }) {
  return (
    <section>
      {title && <div className="text-[12px] font-semibold text-muted mb-2 px-1">{title}</div>}
      <Card>{children}</Card>
      {desc && <div className="text-[11.5px] text-faint mt-1.5 px-1 leading-relaxed">{desc}</div>}
    </section>
  );
}

/* ---------- Profile ---------- */
function ProfilePage() {
  const s = useSettings();
  const mode = useSession((x) => x.mode);
  const COLORS = ['#6d7cff', '#8b5cf6', '#ec4899', '#f97316', '#22c55e', '#14b8a6', '#0ea5e9', '#64748b'];
  return (
    <>
      <Card className="p-5 flex items-center gap-5">
        <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-semibold text-white shadow-lg shrink-0" style={{ background: `linear-gradient(145deg, ${s.avatarColor}, ${s.avatarColor}99)` }}>{(s.userName[0] || 'A').toUpperCase()}</div>
        <div className="flex-1 space-y-2.5">
          <Input value={s.userName} onChange={(e) => s.set({ userName: e.target.value.slice(0, 40) })} className="h-9 text-[15px] font-semibold" />
          <div className="flex gap-1.5">{COLORS.map((c) => <button key={c} onClick={() => s.set({ avatarColor: c })} className={cx('w-5 h-5 rounded-full', s.avatarColor === c && 'ring-2 ring-offset-2 ring-offset-transparent ring-accent')} style={{ background: c }} />)}</div>
        </div>
      </Card>
      <Group title="Account">
        <Row icon={ShieldCheck} title="Account type" desc="AetherOS has no cloud accounts. Your identity exists only on this device.">
          <Badge tone="success">Local only</Badge>
        </Row>
        <Row icon={KeyRound} title="Unlock method" desc={mode === 'passphrase' ? 'Passphrase-derived key (PBKDF2-SHA256, 600,000 rounds)' : mode === 'guest' ? 'Guest session — memory only' : 'Non-extractable device key'}>
          <Badge tone={mode === 'passphrase' ? 'success' : 'warn'}>{mode}</Badge>
        </Row>
      </Group>
    </>
  );
}

/* ---------- Appearance ---------- */
function CustomThumb({ path, active, onClick }: { path: string; active: boolean; onClick: () => void }) {
  const url = useObjectUrl(() => vfs.objectUrl(path), [path]);
  return (
    <button onClick={onClick} className={cx('aspect-[16/10] rounded-xl overflow-hidden border-2 transition-all bg-hover', active ? 'border-accent scale-[1.03]' : 'border-transparent hover:border-line-strong')}>
      {url && <img src={url} className="w-full h-full object-cover" alt="" />}
    </button>
  );
}

function AppearancePage() {
  const s = useSettings();
  const nodes = useVfs((x) => x.nodes);
  const pictures = useMemo(() => vfs.walk(`${HOME}/Pictures`, nodes).filter((n) => n.kind === 'file' && kindOf(n.path) === 'image').slice(0, 11), [nodes]);
  const importWall = async () => {
    const files = await pickHostFiles({ accept: 'image/*', multiple: false });
    if (!files.length) return;
    const [p] = await importHostFiles(files, `${HOME}/Pictures`);
    if (p) s.set({ wallpaper: 'custom:' + p });
  };
  return (
    <>
      <Group title="Theme">
        <div className="p-4 grid grid-cols-3 gap-3">
          {([['light', 'Light', Sun], ['dark', 'Dark', Moon], ['auto', 'Automatic', SunMoon]] as [ThemePref, string, typeof Sun][]).map(([v, l, I]) => (
            <button key={v} onClick={() => s.set({ theme: v })} className="flex flex-col items-center gap-2 group">
              <div className={cx('w-full aspect-[16/10] rounded-xl border-2 overflow-hidden transition-all', s.theme === v ? 'border-accent' : 'border-line group-hover:border-line-strong')}
                style={{ background: v === 'light' ? 'linear-gradient(135deg,#eef0f6,#d9def0)' : v === 'dark' ? 'linear-gradient(135deg,#14161f,#262a3a)' : 'linear-gradient(135deg,#eef0f6 50%,#14161f 50%)' }}>
                <div className="m-2.5 h-3 w-12 rounded-full" style={{ background: s.accent }} />
                <div className={cx('mx-2.5 h-8 rounded-md', v === 'light' ? 'bg-white/80' : v === 'dark' ? 'bg-white/10' : 'bg-gradient-to-r from-white/80 to-white/10')} />
              </div>
              <span className="text-[12.5px] flex items-center gap-1.5"><I size={13} /> {l}</span>
            </button>
          ))}
        </div>
        <Row title="Accent color">
          <div className="flex gap-1.5">
            {ACCENTS.map((c) => (
              <button key={c} onClick={() => s.set({ accent: c })} className="w-6 h-6 rounded-full flex items-center justify-center transition-transform hover:scale-110" style={{ background: c }}>
                {s.accent === c && <Check size={13} className="text-white" />}
              </button>
            ))}
            <label className="w-6 h-6 rounded-full overflow-hidden cursor-pointer border border-line-strong relative" title="Custom" style={{ background: 'conic-gradient(red,yellow,lime,cyan,blue,magenta,red)' }}>
              <input type="color" value={s.accent} onChange={(e) => s.set({ accent: e.target.value })} className="opacity-0 absolute inset-0 cursor-pointer" />
            </label>
          </div>
        </Row>
      </Group>
      <Group title="Wallpaper">
        <div className="p-4 grid grid-cols-4 gap-3">
          {WALLPAPERS.map((w) => (
            <button key={w.id} onClick={() => s.set({ wallpaper: w.id })} className="flex flex-col gap-1.5 items-start">
              <div className={cx('w-full aspect-[16/10] rounded-xl border-2 transition-all relative overflow-hidden', s.wallpaper === w.id ? 'border-accent scale-[1.03]' : 'border-transparent hover:border-line-strong')}
                style={{ background: `radial-gradient(90% 90% at 25% 20%, ${w.colors[1]}, transparent 70%), radial-gradient(90% 90% at 80% 90%, ${w.colors[2]}, transparent 70%), radial-gradient(60% 60% at 70% 30%, ${w.colors[3]}88, transparent 70%), ${w.colors[0]}` }}>
                {s.wallpaper === w.id && <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-accent flex items-center justify-center"><Check size={12} className="text-accent-fg" /></div>}
              </div>
              <span className="text-[11.5px] text-muted">{w.name}</span>
            </button>
          ))}
        </div>
        <div className="px-4 pb-4">
          <div className="text-[12px] text-muted mb-2">From your Pictures</div>
          <div className="grid grid-cols-6 gap-2">
            {pictures.map((p) => <CustomThumb key={p.path} path={p.path} active={s.wallpaper === 'custom:' + p.path} onClick={() => s.set({ wallpaper: 'custom:' + p.path })} />)}
            <button onClick={importWall} className="aspect-[16/10] rounded-xl border-2 border-dashed border-line-strong flex items-center justify-center text-muted hover:text-fg hover:border-accent transition-colors" title="Import image"><Upload size={16} /></button>
          </div>
        </div>
        <Row icon={Sparkles} title="Live wallpaper" desc="Animated GPU shader, throttled to 30fps and paused when covered.">
          <Switch checked={s.animatedWallpaper} onChange={(v) => s.set({ animatedWallpaper: v })} />
        </Row>
      </Group>
      <Group title="Effects">
        <Row icon={Droplets} title="Transparency & blur" desc="Turn off for maximum performance on older devices.">
          <Switch checked={s.blur} onChange={(v) => s.set({ blur: v })} />
        </Row>
      </Group>
    </>
  );
}

/* ---------- Desktop & Dock ---------- */
function DesktopPage() {
  const s = useSettings();
  return (
    <>
      <Group title="Dock">
        <Row title="Size"><div className="w-48"><Slider value={s.dockSize} min={36} max={72} onChange={(v) => s.set({ dockSize: v })} /></div></Row>
        <Row title="Magnification" desc="Icons grow as you hover over the dock."><Switch checked={s.dockMagnify} onChange={(v) => s.set({ dockMagnify: v })} /></Row>
        <Row title="Automatically hide">
          <Select value={s.dockAutohide} onChange={(v) => s.set({ dockAutohide: v as typeof s.dockAutohide })} options={[{ value: 'never', label: 'Never' }, { value: 'maximized', label: 'When a window is maximized' }, { value: 'always', label: 'Always' }]} />
        </Row>
        <Row title="Pinned apps" desc="Right-click any app in the dock to pin or unpin it."><Button size="sm" icon={RotateCcw} onClick={() => s.set({ pinned: ['files', 'notes', 'code', 'terminal', 'keychain', 'calendar', 'tasks', 'photos', 'cortex', 'store', 'settings'] })}>Reset</Button></Row>
      </Group>
      <Group title="Desktop">
        <Row title="Show files on desktop" desc="Items in ~/Desktop appear as icons."><Switch checked={s.showDesktopIcons} onChange={(v) => s.set({ showDesktopIcons: v })} /></Row>
        <Row title="Show widgets" desc="Clock, agenda, tasks and privacy status."><Switch checked={s.showWidgets} onChange={(v) => s.set({ showWidgets: v })} /></Row>
        <Row title="Reopen windows after unlocking"><Switch checked={s.restoreSession} onChange={(v) => s.set({ restoreSession: v })} /></Row>
      </Group>
      <Group title="Clock">
        <Row title="24-hour time"><Switch checked={s.use24h} onChange={(v) => s.set({ use24h: v })} /></Row>
        <Row title="Show seconds in the menu bar"><Switch checked={s.showSeconds} onChange={(v) => s.set({ showSeconds: v })} /></Row>
      </Group>
    </>
  );
}

/* ---------- Privacy ---------- */
function PrivacyPage() {
  const s = useSettings();
  const mode = useSession((x) => x.mode);
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [next2, setNext2] = useState('');
  const [hint, setHint] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const st = strength(next, true);

  const apply = async (remove = false) => {
    setBusy(true);
    try {
      if (mode === 'passphrase' && !(await verifyPassphrase(cur))) { toast('Current passphrase is incorrect', 'error'); return; }
      const header = await rekeyVault(mode === 'passphrase' ? cur : undefined, remove ? null : next, hint);
      useSession.setState({ header, mode: header.mode });
      notify({ appId: 'settings', title: remove ? 'Passphrase removed' : mode === 'passphrase' ? 'Passphrase changed' : 'Passphrase set', body: 'Your data key was re-wrapped. No files needed to be re-encrypted.', tone: 'success' });
      setCur(''); setNext(''); setNext2(''); setHint(''); setOpen(false);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally { setBusy(false); }
  };

  const valid = next.length >= 8 && next === next2 && st.score >= 2 && (mode !== 'passphrase' || cur.length > 0);

  return (
    <>
      <div className="rounded-2xl p-5 bg-gradient-to-br from-emerald-500/15 to-sky-500/10 border border-emerald-500/25 flex gap-4 items-center">
        <ShieldCheck size={34} className="text-success shrink-0" />
        <div className="flex-1">
          <div className="font-semibold">Your data is encrypted</div>
          <div className="text-[12.5px] text-muted">AES-256-GCM · {mode === 'passphrase' ? 'unlocked by your passphrase' : mode === 'guest' ? 'stored in memory only' : 'unlocked by this device'} · no telemetry · no cloud</div>
        </div>
        <Button size="sm" onClick={() => { wm.open('shield'); }}>Open Shield</Button>
      </div>

      {mode !== 'guest' && (
        <Group title="Passphrase" desc="Changing your passphrase re-wraps your data key instantly. There is no recovery — keep it somewhere safe.">
          <Row icon={KeyRound} title={mode === 'passphrase' ? 'Change passphrase' : 'Set a passphrase'} desc={mode === 'passphrase' ? 'Required to unlock AetherOS on this device.' : 'Recommended: protects your data from anyone using this browser.'}>
            <Button size="sm" variant={mode === 'passphrase' ? 'secondary' : 'primary'} onClick={() => setOpen(!open)}>{open ? 'Cancel' : mode === 'passphrase' ? 'Change…' : 'Set passphrase…'}</Button>
          </Row>
          {open && (
            <div className="p-4 space-y-2.5 border-t border-line">
              {mode === 'passphrase' && <Input type="password" value={cur} onChange={(e) => setCur(e.target.value)} placeholder="Current passphrase" />}
              <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="New passphrase" />
              {next && <div className="text-[11.5px]" style={{ color: st.color }}>{st.label} · estimated cracking time {st.crack}</div>}
              <Input type="password" value={next2} onChange={(e) => setNext2(e.target.value)} placeholder="Confirm new passphrase" />
              <Input value={hint} onChange={(e) => setHint(e.target.value)} placeholder="Hint (optional, shown on lock screen)" />
              <div className="flex justify-between pt-1">
                {mode === 'passphrase' ? <Button size="sm" variant="ghost" className="text-danger" disabled={!cur || busy} onClick={async () => { if (await dialog.confirm({ title: 'Remove passphrase?', message: 'AetherOS will unlock without a password using a device key. Anyone with access to this browser could open your data.', danger: true, confirmLabel: 'Remove' })) void apply(true); }}>Remove passphrase</Button> : <span />}
                <Button size="sm" variant="primary" loading={busy} disabled={!valid} onClick={() => apply(false)}>Save passphrase</Button>
              </div>
            </div>
          )}
        </Group>
      )}

      <Group title="Locking">
        <Row icon={Timer} title="Auto-lock after inactivity">
          <Select value={String(s.autoLockMinutes)} onChange={(v) => s.set({ autoLockMinutes: Number(v) })} options={[{ value: '1', label: '1 minute' }, { value: '5', label: '5 minutes' }, { value: '15', label: '15 minutes' }, { value: '30', label: '30 minutes' }, { value: '60', label: '1 hour' }, { value: '0', label: 'Never' }]} />
        </Row>
        <Row icon={Lock} title="Lock when switching away" desc="Locks as soon as this tab is hidden."><Switch checked={s.lockOnHide} onChange={(v) => s.set({ lockOnHide: v })} /></Row>
        <Row icon={Eye} title="Privacy shield" desc="Blur all windows when AetherOS loses focus — great for screen sharing and public places."><Switch checked={s.privacyShield} onChange={(v) => s.set({ privacyShield: v })} /></Row>
      </Group>

      <Group title="Data hygiene">
        <Row icon={Clipboard} title="Clear copied secrets" desc="Passwords and 2FA codes are wiped from the clipboard after this delay.">
          <Select value={String(s.clipboardClearSeconds)} onChange={(v) => s.set({ clipboardClearSeconds: Number(v) })} options={[{ value: '15', label: '15 seconds' }, { value: '45', label: '45 seconds' }, { value: '90', label: '90 seconds' }, { value: '0', label: 'Never' }]} />
        </Row>
        <Row icon={Camera} title="Strip photo metadata on import" desc="Removes GPS location, camera serial and other EXIF data from JPEG/WebP photos."><Switch checked={s.stripMetadata} onChange={(v) => s.set({ stripMetadata: v })} /></Row>
        <Row icon={Link2} title="Confirm before opening external links" desc="Leaving AetherOS reveals your IP address to the destination."><Switch checked={s.confirmExternalLinks} onChange={(v) => s.set({ confirmExternalLinks: v })} /></Row>
      </Group>
    </>
  );
}

function NotificationsPage() {
  const s = useSettings();
  return (
    <Group>
      <Row icon={Bell} title="Do Not Disturb" desc="Silence banners and sounds. Notifications still collect in the notification center."><Switch checked={s.dnd} onChange={(v) => s.set({ dnd: v })} /></Row>
      <Row title="System sounds" desc="Subtle synthesized sounds for notifications, locking and alerts."><Switch checked={s.sounds} onChange={(v) => s.set({ sounds: v })} /></Row>
    </Group>
  );
}

/* ---------- Storage ---------- */
function StoragePage() {
  const nodes = useVfs((x) => x.nodes);
  const mode = useSession((x) => x.mode);
  const u = useMemo(() => vfs.usage(), [nodes]);
  const [est, setEst] = useState<{ usage?: number; quota?: number; persisted?: boolean }>({});
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    void (async () => {
      const e = await navigator.storage?.estimate?.().catch(() => undefined);
      const persisted = await navigator.storage?.persisted?.().catch(() => false);
      setEst({ usage: e?.usage, quota: e?.quota, persisted });
    })();
  }, [nodes]);

  const kinds = Object.entries(u.byKind).sort((a, b) => b[1] - a[1]);
  const colors = ['#6366f1', '#ec4899', '#22c55e', '#f59e0b', '#06b6d4', '#a855f7'];

  const backup = async () => {
    const pw = await dialog.prompt({ title: 'Create encrypted backup', message: 'Choose a password for this backup file. It\'s independent of your login passphrase — you\'ll need it to restore.', password: true, label: 'Backup password (min 8 characters)', confirmLabel: 'Continue', validate: (v) => (v.length < 8 ? 'At least 8 characters' : null) });
    if (!pw) return;
    const pw2 = await dialog.prompt({ title: 'Confirm backup password', password: true, confirmLabel: 'Create backup', validate: (v) => (v !== pw ? 'Passwords do not match' : null) });
    if (!pw2) return;
    setBusy('backup');
    try {
      const n = await createBackup(pw);
      notify({ appId: 'settings', title: 'Backup created', body: `${n} files encrypted into a .aether file in your browser's downloads.`, tone: 'success' });
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(null); }
  };

  const restore = async () => {
    const [file] = await pickHostFiles({ accept: '.aether', multiple: false });
    if (!file) return;
    try {
      const info = await readBackupInfo(file);
      const pw = await dialog.prompt({ title: 'Restore backup', message: `Created ${info.created ? new Date(info.created).toLocaleString() : 'unknown'} · ${info.files ?? '?'} files`, password: true, label: 'Backup password', confirmLabel: 'Restore' });
      if (!pw) return;
      const replace = await dialog.confirm({ title: 'How should files be restored?', message: 'Merge keeps your current files and adds restored ones (renaming conflicts).\nReplace erases current files first.', confirmLabel: 'Replace everything', cancelLabel: 'Merge', danger: true });
      setBusy('restore');
      const n = await restoreBackup(file, pw, replace ? 'replace' : 'merge');
      notify({ appId: 'settings', title: 'Backup restored', body: `${n} files restored and re-encrypted.`, tone: 'success' });
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(null); }
  };

  const erase = async () => {
    const ok = await dialog.confirm({ title: 'Erase AetherOS on this device?', message: 'Every file, note, password, event and setting will be permanently destroyed. Encrypted data cannot be recovered. Consider making a backup first.', danger: true, confirmLabel: 'Erase everything', requireText: 'ERASE' });
    if (!ok) return;
    await destroyEverything();
    location.reload();
  };

  return (
    <>
      <Card className="p-5">
        <div className="flex items-baseline justify-between">
          <div><span className="text-[26px] font-semibold">{formatBytes(u.bytes)}</span> <span className="text-muted text-[13px]">in {u.files} files</span></div>
          <span className="text-[12px] text-muted">{est.quota ? `${formatBytes(est.usage ?? 0)} of ${formatBytes(est.quota)} browser quota` : ''}</span>
        </div>
        <div className="mt-3 h-3 rounded-full bg-line overflow-hidden flex">
          {kinds.map(([k, v], i) => <div key={k} title={k} style={{ width: `${(v / Math.max(1, u.bytes)) * 100}%`, background: colors[i % colors.length] }} />)}
        </div>
        <div className="flex flex-wrap gap-4 mt-3 text-[12px] text-muted">
          {kinds.map(([k, v], i) => <span key={k} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: colors[i % colors.length] }} /> <span className="capitalize">{k === 'application' ? 'Data' : k}</span> {formatBytes(v)}</span>)}
        </div>
      </Card>
      <Group title="Device storage">
        <Row icon={HardDrive} title="Persistent storage" desc={est.persisted ? 'The browser has agreed not to evict your data under storage pressure.' : 'The browser may clear data under storage pressure. Install AetherOS as an app or make regular backups.'}>
          <Badge tone={est.persisted ? 'success' : 'warn'}>{est.persisted ? 'Granted' : 'Best effort'}</Badge>
        </Row>
      </Group>
      {mode !== 'guest' && (
        <Group title="Backup" desc="Backups are a single portable file encrypted with AES-256-GCM. You can restore it on any device running AetherOS.">
          <Row icon={Download} title="Create encrypted backup" desc="Downloads a .aether file protected by a password you choose."><Button size="sm" variant="primary" loading={busy === 'backup'} onClick={backup}>Back up…</Button></Row>
          <Row icon={Upload} title="Restore from backup"><Button size="sm" loading={busy === 'restore'} onClick={restore}>Restore…</Button></Row>
        </Group>
      )}
      <Group title="Danger zone">
        <Row icon={Trash2} title="Empty Trash"><Button size="sm" onClick={async () => { await vfs.emptyTrash(); toast('Trash emptied', 'success'); }}>Empty</Button></Row>
        <Row icon={AlertTriangle} title="Erase all content and settings" desc="Crypto-shreds your vault. Irreversible."><Button size="sm" variant="danger" onClick={erase}>Erase…</Button></Row>
      </Group>
    </>
  );
}

function AccessibilityPage() {
  const s = useSettings();
  return (
    <Group>
      <Row title="Reduce motion" desc="Minimizes animation throughout the interface."><Switch checked={s.reducedMotion} onChange={(v) => s.set({ reducedMotion: v })} /></Row>
      <Row title="Reduce transparency" desc="Solid surfaces instead of frosted glass."><Switch checked={!s.blur} onChange={(v) => s.set({ blur: !v })} /></Row>
    </Group>
  );
}

function KeyboardPage() {
  return (
    <Group desc="Shortcuts use Alt so they never collide with shortcuts inside apps.">
      <Row icon={Keyboard} title="View all keyboard shortcuts"><Button size="sm" onClick={() => shell.open('shortcuts')}>Show</Button></Row>
      <Row title="Spotlight" desc="Search everything"><span className="text-[12px] text-muted">Ctrl K · Alt Space</span></Row>
      <Row title="Lock screen"><span className="text-[12px] text-muted">Alt L</span></Row>
      <Row title="Window overview"><span className="text-[12px] text-muted">Alt O</span></Row>
    </Group>
  );
}

function AboutPage() {
  const [created, setCreated] = useState<number | null>(null);
  useEffect(() => { void readHeader().then((h) => setCreated(h?.createdAt ?? null)); }, []);
  return (
    <>
      <Card className="p-8 flex flex-col items-center text-center">
        <Logo size={72} glow />
        <div className="mt-4 text-[22px] font-semibold">AetherOS 2.0</div>
        <div className="text-muted text-[13px]">Halcyon · local-first web operating system</div>
      </Card>
      <Group>
        <Row title="Version"><span className="text-[12.5px] text-muted">2.0.0</span></Row>
        <Row title="Vault created"><span className="text-[12.5px] text-muted">{created ? new Date(created).toLocaleDateString() : '—'}</span></Row>
        <Row title="Cryptography"><span className="text-[12.5px] text-muted">WebCrypto · AES-256-GCM · PBKDF2-SHA256</span></Row>
        <Row title="Creator"><span className="text-[12.5px] text-muted">Ram Sharma</span></Row>
        <Row title="License"><span className="text-[12.5px] text-muted">MIT</span></Row>
      </Group>
    </>
  );
}

export { ImageIcon, Segmented };
