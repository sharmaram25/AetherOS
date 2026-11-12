import { useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck, Gauge, KeyRound, Activity, Globe, Lock, Check, AlertTriangle, Camera, Mic, Trash2, Fingerprint, Eye, Database, Timer, Clipboard, Link2, Image as ImageIcon, X, RefreshCw,
} from 'lucide-react';
import type { AppProps } from '../kernel/registry';
import { getApp } from '../kernel/registry';
import { useSettings } from '../kernel/settings';
import { useSession, session } from '../kernel/session';
import { useAppData } from '../kernel/appdata';
import { useSensors, useNetwork, PERM_LABEL, setGrant, clearAccessLog, type Perm, type AccessEvent } from '../kernel/privacy';
import { db } from '../kernel/db';
import { toHex } from '../kernel/crypto';
import { readHeader, type VaultHeader } from '../kernel/vault';
import { vfs, useVfs } from '../kernel/vfs';
import { wm } from '../kernel/windows';
import { formatBytes } from '../lib/mime';
import { timeAgo } from '../lib/format';
import { AppGlyph, Badge, Button, Card, Empty, Segmented, cx } from '../ui';

type Tab = 'overview' | 'permissions' | 'activity' | 'network' | 'encryption';

export default function Shield({ win }: AppProps) {
  const [tab, setTab] = useState<Tab>((win.data?.tab as Tab) ?? 'overview');
  useEffect(() => { if (win.data?.tab) setTab(win.data.tab); }, [win.data?._n]); // eslint-disable-line react-hooks/exhaustive-deps
  const tabs: { id: Tab; label: string; icon: typeof Gauge }[] = [
    { id: 'overview', label: 'Overview', icon: Gauge },
    { id: 'permissions', label: 'Permissions', icon: KeyRound },
    { id: 'activity', label: 'Activity', icon: Activity },
    { id: 'network', label: 'Network', icon: Globe },
    { id: 'encryption', label: 'Encryption', icon: Lock },
  ];
  return (
    <div className="h-full flex">
      <div className="w-[200px] shrink-0 border-r border-line bg-hover/40 p-2 flex flex-col gap-0.5">
        <div className="flex items-center gap-2.5 px-2.5 py-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-blue-500 flex items-center justify-center text-white"><ShieldCheck size={19} /></div>
          <div><div className="font-semibold text-[13.5px]">Shield</div><div className="text-[11px] text-muted">Privacy center</div></div>
        </div>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={cx('flex items-center gap-2.5 h-8 px-2.5 rounded-lg text-[13px] text-left', tab === t.id ? 'bg-accent text-accent-fg font-medium' : 'hover:bg-hover')}>
            <t.icon size={15} className={tab === t.id ? '' : 'text-muted'} /> {t.label}
          </button>
        ))}
        <div className="flex-1" />
        <Button variant="secondary" icon={Lock} onClick={() => session.lock()} className="mx-1 mb-1">Lock now</Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[720px] mx-auto p-7">
          {tab === 'overview' && <Overview go={setTab} />}
          {tab === 'permissions' && <Permissions />}
          {tab === 'activity' && <ActivityTab />}
          {tab === 'network' && <Network />}
          {tab === 'encryption' && <Encryption />}
        </div>
      </div>
    </div>
  );
}

function Overview({ go }: { go: (t: Tab) => void }) {
  const s = useSettings();
  const mode = useSession((x) => x.mode);
  const external = useNetwork((x) => x.external);
  const checks = [
    { ok: mode === 'passphrase' || mode === 'guest', w: 30, icon: KeyRound, title: 'Passphrase protection', desc: mode === 'passphrase' ? 'Your data key is unlocked only by your passphrase.' : mode === 'guest' ? 'Guest session — data lives only in memory.' : 'Anyone using this browser can open AetherOS.', fix: () => { wm.open('settings', { page: 'privacy' }); }, fixLabel: 'Set passphrase' },
    { ok: s.autoLockMinutes > 0 && s.autoLockMinutes <= 15, w: 15, icon: Timer, title: 'Auto-lock', desc: s.autoLockMinutes ? `Locks after ${s.autoLockMinutes} min of inactivity.` : 'Auto-lock is turned off.', fix: () => s.set({ autoLockMinutes: 5 }), fixLabel: 'Lock after 5 min' },
    { ok: external === 0, w: 15, icon: Globe, title: 'No external connections', desc: external === 0 ? 'Nothing has contacted an outside server this session.' : `${external} external request${external > 1 ? 's' : ''} this session (e.g. AI model downloads).`, fix: () => go('network'), fixLabel: 'Review' },
    { ok: s.clipboardClearSeconds > 0, w: 10, icon: Clipboard, title: 'Clipboard hygiene', desc: s.clipboardClearSeconds ? `Copied secrets are cleared after ${s.clipboardClearSeconds}s.` : 'Copied passwords stay in your clipboard.', fix: () => s.set({ clipboardClearSeconds: 45 }), fixLabel: 'Enable' },
    { ok: s.stripMetadata, w: 10, icon: ImageIcon, title: 'Photo metadata stripping', desc: s.stripMetadata ? 'GPS and camera data are removed on import.' : 'Imported photos may contain your location.', fix: () => s.set({ stripMetadata: true }), fixLabel: 'Enable' },
    { ok: s.confirmExternalLinks, w: 10, icon: Link2, title: 'External link confirmation', desc: 'Warns before a link reveals your IP address to a website.', fix: () => s.set({ confirmExternalLinks: true }), fixLabel: 'Enable' },
    { ok: s.privacyShield, w: 10, icon: Eye, title: 'Privacy shield', desc: s.privacyShield ? 'Windows blur when AetherOS loses focus.' : 'Window contents stay visible when you switch away.', fix: () => s.set({ privacyShield: true }), fixLabel: 'Enable' },
  ];
  const score = checks.reduce((a, c) => a + (c.ok ? c.w : 0), 0);
  const color = score >= 85 ? '#22c55e' : score >= 60 ? '#eab308' : '#ef4444';
  const R = 52, CIRC = 2 * Math.PI * R;
  return (
    <div className="space-y-6">
      <Card className="p-6 flex flex-wrap items-center gap-7">
        <div className="relative w-[132px] h-[132px] shrink-0">
          <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
            <circle cx="60" cy="60" r={R} fill="none" stroke="var(--line)" strokeWidth="10" />
            <circle cx="60" cy="60" r={R} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - score / 100)} style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(.2,.8,.2,1)' }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[34px] font-semibold tabular-nums leading-none">{score}</span>
            <span className="text-[11px] text-muted mt-1">Privacy score</span>
          </div>
        </div>
        <div className="flex-1 min-w-[240px]">
          <div className="text-[19px] font-semibold">{score >= 85 ? 'Excellent protection' : score >= 60 ? 'Good, with room to improve' : 'Your privacy needs attention'}</div>
          <div className="text-[13px] text-muted mt-1 leading-relaxed">Everything you store is encrypted on this device with AES-256-GCM. There are no accounts, no analytics and no cloud sync — so there's nothing to leak.</div>
          <div className="flex flex-wrap gap-2 mt-3">
            <Badge tone="success"><Check size={10} /> Zero telemetry</Badge>
            <Badge tone="success"><Check size={10} /> End-to-end local</Badge>
            <Badge tone="accent"><Lock size={10} /> CSP sandboxed</Badge>
          </div>
        </div>
      </Card>
      <div className="space-y-2">
        {checks.map((c) => (
          <Card key={c.title} className="p-4 flex items-center gap-4">
            <div className={cx('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', c.ok ? 'bg-success/15 text-success' : 'bg-warn/15 text-warn')}>{c.ok ? <Check size={17} /> : <c.icon size={17} />}</div>
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-medium">{c.title}</div>
              <div className="text-[12px] text-muted">{c.desc}</div>
            </div>
            {!c.ok && <Button size="sm" variant="primary" onClick={c.fix}>{c.fixLabel}</Button>}
          </Card>
        ))}
      </div>
    </div>
  );
}

function Permissions() {
  const [data] = useAppData<{ grants: Record<string, Partial<Record<Perm, 'granted' | 'denied'>>>; log: AccessEvent[] }>('privacy', { grants: {}, log: [] });
  const entries = Object.entries(data.grants).filter(([, g]) => Object.keys(g).length);
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[19px] font-semibold">App permissions</h2>
        <p className="text-[13px] text-muted mt-1">Apps must ask before using your camera, microphone, clipboard or files. Choices you've remembered appear here.</p>
      </div>
      {entries.length === 0 ? (
        <Card className="h-60"><Empty icon={KeyRound} title="No saved permissions" body="When you choose “Always allow” or “Don't allow”, it will show up here." /></Card>
      ) : entries.map(([appId, grants]) => {
        const app = getApp(appId);
        return (
          <Card key={appId} className="overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-line">
              {app && <AppGlyph app={app} size={30} />}
              <div className="font-medium text-[13.5px] flex-1">{app?.name ?? appId}</div>
              <Button size="sm" variant="ghost" onClick={() => (Object.keys(grants) as Perm[]).forEach((p) => setGrant(appId, p, null))}>Reset all</Button>
            </div>
            {(Object.entries(grants) as [Perm, 'granted' | 'denied'][]).map(([perm, v]) => (
              <div key={perm} className="flex items-center gap-3 px-4 py-2.5 border-b border-line last:border-0 text-[13px]">
                <span className="flex-1">{PERM_LABEL[perm] ?? perm}</span>
                <Segmented size="sm" value={v} onChange={(nv) => setGrant(appId, perm, nv)} options={[{ value: 'granted', label: 'Allow' }, { value: 'denied', label: 'Deny' }]} />
                <button onClick={() => setGrant(appId, perm, null)} className="w-7 h-7 rounded-lg hover:bg-hover flex items-center justify-center text-muted" title="Ask next time"><X size={13} /></button>
              </div>
            ))}
          </Card>
        );
      })}
    </div>
  );
}

function ActivityTab() {
  const sensors = useSensors((s) => s.active);
  const [data] = useAppData<{ grants: Record<string, unknown>; log: AccessEvent[] }>('privacy', { grants: {}, log: [] });
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[19px] font-semibold">Activity</h2>
        <p className="text-[13px] text-muted mt-1">A private, encrypted audit trail of when apps used sensitive capabilities.</p>
      </div>
      <Card className="p-4">
        <div className="text-[12px] font-semibold text-muted mb-3">Live sensors</div>
        {sensors.length === 0 ? (
          <div className="flex items-center gap-2 text-[13px] text-success"><Check size={15} /> No app is using your camera or microphone</div>
        ) : sensors.map((s) => (
          <div key={s.id} className="flex items-center gap-3 py-1.5 text-[13px]">
            <span className={cx('w-2 h-2 rounded-full animate-pulse', s.kind === 'camera' ? 'bg-green-400' : 'bg-orange-400')} />
            {s.kind === 'camera' ? <Camera size={15} /> : <Mic size={15} />}
            <span className="flex-1"><b>{getApp(s.appId)?.name ?? s.appId}</b> is using your {s.kind}</span>
            <span className="text-muted text-[12px]">since {new Date(s.since).toLocaleTimeString()}</span>
          </div>
        ))}
      </Card>
      <Card className="overflow-hidden">
        <div className="flex items-center px-4 h-11 border-b border-line">
          <span className="text-[12px] font-semibold text-muted flex-1">Access log · {data.log.length} events</span>
          {data.log.length > 0 && <Button size="sm" variant="ghost" icon={Trash2} onClick={clearAccessLog}>Clear</Button>}
        </div>
        {data.log.length === 0 ? <div className="p-8 text-center text-[12.5px] text-faint">No sensitive access recorded yet</div> : (
          <div className="max-h-[420px] overflow-y-auto">
            {data.log.map((e, i) => {
              const app = getApp(e.appId);
              return (
                <div key={i} className="flex items-center gap-3 px-4 py-2 border-b border-line last:border-0 text-[12.5px]">
                  {app ? <AppGlyph app={app} size={22} /> : <div className="w-[22px]" />}
                  <span className="w-28 truncate font-medium">{app?.name ?? e.appId}</span>
                  <span className="flex-1 truncate text-muted">{PERM_LABEL[e.what as Perm] ?? e.what}{e.detail ? ` · ${e.detail}` : ''}</span>
                  <Badge tone={e.allowed ? 'success' : 'danger'}>{e.allowed ? 'allowed' : 'blocked'}</Badge>
                  <span className="w-16 text-right text-faint">{timeAgo(e.t)}</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function Network() {
  const { entries, external, total } = useNetwork();
  const [filter, setFilter] = useState<'external' | 'all'>('external');
  const list = entries.filter((e) => filter === 'all' || e.external);
  const hosts = useMemo(() => {
    const m = new Map<string, number>();
    entries.filter((e) => e.external).forEach((e) => m.set(e.host, (m.get(e.host) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [entries]);
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[19px] font-semibold">Network transparency</h2>
        <p className="text-[13px] text-muted mt-1">Every request this page makes is observed and listed here. A strict Content-Security-Policy blocks apps from contacting arbitrary servers, so your data has nowhere to go.</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4"><div className={cx('text-[28px] font-semibold tabular-nums', external ? 'text-warn' : 'text-success')}>{external}</div><div className="text-[12px] text-muted">External requests</div></Card>
        <Card className="p-4"><div className="text-[28px] font-semibold tabular-nums">{total}</div><div className="text-[12px] text-muted">Total requests</div></Card>
        <Card className="p-4"><div className="text-[28px] font-semibold tabular-nums text-success">0</div><div className="text-[12px] text-muted">Trackers & analytics</div></Card>
      </div>
      {hosts.length > 0 && (
        <Card className="p-4">
          <div className="text-[12px] font-semibold text-muted mb-2">External hosts contacted</div>
          {hosts.map(([h, n]) => <div key={h} className="flex justify-between text-[12.5px] py-1"><span className="font-mono">{h}</span><span className="text-muted">{n} request{n > 1 ? 's' : ''}{/huggingface|hf\.co|githubusercontent/.test(h) ? ' · on-device AI model download' : ''}</span></div>)}
        </Card>
      )}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 px-4 h-11 border-b border-line">
          <span className="text-[12px] font-semibold text-muted flex-1">Request log</span>
          <Segmented size="sm" value={filter} onChange={setFilter} options={[{ value: 'external', label: 'External' }, { value: 'all', label: 'All' }]} />
        </div>
        {list.length === 0 ? (
          <div className="p-10 text-center"><ShieldCheck size={28} className="text-success mx-auto mb-2" /><div className="text-[13px] font-medium">{filter === 'external' ? 'No external requests' : 'No requests yet'}</div><div className="text-[12px] text-muted">AetherOS has not talked to any outside server this session.</div></div>
        ) : (
          <div className="max-h-[380px] overflow-y-auto font-mono text-[11.5px]">
            {list.map((e, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-1.5 border-b border-line last:border-0">
                <span className={cx('w-1.5 h-1.5 rounded-full shrink-0', e.external ? 'bg-warn' : 'bg-success')} />
                <span className="w-16 text-faint shrink-0">{new Date(e.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                <span className="w-14 text-muted shrink-0">{e.type}</span>
                <span className="flex-1 truncate" title={e.url}>{e.external ? e.url : e.url.replace(location.origin, '')}</span>
                <span className="text-faint shrink-0">{e.size ? formatBytes(e.size) : ''}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Encryption() {
  const mode = useSession((x) => x.mode);
  const nodes = useVfs((x) => x.nodes);
  const [header, setHeader] = useState<VaultHeader | null>(null);
  const [sample, setSample] = useState<{ key: string; hex: string; size: number } | null>(null);
  const [keys, setKeys] = useState(0);
  const u = useMemo(() => vfs.usage(), [nodes]);

  const loadSample = async () => {
    const all = (await db.keys()).map(String);
    setKeys(all.length);
    const blobKeys = all.filter((k) => k.startsWith('blob:'));
    const key = blobKeys[Math.floor(Math.random() * blobKeys.length)] ?? 'fs:index';
    const v = await db.get<Uint8Array>(key);
    if (v) setSample({ key, hex: toHex(v.slice(0, 160)), size: v.byteLength });
  };
  useEffect(() => { void readHeader().then(setHeader); if (mode !== 'guest') void loadSample(); }, [mode]);

  const rows: [string, string][] = [
    ['Cipher', 'AES-256-GCM (authenticated encryption)'],
    ['Key derivation', mode === 'passphrase' ? `PBKDF2-HMAC-SHA256 · ${(header?.iter ?? 600000).toLocaleString()} iterations · 128-bit salt` : mode === 'guest' ? 'None — guest data never touches disk' : 'Non-extractable WebCrypto device key'],
    ['Key hierarchy', 'Random 256-bit data key, wrapped by your key-encryption key'],
    ['Per-record IV', '96-bit random nonce, unique for every write'],
    ['Integrity', '128-bit GCM tag + record-bound associated data (prevents blob swapping)'],
    ['File names', 'Hidden — stored inside the encrypted index, blobs use random IDs'],
    ['Vault created', header ? new Date(header.createdAt).toLocaleString() : '—'],
    ['Key last changed', header?.changedAt ? new Date(header.changedAt).toLocaleString() : '—'],
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[19px] font-semibold">Encryption</h2>
        <p className="text-[13px] text-muted mt-1">How your data is protected at rest. All cryptography uses the browser's native, audited WebCrypto implementation.</p>
      </div>
      <Card>
        {rows.map(([k, v]) => (
          <div key={k} className="flex gap-4 px-4 py-2.5 border-b border-line last:border-0 text-[12.5px]">
            <span className="w-36 shrink-0 text-muted">{k}</span><span className="font-medium">{v}</span>
          </div>
        ))}
      </Card>
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4"><Fingerprint size={18} className="text-accent" /><div className="mt-2 text-[20px] font-semibold">{u.files}</div><div className="text-[12px] text-muted">Encrypted files</div></Card>
        <Card className="p-4"><Database size={18} className="text-accent" /><div className="mt-2 text-[20px] font-semibold">{keys || '—'}</div><div className="text-[12px] text-muted">Ciphertext records</div></Card>
        <Card className="p-4"><Lock size={18} className="text-accent" /><div className="mt-2 text-[20px] font-semibold">{formatBytes(u.bytes)}</div><div className="text-[12px] text-muted">Protected data</div></Card>
      </div>
      {mode !== 'guest' && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-[13px] font-semibold flex items-center gap-2"><Eye size={14} /> See for yourself</div>
              <div className="text-[12px] text-muted">This is exactly what's stored on disk — a random record pulled from IndexedDB.</div>
            </div>
            <Button size="sm" icon={RefreshCw} onClick={loadSample}>Another</Button>
          </div>
          {sample ? (
            <div className="rounded-lg bg-black/80 text-emerald-300/90 font-mono text-[11px] p-3 break-all leading-relaxed selectable">
              <div className="text-white/40 mb-1">key: {sample.key} · {formatBytes(sample.size)} · first 160 bytes</div>
              {sample.hex.match(/.{1,2}/g)!.join(' ')}
            </div>
          ) : <div className="text-[12px] text-faint">Loading…</div>}
        </Card>
      )}
      <Card className="p-4 flex gap-3">
        <AlertTriangle size={17} className="text-warn shrink-0 mt-0.5" />
        <div className="text-[12.5px] text-muted leading-relaxed"><b className="text-fg">Threat model.</b> Encryption protects your data at rest — against someone copying your browser profile, a stolen disk, or other software reading storage. While AetherOS is unlocked, data is decrypted in this tab's memory; lock it when you step away. A compromised browser or OS can't be defended against by any web app.</div>
      </Card>
    </div>
  );
}
