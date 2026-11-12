import { useEffect, useMemo, useRef, useState } from 'react';
import type { AppProps } from '../kernel/registry';
import { allApps, getApp } from '../kernel/registry';
import { vfs } from '../kernel/vfs';
import { wm, useWindows } from '../kernel/windows';
import { useSettings } from '../kernel/settings';
import { session, useSession } from '../kernel/session';
import { dialog } from '../kernel/dialog';
import { notify } from '../kernel/notify';
import { getAppData, setAppData, loadAppData } from '../kernel/appdata';
import { openPath } from '../kernel/launcher';
import { sealWithPassword, openWithPassword, sha256, utf8, fromUtf8, toB64, fromB64, randomId, type Sealed } from '../kernel/crypto';
import { useNetwork } from '../kernel/privacy';
import { HOME, resolve, basename, dirname, join, prettyPath, isInside } from '../lib/path';
import { formatBytes, mimeOf } from '../lib/mime';
import { evaluate, formatNumber } from '../lib/calc';
import { generatePassword } from '../lib/strength';

/* ---------- ANSI-ish rendering ---------- */
const C = { reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[90m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m' };
const COLORS: Record<string, string> = { '31': '#f87171', '32': '#4ade80', '33': '#facc15', '34': '#60a5fa', '35': '#c084fc', '36': '#22d3ee', '90': '#7c8293' };

function Ansi({ text }: { text: string }) {
  const parts: { t: string; color?: string; bold?: boolean }[] = [];
  let color: string | undefined, bold = false;
  for (const chunk of text.split(/(\x1b\[\d+m)/)) {
    const m = /^\x1b\[(\d+)m$/.exec(chunk);
    if (m) {
      if (m[1] === '0') { color = undefined; bold = false; }
      else if (m[1] === '1') bold = true;
      else color = COLORS[m[1]];
    } else if (chunk) parts.push({ t: chunk, color, bold });
  }
  return <>{parts.map((p, i) => <span key={i} style={{ color: p.color, fontWeight: p.bold ? 700 : undefined }}>{p.t}</span>)}</>;
}

/* ---------- Tokenizer ---------- */
function tokenize(line: string, env: Record<string, string>): string[] {
  const out: string[] = [];
  let cur = '', q: string | null = null, has = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === q) q = null;
      else if (c === '$' && q === '"') { const m = /^\$(\w+)/.exec(line.slice(i)); if (m) { cur += env[m[1]] ?? ''; i += m[1].length; } else cur += c; }
      else cur += c;
      continue;
    }
    if (c === '"' || c === "'") { q = c; has = true; continue; }
    if (c === '\\' && i + 1 < line.length) { cur += line[++i]; has = true; continue; }
    if (/\s/.test(c)) { if (cur || has) out.push(cur); cur = ''; has = false; continue; }
    if (c === '$') { const m = /^\$(\w+|\?)/.exec(line.slice(i)); if (m) { cur += env[m[1]] ?? ''; i += m[1].length; has = true; continue; } }
    if (c === '~' && !cur && (line[i + 1] === undefined || line[i + 1] === '/' || /\s/.test(line[i + 1]))) { cur += HOME; has = true; continue; }
    cur += c;
  }
  if (q) throw new Error('unterminated quote');
  if (cur || has) out.push(cur);
  return out;
}

function splitTop(line: string, seps: string[]): { part: string; sep: string }[] {
  const out: { part: string; sep: string }[] = [];
  let cur = '', q: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === q) q = null; cur += c; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    const sep = seps.find((s) => line.startsWith(s, i));
    if (sep) { out.push({ part: cur, sep }); cur = ''; i += sep.length - 1; continue; }
    cur += c;
  }
  out.push({ part: cur, sep: '' });
  return out;
}

function globToRe(g: string) {
  return new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
}

interface Ctx { cwd: string; env: Record<string, string>; aliases: Record<string, string>; history: string[]; setCwd: (p: string) => void; clear: () => void; winId: string }
type Cmd = (args: string[], stdin: string, ctx: Ctx) => Promise<string> | string;

const BLOCKED = (name: string): Cmd => () => `${C.yellow}${name}: network access is disabled for apps in AetherOS — by design.${C.reset}\n${C.dim}Your data never leaves this device. See \`privacy\` for details.${C.reset}`;

function flags(args: string[]) {
  const f = new Set<string>();
  const rest: string[] = [];
  for (const a of args) {
    if (/^-[a-zA-Z]+$/.test(a)) for (const ch of a.slice(1)) f.add(ch);
    else rest.push(a);
  }
  return { f, rest };
}

function expandGlobs(args: string[], cwd: string) {
  return args.flatMap((a) => {
    if (!/[*?]/.test(a)) return [a];
    const full = resolve(cwd, a);
    const dir = dirname(full), re = globToRe(basename(full));
    const m = vfs.list(dir).filter((n) => re.test(n.name)).map((n) => (a.startsWith('/') ? n.path : n.path.startsWith(cwd + '/') ? n.path.slice(cwd.length + 1) : n.path));
    return m.length ? m : [a];
  });
}

const need = (p: string) => { if (!vfs.exists(p)) throw new Error(`${prettyPath(p)}: No such file or directory`); return vfs.stat(p)!; };

const COMMANDS: Record<string, Cmd & { help?: string }> = {};
function def(name: string, help: string, fn: Cmd) { (fn as Cmd & { help?: string }).help = help; COMMANDS[name] = fn as Cmd & { help: string }; }

def('help', 'List commands', () => {
  const names = Object.keys(COMMANDS).sort();
  const w = Math.max(...names.map((n) => n.length)) + 2;
  return `${C.bold}AetherOS shell${C.reset} — pipes (|), redirects (> >>), chaining (&& ;), $VARS, globs (*) and Tab completion.\n\n` +
    names.map((n) => `  ${C.cyan}${n.padEnd(w)}${C.reset}${COMMANDS[n].help ?? ''}`).join('\n');
});
def('pwd', 'Print working directory', (_a, _s, c) => c.cwd);
def('cd', 'Change directory', (a, _s, c) => {
  const p = resolve(c.cwd, a[0] ?? HOME);
  if (a[0] === '-') { const prev = c.env.OLDPWD || HOME; c.env.OLDPWD = c.cwd; c.setCwd(prev); return prev; }
  if (!vfs.isDir(p)) throw new Error(`cd: ${a[0]}: Not a directory`);
  c.env.OLDPWD = c.cwd;
  c.setCwd(p);
  return '';
});
def('ls', 'List directory contents (-l long, -a all)', (args, _s, c) => {
  const { f, rest } = flags(args);
  const targets = rest.length ? rest : ['.'];
  const out: string[] = [];
  for (const t of targets) {
    const p = resolve(c.cwd, t);
    const n = need(p);
    const items = n.kind === 'dir' ? vfs.list(p).filter((x) => f.has('a') || !x.name.startsWith('.')) : [n];
    if (targets.length > 1) out.push(`${C.bold}${t}:${C.reset}`);
    if (f.has('l')) {
      out.push(`${C.dim}total ${items.length}${C.reset}`);
      for (const x of items) {
        const d = new Date(x.modified);
        const date = d.toLocaleDateString([], { month: 'short', day: '2-digit' }) + ' ' + d.toTimeString().slice(0, 5);
        out.push(`${x.kind === 'dir' ? 'd' : '-'}rw-------  ${formatBytes(x.size).padStart(8)}  ${date}  ${x.kind === 'dir' ? C.blue + C.bold + x.name + '/' + C.reset : x.name}`);
      }
    } else {
      out.push(items.map((x) => (x.kind === 'dir' ? `${C.blue}${C.bold}${x.name}/${C.reset}` : /\.(js|py|sh)$/.test(x.name) ? `${C.green}${x.name}${C.reset}` : x.name)).join('  '));
    }
  }
  return out.join('\n');
});
def('cat', 'Print file contents', async (a, stdin, c) => {
  if (!a.length) return stdin;
  const parts: string[] = [];
  for (const f of a) { const p = resolve(c.cwd, f); const n = need(p); if (n.kind === 'dir') throw new Error(`cat: ${f}: Is a directory`); parts.push(await vfs.readText(p)); }
  return parts.join('');
});
def('echo', 'Print text (-n no newline)', (a) => a.filter((x) => x !== '-n').join(' '));
def('touch', 'Create empty file / update time', async (a, _s, c) => {
  for (const f of a) { const p = resolve(c.cwd, f); if (vfs.exists(p)) await vfs.writeBytes(p, await vfs.readBytes(p)); else await vfs.writeText(p, ''); }
  return '';
});
def('mkdir', 'Create directories', async (a, _s, c) => { for (const d of flags(a).rest) await vfs.mkdir(resolve(c.cwd, d)); return ''; });
def('rm', 'Move to Trash (-f permanently, -r directories)', async (args, _s, c) => {
  const { f, rest } = flags(args);
  for (const t of rest) {
    const p = resolve(c.cwd, t);
    const n = need(p);
    if (n.kind === 'dir' && !f.has('r')) throw new Error(`rm: ${t}: is a directory (use -r)`);
    if (p === HOME || p === '/') throw new Error('rm: refusing to remove that');
    if (f.has('f')) await vfs.deletePermanent([p]); else await vfs.trash([p]);
  }
  return '';
});
def('rmdir', 'Remove empty directory', async (a, _s, c) => {
  for (const t of a) { const p = resolve(c.cwd, t); if (vfs.list(p).length) throw new Error(`rmdir: ${t}: Directory not empty`); await vfs.deletePermanent([p]); }
  return '';
});
def('mv', 'Move / rename', async (a, _s, c) => {
  if (a.length < 2) throw new Error('usage: mv SOURCE... DEST');
  const dest = resolve(c.cwd, a[a.length - 1]);
  for (const s of a.slice(0, -1)) { const src = resolve(c.cwd, s); need(src); await vfs.move(src, vfs.isDir(dest) ? join(dest, basename(src)) : dest); }
  return '';
});
def('cp', 'Copy (-r for directories)', async (args, _s, c) => {
  const { f, rest } = flags(args);
  if (rest.length < 2) throw new Error('usage: cp [-r] SOURCE... DEST');
  const dest = resolve(c.cwd, rest[rest.length - 1]);
  for (const s of rest.slice(0, -1)) {
    const src = resolve(c.cwd, s);
    if (need(src).kind === 'dir' && !f.has('r')) throw new Error(`cp: ${s} is a directory (use -r)`);
    await vfs.copy(src, vfs.isDir(dest) ? join(dest, basename(src)) : dest);
  }
  return '';
});
def('tree', 'Show directory tree', (a, _s, c) => {
  const root = resolve(c.cwd, a[0] ?? '.');
  need(root);
  const lines = [`${C.blue}${C.bold}${prettyPath(root)}${C.reset}`];
  let dirs = 0, files = 0;
  const walk = (p: string, prefix: string) => {
    const items = vfs.list(p).filter((x) => !x.name.startsWith('.'));
    items.forEach((x, i) => {
      const last = i === items.length - 1;
      lines.push(`${prefix}${last ? '└── ' : '├── '}${x.kind === 'dir' ? C.blue + C.bold + x.name + C.reset : x.name}`);
      if (x.kind === 'dir') { dirs++; walk(x.path, prefix + (last ? '    ' : '│   ')); } else files++;
    });
  };
  walk(root, '');
  return lines.join('\n') + `\n\n${dirs} directories, ${files} files`;
});
def('find', 'Find files: find [path] [-name pattern]', (a, _s, c) => {
  const idx = a.indexOf('-name');
  const pat = idx >= 0 ? a[idx + 1] : '*';
  const root = resolve(c.cwd, idx === 0 ? '.' : a[0] ?? '.');
  const re = globToRe(pat ?? '*');
  return vfs.walk(root).filter((n) => re.test(n.name)).map((n) => prettyPath(n.path)).sort().join('\n');
});
def('grep', 'Search text: grep [-i] [-n] [-r] PATTERN [files]', async (args, stdin, c) => {
  const { f, rest } = flags(args);
  const [pat, ...files] = rest;
  if (!pat) throw new Error('usage: grep PATTERN [FILE...]');
  let re: RegExp;
  try { re = new RegExp(pat, f.has('i') ? 'i' : ''); } catch { re = new RegExp(pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), f.has('i') ? 'i' : ''); }
  const hl = (l: string) => l.replace(new RegExp(re.source, re.flags + 'g'), (m) => `${C.red}${C.bold}${m}${C.reset}`);
  const sources: { name: string; text: string }[] = [];
  if (!files.length && !f.has('r')) sources.push({ name: '', text: stdin });
  const targets = files.length ? files : f.has('r') ? ['.'] : [];
  for (const t of targets) {
    const p = resolve(c.cwd, t);
    const n = need(p);
    const list = n.kind === 'dir' ? (f.has('r') ? vfs.walk(p).filter((x) => x.kind === 'file' && x.size < 1_000_000) : []) : [n];
    for (const x of list) { try { sources.push({ name: prettyPath(x.path), text: await vfs.readText(x.path) }); } catch { /* skip */ } }
  }
  const out: string[] = [];
  const multi = sources.length > 1 || f.has('r');
  for (const s of sources) s.text.split('\n').forEach((l, i) => {
    if (re.test(l)) out.push(`${multi ? C.magenta + s.name + C.reset + ':' : ''}${f.has('n') ? C.green + (i + 1) + C.reset + ':' : ''}${hl(l)}`);
  });
  return out.join('\n');
});
const takeN = (a: string[]) => { const i = a.indexOf('-n'); const n = i >= 0 ? Number(a[i + 1]) : 10; return { n, files: i >= 0 ? a.filter((_, j) => j !== i && j !== i + 1) : a }; };
def('head', 'First lines (-n N)', async (a, stdin, c) => { const { n, files } = takeN(a); const t = files.length ? await vfs.readText(resolve(c.cwd, files[0])) : stdin; return t.split('\n').slice(0, n).join('\n'); });
def('tail', 'Last lines (-n N)', async (a, stdin, c) => { const { n, files } = takeN(a); const t = files.length ? await vfs.readText(resolve(c.cwd, files[0])) : stdin; return t.replace(/\n$/, '').split('\n').slice(-n).join('\n'); });
def('wc', 'Count lines, words, bytes', async (a, stdin, c) => {
  const { f, rest } = flags(a);
  const t = rest.length ? await vfs.readText(resolve(c.cwd, rest[0])) : stdin;
  const l = t ? t.split('\n').length - (t.endsWith('\n') ? 1 : 0) : 0, w = t.trim() ? t.trim().split(/\s+/).length : 0, b = utf8(t).length;
  if (f.has('l')) return String(l);
  if (f.has('w')) return String(w);
  return `${String(l).padStart(7)}${String(w).padStart(8)}${String(b).padStart(8)}${rest[0] ? ' ' + rest[0] : ''}`;
});
def('sort', 'Sort lines (-r reverse, -n numeric)', (a, stdin) => { const { f } = flags(a); const l = stdin.replace(/\n$/, '').split('\n').sort((x, y) => (f.has('n') ? parseFloat(x) - parseFloat(y) : x.localeCompare(y))); return (f.has('r') ? l.reverse() : l).join('\n'); });
def('uniq', 'Remove adjacent duplicates', (_a, stdin) => stdin.split('\n').filter((l, i, arr) => l !== arr[i - 1]).join('\n'));
def('open', 'Open a file or folder with its app', async (a, _s, c) => { for (const f of a.length ? a : ['.']) { const p = resolve(c.cwd, f); need(p); await openPath(p); } return ''; });
def('edit', 'Open a file in Code', async (a, _s, c) => { const p = resolve(c.cwd, a[0] ?? ''); if (!vfs.exists(p)) await vfs.writeText(p, ''); wm.open('code', { path: p }); return ''; });
def('clear', 'Clear the screen', (_a, _s, c) => { c.clear(); return ''; });
def('history', 'Command history', (_a, _s, c) => c.history.map((h, i) => `${String(i + 1).padStart(4)}  ${h}`).join('\n'));
def('whoami', 'Current user', () => useSettings.getState().userName.toLowerCase().replace(/\s+/g, ''));
def('hostname', 'Host name', () => 'aether');
def('date', 'Current date and time', () => new Date().toString());
def('uptime', 'Session uptime', () => { const s = Math.floor((Date.now() - useSession.getState().unlockedAt) / 1000); return `up ${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ${s % 60}s`; });
def('apps', 'List installed apps', () => allApps().map((a) => `${C.cyan}${a.id.padEnd(14)}${C.reset}${a.name}`).join('\n'));
def('ps', 'List running windows', () => {
  const s = useWindows.getState();
  return `${C.dim}  PID        APP           WS  STATE      TITLE${C.reset}\n` + s.order.map((id) => {
    const w = s.wins[id];
    return `  ${id.split('-').pop()!.padEnd(9)}  ${(getApp(w.appId)?.name ?? w.appId).padEnd(12)}  ${String(w.ws + 1).padEnd(2)}  ${w.state.padEnd(9)}  ${w.title}`;
  }).join('\n');
});
def('kill', 'Close a window by PID or app id', (a) => {
  const s = useWindows.getState();
  const hits = Object.values(s.wins).filter((w) => a.includes(w.id.split('-').pop()!) || a.includes(w.appId));
  if (!hits.length) throw new Error('kill: no such process');
  hits.forEach((w) => wm.close(w.id, true));
  return `Killed ${hits.length} process${hits.length > 1 ? 'es' : ''}`;
});
def('calc', 'Evaluate math: calc 2^10 * sin(pi/4)', (a) => formatNumber(evaluate(a.join(' '))));
def('sha256', 'SHA-256 of a file or stdin', async (a, stdin, c) => (a.length ? `${await sha256(await vfs.readBytes(resolve(c.cwd, a[0])))}  ${a[0]}` : await sha256(stdin)));
def('base64', 'Encode / decode (-d) base64', (a, stdin) => (a.includes('-d') ? fromUtf8(fromB64(stdin.trim())) : toB64(utf8(stdin))));
def('uuid', 'Random UUID', () => crypto.randomUUID());
def('passgen', 'Generate a password: passgen [length] | passgen words', (a) => (a[0] === 'words' ? generatePassword({ length: 0, upper: true, digits: true, symbols: false, words: true, wordCount: 5 }) : generatePassword({ length: Number(a[0]) || 20, upper: true, digits: true, symbols: true })));
def('seal', 'Encrypt a file with a password → FILE.sealed', async (a, _s, c) => {
  const p = resolve(c.cwd, a[0] ?? '');
  need(p);
  const pw = await dialog.prompt({ title: `Seal ${basename(p)}`, password: true, label: 'Password (min 8 chars)', validate: (v) => (v.length < 8 ? 'Too short' : null) });
  if (!pw) return 'cancelled';
  const sealed = await sealWithPassword(pw, await vfs.readBytes(p));
  const dest = vfs.uniquePath(dirname(p), basename(p) + '.sealed');
  await vfs.writeText(dest, JSON.stringify({ ...sealed, name: basename(p) }), 'application/x-aether-sealed');
  return `${C.green}✓${C.reset} sealed → ${prettyPath(dest)} ${C.dim}(AES-256-GCM, PBKDF2 600k)${C.reset}`;
});
def('unseal', 'Decrypt a .sealed file', async (a, _s, c) => {
  const p = resolve(c.cwd, a[0] ?? '');
  need(p);
  const pw = await dialog.prompt({ title: `Unseal ${basename(p)}`, password: true });
  if (!pw) return 'cancelled';
  const sealed = JSON.parse(await vfs.readText(p)) as Sealed & { name?: string };
  let bytes: Uint8Array;
  try { bytes = await openWithPassword(pw, sealed); } catch { throw new Error('unseal: wrong password'); }
  const name = sealed.name ?? basename(p).replace(/\.sealed$/, '');
  const dest = vfs.uniquePath(dirname(p), name);
  await vfs.writeBytes(dest, bytes, mimeOf(name));
  return `${C.green}✓${C.reset} unsealed → ${prettyPath(dest)}`;
});
def('du', 'Disk usage of a path', (a, _s, c) => { const p = resolve(c.cwd, a[0] ?? '.'); need(p); const n = vfs.walk(p).reduce((s, x) => s + x.size, 0) + (vfs.stat(p)!.size); return `${formatBytes(n)}\t${prettyPath(p)}`; });
def('df', 'Storage summary', async () => {
  const u = vfs.usage();
  const est = await navigator.storage?.estimate?.().catch(() => undefined);
  return `Filesystem      Files   Used       Quota\naetherfs (enc)  ${String(u.files).padEnd(6)}  ${formatBytes(u.bytes).padEnd(9)}  ${est?.quota ? formatBytes(est.quota) : '—'}`;
});
def('env', 'Show environment', (_a, _s, c) => Object.entries(c.env).map(([k, v]) => `${k}=${v}`).join('\n'));
def('export', 'Set variable: export NAME=value', (a, _s, c) => { for (const kv of a) { const [k, ...v] = kv.split('='); if (k) c.env[k] = v.join('='); } return ''; });
def('alias', 'Define alias: alias ll="ls -l"', (a, _s, c) => {
  if (!a.length) return Object.entries(c.aliases).map(([k, v]) => `alias ${k}='${v}'`).join('\n');
  for (const kv of a) { const [k, ...v] = kv.split('='); if (k && v.length) c.aliases[k] = v.join('='); }
  setAppData('terminal', (d: any) => ({ ...d, aliases: c.aliases }), { history: [], aliases: {} });
  return '';
});
def('theme', 'Switch theme: theme dark|light|auto', (a) => { const t = a[0] as 'dark' | 'light' | 'auto'; if (!['dark', 'light', 'auto'].includes(t)) throw new Error('usage: theme dark|light|auto'); useSettings.getState().set({ theme: t }); return `theme → ${t}`; });
def('lock', 'Lock the session', () => { setTimeout(() => void session.lock(), 200); return 'Locking…'; });
def('notify', 'Send a notification: notify TITLE [BODY]', (a) => { notify({ appId: 'terminal', title: a[0] ?? 'Hello', body: a.slice(1).join(' ') || undefined }); return ''; });
def('sleep', 'Wait N seconds', (a) => new Promise((r) => setTimeout(() => r(''), Math.min(30, Number(a[0]) || 1) * 1000)));
def('js', 'Evaluate JavaScript expression', (a) => { const r = new Function(`"use strict"; return (${a.join(' ')})`)(); return typeof r === 'string' ? r : JSON.stringify(r, null, 2) ?? String(r); });
def('which', 'Locate a command', (a) => a.map((n) => (COMMANDS[n] ? `/bin/${n}` : `${n} not found`)).join('\n'));
def('man', 'Show help for a command', (a) => (COMMANDS[a[0]] ? `${C.bold}${a[0]}${C.reset} — ${COMMANDS[a[0]].help}` : `No manual entry for ${a[0]}`));
def('privacy', 'Privacy status', () => {
  const s = useSession.getState();
  const n = useNetwork.getState();
  return [`${C.bold}Privacy status${C.reset}`,
    `  Encryption     ${C.green}AES-256-GCM${C.reset} ${s.mode === 'passphrase' ? '(PBKDF2-SHA256 · 600,000 rounds)' : s.mode === 'guest' ? '(RAM only — erased on exit)' : '(non-extractable device key)'}`,
    `  Telemetry      ${C.green}none${C.reset}`,
    `  External reqs  ${n.external ? C.yellow : C.green}${n.external}${C.reset} this session`,
    `  App network    ${C.green}blocked by Content-Security-Policy${C.reset}`].join('\n');
});
def('neofetch', 'System info', () => {
  const u = vfs.usage();
  const s = useSession.getState();
  const name = useSettings.getState().userName.toLowerCase().replace(/\s+/g, '');
  const logo = [
    `${C.magenta}        ▲        `,
    `${C.magenta}       ▲ ▲       `,
    `${C.blue}      ▲ ◆ ▲      `,
    `${C.blue}     ▲  ◆  ▲     `,
    `${C.cyan}    ▲   ◆   ▲    `,
    `${C.cyan}   ▲▲▲▲▲▲▲▲▲▲▲   `,
  ];
  const info = [
    `${C.bold}${C.cyan}${name}${C.reset}@${C.bold}${C.cyan}aether${C.reset}`,
    '─'.repeat(name.length + 7),
    `${C.cyan}OS${C.reset}       AetherOS 2.0 Halcyon`,
    `${C.cyan}Kernel${C.reset}   WebCrypto · IndexedDB · ${navigator.userAgent.includes('Firefox') ? 'Gecko' : 'Blink'}`,
    `${C.cyan}Uptime${C.reset}   ${Math.floor((Date.now() - s.unlockedAt) / 60000)} min`,
    `${C.cyan}Shell${C.reset}    aesh 1.0`,
    `${C.cyan}Apps${C.reset}     ${allApps().length} installed`,
    `${C.cyan}Files${C.reset}    ${u.files} (${formatBytes(u.bytes)}, encrypted)`,
    `${C.cyan}CPU${C.reset}      ${navigator.hardwareConcurrency} threads`,
    `${C.cyan}Display${C.reset}  ${screen.width}×${screen.height} @${devicePixelRatio}x`,
    `${C.cyan}Vault${C.reset}    ${s.mode}`,
    '',
    `${C.red}███${C.green}███${C.yellow}███${C.blue}███${C.magenta}███${C.cyan}███${C.reset}`,
  ];
  return Array.from({ length: Math.max(logo.length, info.length) }, (_, i) => `${logo[i] ?? ' '.repeat(17)}${C.reset}  ${info[i] ?? ''}`).join('\n');
});
for (const n of ['curl', 'wget', 'ssh', 'ping', 'nc', 'telnet', 'ftp']) def(n, 'Disabled — no network for apps', BLOCKED(n));
def('exit', 'Close this terminal', (_a, _s, c) => { setTimeout(() => wm.close(c.winId), 50); return ''; });

/* ---------- Execution ---------- */
async function runLine(line: string, ctx: Ctx): Promise<{ out: string; ok: boolean }> {
  let lastOk = true;
  const outputs: string[] = [];
  const chain = splitTop(line, ['&&', ';', '||']);
  let prevSep = '';
  for (const { part, sep } of chain) {
    if ((prevSep === '&&' && !lastOk) || (prevSep === '||' && lastOk)) { prevSep = sep; continue; }
    prevSep = sep;
    if (!part.trim()) continue;
    try {
      outputs.push(await runPipeline(part, ctx));
      lastOk = true;
      ctx.env['?'] = '0';
    } catch (e) {
      outputs.push(`${C.red}${(e as Error).message}${C.reset}`);
      lastOk = false;
      ctx.env['?'] = '1';
    }
  }
  return { out: outputs.filter(Boolean).join('\n'), ok: lastOk };
}

async function runPipeline(src: string, ctx: Ctx): Promise<string> {
  let redirect: { path: string; append: boolean } | null = null;
  const m = /\s(>>?)\s*("[^"]+"|'[^']+'|\S+)\s*$/.exec(' ' + src);
  if (m) {
    redirect = { path: resolve(ctx.cwd, m[2].replace(/^["']|["']$/g, '')), append: m[1] === '>>' };
    src = (' ' + src).slice(0, m.index).trim();
  }
  let data = '';
  for (const seg of splitTop(src, ['|']).map((x) => x.part)) {
    let toks = tokenize(seg.trim(), ctx.env);
    if (!toks.length) continue;
    if (ctx.aliases[toks[0]]) toks = [...tokenize(ctx.aliases[toks[0]], ctx.env), ...toks.slice(1)];
    const [name, ...args] = toks;
    const cmd = COMMANDS[name];
    if (!cmd) {
      if (/^\d[\d\s+\-*/().^%]*$/.test(seg.trim())) { data = formatNumber(evaluate(seg)); continue; }
      throw new Error(`aesh: command not found: ${name}${name === 'sudo' ? ' — you already own everything here 😉' : ''}`);
    }
    data = await cmd(expandGlobs(args, ctx.cwd), data, ctx);
  }
  if (redirect) {
    const plain = data.replace(/\x1b\[\d+m/g, '');
    const prev = redirect.append && vfs.exists(redirect.path) ? await vfs.readText(redirect.path) : '';
    await vfs.writeText(redirect.path, prev + plain + (plain.endsWith('\n') ? '' : '\n'));
    return '';
  }
  return data;
}

/* ---------- UI ---------- */
interface Line { id: number; prompt?: string; text: string }
let lineId = 0;

export default function Terminal({ win }: AppProps) {
  const [cwd, setCwd] = useState<string>(win.data?.cwd && vfs.isDir(win.data.cwd) ? win.data.cwd : HOME);
  const [lines, setLines] = useState<Line[]>(() => [{ id: lineId++, text: `${C.bold}AetherOS${C.reset} shell ${C.dim}· type ${C.reset}${C.cyan}help${C.reset}${C.dim} for commands, ${C.reset}${C.cyan}neofetch${C.reset}${C.dim} for system info${C.reset}` }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [hIdx, setHIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const user = useSettings((s) => s.userName.toLowerCase().replace(/\s+/g, '')) || 'user';
  const ctxRef = useRef<Ctx>({
    cwd, env: { HOME, USER: user, SHELL: '/bin/aesh', TERM: 'aether-256color', OLDPWD: HOME }, aliases: { ll: 'ls -l', la: 'ls -la', '..': 'cd ..' },
    history: [], setCwd, clear: () => setLines([]), winId: win.id,
  });
  ctxRef.current.cwd = cwd;
  ctxRef.current.setCwd = setCwd;

  useEffect(() => {
    void loadAppData<{ history: string[]; aliases: Record<string, string> }>('terminal', { history: [], aliases: {} }).then((d) => {
      ctxRef.current.history = d.history ?? [];
      ctxRef.current.aliases = { ...ctxRef.current.aliases, ...(d.aliases ?? {}) };
    });
  }, []);

  useEffect(() => { wm.setTitle(win.id, `${user}@aether: ${prettyPath(cwd)}`); }, [cwd, user, win.id]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [lines]);
  useEffect(() => { if (useWindows.getState().activeId === win.id) inputRef.current?.focus(); }, [win.id]);

  const prompt = (p = cwd) => `${C.green}${C.bold}${user}@aether${C.reset}:${C.blue}${C.bold}${prettyPath(p)}${C.reset}$ `;

  const submit = async () => {
    const cmd = input;
    setInput('');
    setHIdx(-1);
    const pr = prompt();
    setLines((l) => [...l, { id: lineId++, prompt: pr, text: cmd }]);
    if (!cmd.trim()) return;
    const ctx = ctxRef.current;
    ctx.history = [...ctx.history.filter((h) => h !== cmd), cmd].slice(-500);
    setAppData('terminal', (d: any) => ({ ...d, history: ctx.history }), { history: [], aliases: {} });
    setBusy(true);
    const { out } = await runLine(cmd, ctx);
    setBusy(false);
    if (out) setLines((l) => [...l, { id: lineId++, text: out }]);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const complete = () => {
    const toks = input.split(/\s+/);
    const last = toks[toks.length - 1] ?? '';
    let candidates: string[];
    if (toks.length === 1) candidates = Object.keys(COMMANDS).filter((c) => c.startsWith(last));
    else {
      const full = resolve(cwd, last || '.');
      const dir = last.endsWith('/') || !last ? full : dirname(full);
      const prefix = last.endsWith('/') || !last ? '' : basename(full);
      const base = last.includes('/') ? last.slice(0, last.lastIndexOf('/') + 1) : '';
      candidates = vfs.list(dir).filter((n) => n.name.toLowerCase().startsWith(prefix.toLowerCase())).map((n) => base + (n.name.includes(' ') ? `"${n.name}"` : n.name) + (n.kind === 'dir' ? '/' : ''));
    }
    if (candidates.length === 1) {
      toks[toks.length - 1] = candidates[0] + (toks.length === 1 ? ' ' : '');
      setInput(toks.join(' '));
    } else if (candidates.length > 1) {
      let common = candidates[0];
      for (const c of candidates) while (!c.startsWith(common)) common = common.slice(0, -1);
      if (common.length > last.length) { toks[toks.length - 1] = common; setInput(toks.join(' ')); }
      else setLines((l) => [...l, { id: lineId++, prompt: prompt(), text: input }, { id: lineId++, text: candidates.map((c) => (c.endsWith('/') ? `${C.blue}${c}${C.reset}` : c)).join('  ') }]);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const h = ctxRef.current.history;
    if (e.key === 'Enter') { e.preventDefault(); if (!busy) void submit(); }
    else if (e.key === 'Tab') { e.preventDefault(); complete(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); const i = hIdx < 0 ? h.length - 1 : Math.max(0, hIdx - 1); if (h[i] !== undefined) { setHIdx(i); setInput(h[i]); } }
    else if (e.key === 'ArrowDown') { e.preventDefault(); if (hIdx < 0) return; const i = hIdx + 1; if (i >= h.length) { setHIdx(-1); setInput(''); } else { setHIdx(i); setInput(h[i]); } }
    else if (e.ctrlKey && e.key === 'l') { e.preventDefault(); setLines([]); }
    else if (e.ctrlKey && e.key === 'c' && !window.getSelection()?.toString()) { e.preventDefault(); setLines((l) => [...l, { id: lineId++, prompt: prompt(), text: input + '^C' }]); setInput(''); }
    else if (e.ctrlKey && e.key === 'u') { e.preventDefault(); setInput(''); }
  };

  const rendered = useMemo(() => lines.map((l) => (
    <div key={l.id} className="term-line">{l.prompt && <Ansi text={l.prompt} />}<Ansi text={l.text} /></div>
  )), [lines]);

  return (
    <div className="h-full bg-[#0c0d12]/95 text-[#e5e7eb] font-mono text-[13px] leading-[1.55] flex flex-col" onMouseUp={() => { if (!window.getSelection()?.toString()) inputRef.current?.focus(); }}>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 selectable">
        {rendered}
        <div className="flex term-line">
          {!busy && <Ansi text={prompt()} />}
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            disabled={busy}
            spellCheck={false}
            autoComplete="off"
            className="flex-1 bg-transparent outline-none text-[#e5e7eb] caret-[var(--accent)] min-w-0"
          />
          {busy && <span className="text-[#7c8293] animate-pulse">running…</span>}
        </div>
      </div>
    </div>
  );
}

export { isInside, randomId };
