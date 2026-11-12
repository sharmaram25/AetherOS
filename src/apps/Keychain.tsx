import { useEffect, useMemo, useState } from 'react';
import {
  KeyRound, Star, Globe, CreditCard, StickyNote, ShieldAlert, Wand2, Plus, Search, Copy, Eye, EyeOff, Pencil, Trash2, Check, X,
  Timer, RefreshCw, Upload, Download, ExternalLink, AlertTriangle, ShieldCheck, Layers,
} from 'lucide-react';
import type { AppProps } from '../kernel/registry';
import { useAppData } from '../kernel/appdata';
import { copyText } from '../kernel/privacy';
import { dialog } from '../kernel/dialog';
import { toast } from '../kernel/notify';
import { randomId } from '../kernel/crypto';
import { pickHostFiles, downloadBlob } from '../kernel/launcher';
import { strength, generatePassword } from '../lib/strength';
import { totp, validSecret, parseOtpauth } from '../lib/totp';
import { formatDate } from '../lib/format';
import { Button, IconButton, Input, Textarea, SidebarItem, SectionLabel, Empty, Switch, Slider, Badge, Card, Segmented, cx, openMenu, useNow } from '../ui';
import { openExternal } from './shared';

type ItemType = 'login' | 'card' | 'note';
interface Item {
  id: string; type: ItemType; title: string; favorite?: boolean; created: number; modified: number;
  username?: string; password?: string; url?: string; totp?: string; notes?: string;
  cardNumber?: string; cardHolder?: string; expiry?: string; cvv?: string;
  history?: { password: string; changed: number }[];
}
interface Data { items: Item[] }

type View = 'all' | 'favorites' | 'login' | 'card' | 'note' | 'totp' | 'audit' | 'generator';

function faviconLetter(i: Item) {
  const src = (i.url ? i.url.replace(/^https?:\/\/(www\.)?/, '') : i.title) || '?';
  return src[0].toUpperCase();
}
function hue(s: string) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }

export default function Keychain(_p: AppProps) {
  const [data, setData, loaded] = useAppData<Data>('keychain', { items: [] });
  const [view, setView] = useState<View>('all');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [editing, setEditing] = useState<Item | null>(null);

  const audit = useMemo(() => {
    const logins = data.items.filter((i) => i.type === 'login' && i.password);
    const counts = new Map<string, number>();
    logins.forEach((i) => counts.set(i.password!, (counts.get(i.password!) ?? 0) + 1));
    const weak = logins.filter((i) => strength(i.password!).score < 2);
    const reused = logins.filter((i) => counts.get(i.password!)! > 1);
    const old = logins.filter((i) => Date.now() - (i.history?.[0]?.changed ?? i.created) > 365 * 86400_000);
    const no2fa = logins.filter((i) => !i.totp);
    const score = logins.length ? Math.round(100 - ((weak.length * 2 + reused.length * 2 + old.length) / (logins.length * 5)) * 100) : 100;
    return { weak, reused, old, no2fa, score: Math.max(0, score), total: logins.length };
  }, [data.items]);

  const list = useMemo(() => {
    let l = data.items;
    if (view === 'favorites') l = l.filter((i) => i.favorite);
    else if (view === 'login' || view === 'card' || view === 'note') l = l.filter((i) => i.type === view);
    else if (view === 'totp') l = l.filter((i) => i.totp);
    if (q.trim()) {
      const s = q.toLowerCase();
      l = l.filter((i) => [i.title, i.username, i.url, i.notes].some((x) => x?.toLowerCase().includes(s)));
    }
    return [...l].sort((a, b) => Number(!!b.favorite) - Number(!!a.favorite) || a.title.localeCompare(b.title));
  }, [data.items, view, q]);

  const current = data.items.find((i) => i.id === sel) ?? null;

  const save = (item: Item) => {
    setData((d) => {
      const prev = d.items.find((i) => i.id === item.id);
      let history = item.history ?? [];
      if (prev && prev.password && prev.password !== item.password) history = [{ password: prev.password, changed: Date.now() }, ...history].slice(0, 10);
      const next = { ...item, history, modified: Date.now() };
      return { items: prev ? d.items.map((i) => (i.id === item.id ? next : i)) : [...d.items, next] };
    });
    setSel(item.id);
    setEditing(null);
  };

  const remove = async (item: Item) => {
    if (!(await dialog.confirm({ title: `Delete “${item.title}”?`, message: 'This item will be permanently removed from your keychain.', danger: true, confirmLabel: 'Delete' }))) return;
    setData((d) => ({ items: d.items.filter((i) => i.id !== item.id) }));
    setSel(null);
  };

  const create = (type: ItemType) => {
    const now = Date.now();
    setEditing({ id: randomId(12), type, title: '', created: now, modified: now, ...(type === 'login' ? { password: generatePassword({ length: 20, upper: true, digits: true, symbols: true }) } : {}) });
    setSel(null);
  };

  const importCsv = async () => {
    const [f] = await pickHostFiles({ accept: '.csv', multiple: false });
    if (!f) return;
    const rows = parseCsv(await f.text());
    const head = rows.shift()?.map((h) => h.toLowerCase().trim()) ?? [];
    const col = (...names: string[]) => head.findIndex((h) => names.includes(h));
    const ci = { name: col('name', 'title'), url: col('url', 'login_uri', 'website'), user: col('username', 'login_username', 'login', 'email'), pass: col('password', 'login_password'), note: col('note', 'notes', 'extra'), totp: col('totp', 'login_totp', 'otpauth') };
    if (ci.pass < 0) { toast('Unrecognized CSV — expected a "password" column', 'error'); return; }
    const now = Date.now();
    const items: Item[] = rows.filter((r) => r[ci.pass]).map((r) => ({
      id: randomId(12), type: 'login', created: now, modified: now,
      title: r[ci.name] || (r[ci.url] ?? '').replace(/^https?:\/\/(www\.)?/, '').split('/')[0] || 'Imported',
      url: r[ci.url], username: r[ci.user], password: r[ci.pass], notes: ci.note >= 0 ? r[ci.note] : undefined,
      totp: ci.totp >= 0 && r[ci.totp] ? (parseOtpauth(r[ci.totp])?.secret ?? r[ci.totp]) : undefined,
    }));
    setData((d) => ({ items: [...d.items, ...items] }));
    toast(`Imported ${items.length} logins — encrypted`, 'success');
  };

  const exportCsv = async () => {
    const ok = await dialog.confirm({ title: 'Export passwords unencrypted?', message: 'The CSV file will contain every password in plain text. Anyone who gets the file can read them. Delete it as soon as you\'ve imported it elsewhere.', danger: true, confirmLabel: 'Export anyway' });
    if (!ok) return;
    const esc = (s = '') => `"${s.replace(/"/g, '""')}"`;
    const csv = ['name,url,username,password,totp,note', ...data.items.filter((i) => i.type === 'login').map((i) => [i.title, i.url, i.username, i.password, i.totp, i.notes].map(esc).join(','))].join('\n');
    downloadBlob(new Blob([csv], { type: 'text/csv' }), 'keychain-export.csv');
  };

  const issues = audit.weak.length + audit.reused.length;

  return (
    <div className="h-full flex">
      <div className="w-[200px] shrink-0 border-r border-line bg-hover/40 flex flex-col">
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          <SectionLabel>Vault</SectionLabel>
          <SidebarItem icon={Layers} label="All items" count={data.items.length} active={view === 'all'} onClick={() => setView('all')} />
          <SidebarItem icon={Star} label="Favorites" count={data.items.filter((i) => i.favorite).length} active={view === 'favorites'} onClick={() => setView('favorites')} color="#f59e0b" />
          <SectionLabel>Categories</SectionLabel>
          <SidebarItem icon={Globe} label="Logins" count={data.items.filter((i) => i.type === 'login').length} active={view === 'login'} onClick={() => setView('login')} />
          <SidebarItem icon={CreditCard} label="Cards" count={data.items.filter((i) => i.type === 'card').length} active={view === 'card'} onClick={() => setView('card')} />
          <SidebarItem icon={StickyNote} label="Secure notes" count={data.items.filter((i) => i.type === 'note').length} active={view === 'note'} onClick={() => setView('note')} />
          <SidebarItem icon={Timer} label="2FA codes" count={data.items.filter((i) => i.totp).length} active={view === 'totp'} onClick={() => setView('totp')} />
          <SectionLabel>Tools</SectionLabel>
          <SidebarItem icon={ShieldAlert} label="Security audit" active={view === 'audit'} onClick={() => setView('audit')} trailing={issues ? <span className="text-[10.5px] font-semibold text-warn">{issues}</span> : undefined} />
          <SidebarItem icon={Wand2} label="Generator" active={view === 'generator'} onClick={() => setView('generator')} />
        </div>
        <div className="p-2 border-t border-line flex gap-1">
          <Button size="sm" variant="subtle" icon={Upload} onClick={importCsv} className="flex-1">Import</Button>
          <Button size="sm" variant="subtle" icon={Download} onClick={exportCsv} className="flex-1">Export</Button>
        </div>
      </div>

      {view === 'audit' ? <Audit audit={audit} onOpen={(id) => { setView('all'); setSel(id); }} />
        : view === 'generator' ? <Generator />
        : (
          <>
            <div className="w-[270px] shrink-0 border-r border-line flex flex-col">
              <div className="h-12 flex items-center gap-1.5 px-2.5 border-b border-line">
                <Input icon={Search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search keychain" className="h-7" />
                <IconButton icon={Plus} label="New item" onClick={(e) => openMenu(e, [
                  { label: 'Login', icon: Globe, onClick: () => create('login') },
                  { label: 'Card', icon: CreditCard, onClick: () => create('card') },
                  { label: 'Secure note', icon: StickyNote, onClick: () => create('note') },
                ])} />
              </div>
              <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
                {loaded && list.length === 0 && <div className="py-12 text-center text-[12.5px] text-faint">{q ? 'No matches' : 'Nothing here yet'}</div>}
                {list.map((i) => (
                  <button key={i.id} onClick={() => { setSel(i.id); setEditing(null); }} className={cx('w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left', sel === i.id ? 'bg-accent/15' : 'hover:bg-hover')}>
                    <ItemAvatar item={i} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium truncate flex items-center gap-1">{i.title || 'Untitled'}{i.favorite && <Star size={10} className="text-amber-400 fill-amber-400" />}</div>
                      <div className="text-[11.5px] text-muted truncate">{i.type === 'login' ? i.username || i.url || '—' : i.type === 'card' ? (i.cardNumber ? '•••• ' + i.cardNumber.replace(/\s/g, '').slice(-4) : 'Card') : 'Secure note'}</div>
                    </div>
                    {i.totp && <Timer size={12} className="text-faint shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 min-w-0 overflow-y-auto">
              {editing ? <Editor item={editing} onSave={save} onCancel={() => setEditing(null)} />
                : current ? <Detail item={current} onEdit={() => setEditing(current)} onDelete={() => remove(current)} onFav={() => save({ ...current, favorite: !current.favorite })} />
                : <Empty icon={KeyRound} title={data.items.length ? 'Select an item' : 'Your keychain is empty'} body="Passwords, cards and notes are encrypted with your vault key and never leave this device." action={<Button variant="primary" icon={Plus} onClick={() => create('login')}>Add a login</Button>} />}
            </div>
          </>
        )}
    </div>
  );
}

function ItemAvatar({ item, size = 34 }: { item: Item; size?: number }) {
  const Icon = item.type === 'card' ? CreditCard : item.type === 'note' ? StickyNote : null;
  const h = hue(item.title || item.url || 'x');
  return (
    <div className="rounded-xl flex items-center justify-center text-white font-semibold shrink-0" style={{ width: size, height: size, background: `linear-gradient(145deg, hsl(${h} 65% 55%), hsl(${(h + 40) % 360} 60% 42%))`, fontSize: size * 0.42 }}>
      {Icon ? <Icon size={size * 0.48} /> : faviconLetter(item)}
    </div>
  );
}

function Field({ label, value, secret, mono, onCopy, link }: { label: string; value?: string; secret?: boolean; mono?: boolean; onCopy?: boolean; link?: boolean }) {
  const [show, setShow] = useState(false);
  if (!value) return null;
  return (
    <div className="group px-4 py-3 border-b border-line last:border-0">
      <div className="text-[11.5px] text-muted mb-0.5">{label}</div>
      <div className="flex items-center gap-2">
        <div className={cx('flex-1 min-w-0 text-[13.5px] break-all selectable', (mono || secret) && 'font-mono')}>
          {secret && !show ? '••••••••••••' : value}
        </div>
        {secret && <IconButton icon={show ? EyeOff : Eye} size={14} label={show ? 'Hide' : 'Reveal'} onClick={() => setShow(!show)} />}
        {link && <IconButton icon={ExternalLink} size={14} label="Open" onClick={() => void openExternal(value.startsWith('http') ? value : 'https://' + value)} />}
        {onCopy !== false && <IconButton icon={Copy} size={14} label="Copy" onClick={() => { void copyText(value, { sensitive: secret, appId: 'keychain' }); toast(secret ? 'Copied — clipboard clears automatically' : 'Copied', 'success'); }} />}
      </div>
    </div>
  );
}

function TotpField({ secret }: { secret: string }) {
  const now = useNow(1000);
  const [code, setCode] = useState('------');
  const remaining = 30 - (Math.floor(now.getTime() / 1000) % 30);
  useEffect(() => { totp(secret).then(setCode).catch(() => setCode('invalid')); }, [secret, Math.floor(now.getTime() / 30000)]); // eslint-disable-line react-hooks/exhaustive-deps
  const R = 9, C = 2 * Math.PI * R;
  return (
    <div className="px-4 py-3 border-b border-line">
      <div className="text-[11.5px] text-muted mb-0.5">One-time code</div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-[22px] font-semibold tracking-[0.2em] tabular-nums text-accent">{code.slice(0, 3)} {code.slice(3)}</span>
        <svg width="22" height="22" className="-rotate-90"><circle cx="11" cy="11" r={R} fill="none" stroke="var(--line)" strokeWidth="3" /><circle cx="11" cy="11" r={R} fill="none" stroke={remaining <= 5 ? '#ef4444' : 'var(--accent)'} strokeWidth="3" strokeDasharray={C} strokeDashoffset={C * (1 - remaining / 30)} style={{ transition: 'stroke-dashoffset 1s linear' }} /></svg>
        <span className="text-[12px] text-muted tabular-nums w-6">{remaining}s</span>
        <div className="flex-1" />
        <IconButton icon={Copy} size={14} label="Copy code" onClick={() => { void copyText(code, { sensitive: true, appId: 'keychain' }); toast('Code copied', 'success'); }} />
      </div>
    </div>
  );
}

function Detail({ item, onEdit, onDelete, onFav }: { item: Item; onEdit: () => void; onDelete: () => void; onFav: () => void }) {
  const st = item.password ? strength(item.password) : null;
  return (
    <div className="p-7 max-w-[600px] mx-auto space-y-5 animate-fade-in">
      <div className="flex items-center gap-4">
        <ItemAvatar item={item} size={56} />
        <div className="flex-1 min-w-0">
          <div className="text-[20px] font-semibold truncate">{item.title || 'Untitled'}</div>
          <div className="text-[12px] text-muted capitalize">{item.type === 'note' ? 'Secure note' : item.type} · edited {formatDate(item.modified)}</div>
        </div>
        <IconButton icon={Star} label="Favorite" active={item.favorite} onClick={onFav} />
        <Button icon={Pencil} onClick={onEdit}>Edit</Button>
        <IconButton icon={Trash2} label="Delete" onClick={onDelete} className="hover:!text-danger" />
      </div>
      <Card>
        {item.type === 'login' && (<>
          <Field label="Username" value={item.username} />
          <Field label="Password" value={item.password} secret />
          {item.totp && <TotpField secret={item.totp} />}
          <Field label="Website" value={item.url} link />
        </>)}
        {item.type === 'card' && (<>
          <Field label="Cardholder" value={item.cardHolder} />
          <Field label="Number" value={item.cardNumber} secret mono />
          <Field label="Expires" value={item.expiry} />
          <Field label="Security code" value={item.cvv} secret />
        </>)}
        <Field label="Notes" value={item.notes} onCopy={item.type === 'note'} />
      </Card>
      {st && (
        <Card className="p-4 flex items-center gap-3">
          {st.score >= 3 ? <ShieldCheck size={18} className="text-success" /> : <AlertTriangle size={18} className="text-warn" />}
          <div className="flex-1">
            <div className="text-[13px] font-medium">{st.label} password</div>
            <div className="text-[12px] text-muted">{st.bits} bits of entropy · cracking would take {st.crack}</div>
          </div>
          <div className="w-24 flex gap-0.5">{[0, 1, 2, 3].map((i) => <div key={i} className="h-1.5 flex-1 rounded-full" style={{ background: st.score > i ? st.color : 'var(--line-strong)' }} />)}</div>
        </Card>
      )}
      {item.history && item.history.length > 0 && (
        <details className="text-[12.5px]">
          <summary className="cursor-pointer text-muted">Password history ({item.history.length})</summary>
          <Card className="mt-2">{item.history.map((h, i) => <Field key={i} label={new Date(h.changed).toLocaleString()} value={h.password} secret />)}</Card>
        </details>
      )}
    </div>
  );
}

function Editor({ item, onSave, onCancel }: { item: Item; onSave: (i: Item) => void; onCancel: () => void }) {
  const [it, setIt] = useState(item);
  const [show, setShow] = useState(false);
  const set = (p: Partial<Item>) => setIt((x) => ({ ...x, ...p }));
  const st = it.password ? strength(it.password) : null;
  const totpErr = it.totp && !validSecret(it.totp) && !parseOtpauth(it.totp) ? 'Not a valid base32 secret or otpauth:// link' : null;
  const valid = it.title.trim() && !totpErr;
  const L = ({ children }: { children: React.ReactNode }) => <div className="text-[12px] text-muted mb-1.5 mt-4">{children}</div>;
  return (
    <div className="p-7 max-w-[600px] mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-2">
        <ItemAvatar item={it} size={44} />
        <Input autoFocus value={it.title} onChange={(e) => set({ title: e.target.value })} placeholder={it.type === 'login' ? 'e.g. GitHub' : it.type === 'card' ? 'e.g. Personal Visa' : 'Title'} className="h-10 text-[16px] font-semibold" />
      </div>
      {it.type === 'login' && (<>
        <L>Website</L><Input value={it.url ?? ''} onChange={(e) => set({ url: e.target.value })} placeholder="github.com" />
        <L>Username or email</L><Input value={it.username ?? ''} onChange={(e) => set({ username: e.target.value })} autoComplete="off" />
        <L>Password</L>
        <div className="flex gap-1.5">
          <Input type={show ? 'text' : 'password'} value={it.password ?? ''} onChange={(e) => set({ password: e.target.value })} className="font-mono" autoComplete="new-password" />
          <IconButton icon={show ? EyeOff : Eye} onClick={() => setShow(!show)} label="Reveal" />
          <IconButton icon={RefreshCw} onClick={() => { set({ password: generatePassword({ length: 20, upper: true, digits: true, symbols: true }) }); setShow(true); }} label="Generate" />
        </div>
        {st && <div className="text-[11.5px] mt-1.5" style={{ color: st.color }}>{st.label} · {st.crack} to crack</div>}
        <L>Two-factor secret (optional)</L>
        <Input value={it.totp ?? ''} onChange={(e) => set({ totp: e.target.value })} placeholder="JBSWY3DPEHPK3PXP or otpauth://…" className={cx('font-mono', totpErr && 'border-danger')} />
        {totpErr && <div className="text-[11.5px] text-danger mt-1">{totpErr}</div>}
      </>)}
      {it.type === 'card' && (<>
        <L>Cardholder name</L><Input value={it.cardHolder ?? ''} onChange={(e) => set({ cardHolder: e.target.value })} />
        <L>Card number</L><Input value={it.cardNumber ?? ''} onChange={(e) => set({ cardNumber: e.target.value.replace(/[^\d ]/g, '') })} className="font-mono" autoComplete="off" />
        <div className="grid grid-cols-2 gap-3">
          <div><L>Expiry</L><Input value={it.expiry ?? ''} onChange={(e) => set({ expiry: e.target.value })} placeholder="MM/YY" /></div>
          <div><L>Security code</L><Input type="password" value={it.cvv ?? ''} onChange={(e) => set({ cvv: e.target.value })} autoComplete="off" /></div>
        </div>
      </>)}
      <L>Notes</L>
      <Textarea rows={it.type === 'note' ? 10 : 4} value={it.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} />
      <div className="flex justify-end gap-2 mt-6">
        <Button icon={X} onClick={onCancel}>Cancel</Button>
        <Button variant="primary" icon={Check} disabled={!valid} onClick={() => onSave({ ...it, title: it.title.trim(), totp: it.totp ? (parseOtpauth(it.totp)?.secret ?? it.totp.replace(/\s/g, '').toUpperCase()) : undefined })}>Save</Button>
      </div>
    </div>
  );
}

function Audit({ audit, onOpen }: { audit: { weak: Item[]; reused: Item[]; old: Item[]; no2fa: Item[]; score: number; total: number }; onOpen: (id: string) => void }) {
  const groups: [string, string, Item[], typeof AlertTriangle][] = [
    ['Weak passwords', 'Easy to guess or crack. Replace them with generated passwords.', audit.weak, AlertTriangle],
    ['Reused passwords', 'If one site is breached, every account sharing the password is exposed.', audit.reused, Layers],
    ['Not changed in a year', 'Consider rotating long-lived passwords.', audit.old, Timer],
    ['No two-factor code', 'Add a 2FA secret to make these accounts far harder to take over.', audit.no2fa, ShieldAlert],
  ];
  const color = audit.score >= 85 ? '#22c55e' : audit.score >= 60 ? '#eab308' : '#ef4444';
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[680px] mx-auto p-7 space-y-5">
        <Card className="p-6 flex items-center gap-6">
          <div className="text-[52px] font-semibold tabular-nums leading-none" style={{ color }}>{audit.score}</div>
          <div>
            <div className="text-[17px] font-semibold">Password health</div>
            <div className="text-[12.5px] text-muted">Checked {audit.total} logins entirely offline. Nothing is sent to breach-checking services.</div>
          </div>
        </Card>
        {groups.map(([title, desc, items, Icon]) => (
          <Card key={title} className="overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-line">
              <Icon size={16} className={items.length ? 'text-warn' : 'text-success'} />
              <div className="flex-1"><div className="text-[13.5px] font-medium">{title}</div><div className="text-[12px] text-muted">{desc}</div></div>
              <Badge tone={items.length ? 'warn' : 'success'}>{items.length || 'OK'}</Badge>
            </div>
            {items.slice(0, 8).map((i) => (
              <button key={i.id} onClick={() => onOpen(i.id)} className="w-full flex items-center gap-3 px-4 py-2 border-b border-line last:border-0 hover:bg-hover text-left">
                <ItemAvatar item={i} size={26} /><span className="text-[13px] flex-1 truncate">{i.title}</span><span className="text-[12px] text-muted truncate">{i.username}</span>
              </button>
            ))}
          </Card>
        ))}
      </div>
    </div>
  );
}

function Generator() {
  const [mode, setMode] = useState<'chars' | 'words'>('chars');
  const [len, setLen] = useState(20);
  const [words, setWords] = useState(5);
  const [upper, setUpper] = useState(true);
  const [digits, setDigits] = useState(true);
  const [symbols, setSymbols] = useState(true);
  const [pw, setPw] = useState('');
  const gen = () => setPw(generatePassword({ length: len, upper, digits, symbols, words: mode === 'words', wordCount: words }));
  useEffect(gen, [mode, len, words, upper, digits, symbols]); // eslint-disable-line react-hooks/exhaustive-deps
  const st = strength(pw);
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[560px] mx-auto p-7 space-y-5">
        <h2 className="text-[19px] font-semibold">Password generator</h2>
        <Card className="p-5">
          <div className="font-mono text-[19px] break-all min-h-[56px] selectable">{pw}</div>
          <div className="flex items-center gap-3 mt-4">
            <div className="flex-1 flex gap-1">{[0, 1, 2, 3].map((i) => <div key={i} className="h-1.5 flex-1 rounded-full" style={{ background: st.score > i ? st.color : 'var(--line-strong)' }} />)}</div>
            <span className="text-[12px]" style={{ color: st.color }}>{st.label} · {st.bits} bits</span>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="primary" icon={Copy} onClick={() => { void copyText(pw, { sensitive: true, appId: 'keychain' }); toast('Copied — clipboard clears automatically', 'success'); }}>Copy</Button>
            <Button icon={RefreshCw} onClick={gen}>Regenerate</Button>
          </div>
        </Card>
        <Card className="p-5 space-y-4">
          <Segmented value={mode} onChange={setMode} options={[{ value: 'chars', label: 'Random characters' }, { value: 'words', label: 'Memorable words' }]} className="w-full" />
          {mode === 'chars' ? (
            <div><div className="flex justify-between text-[12.5px] mb-2"><span>Length</span><span className="tabular-nums text-muted">{len}</span></div><Slider value={len} min={8} max={64} onChange={setLen} /></div>
          ) : (
            <div><div className="flex justify-between text-[12.5px] mb-2"><span>Words</span><span className="tabular-nums text-muted">{words}</span></div><Slider value={words} min={3} max={10} onChange={setWords} /></div>
          )}
          <div className="flex items-center justify-between text-[13px]"><span>Uppercase</span><Switch checked={upper} onChange={setUpper} /></div>
          <div className="flex items-center justify-between text-[13px]"><span>Numbers</span><Switch checked={digits} onChange={setDigits} /></div>
          {mode === 'chars' && <div className="flex items-center justify-between text-[13px]"><span>Symbols</span><Switch checked={symbols} onChange={setSymbols} /></div>}
        </Card>
        <div className="text-[12px] text-faint">Generated with the browser's cryptographically secure random number generator, with rejection sampling to avoid bias.</div>
      </div>
    </div>
  );
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); rows.push(row); row = []; cur = '';
    } else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}
