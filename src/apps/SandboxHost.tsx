import { useEffect, useMemo, useRef, useState } from 'react';
import { ShieldCheck, AlertTriangle } from 'lucide-react';
import type { AppProps, ExtManifest } from '../kernel/registry';
import { readManifest } from '../sdk/apps';
import { buildSandboxDocument } from '../sdk/runtime';
import { wm } from '../kernel/windows';
import { notify } from '../kernel/notify';
import { dialog } from '../kernel/dialog';
import { vfs } from '../kernel/vfs';
import { requestPermission, copyText, logAccess, type Perm } from '../kernel/privacy';
import { getAppData, setAppData, loadAppData } from '../kernel/appdata';
import { useSettings } from '../kernel/settings';
import { useIsDark } from '../shell/theme';
import { HOME, resolve, basename, isInside } from '../lib/path';
import { mimeOf } from '../lib/mime';
import { fromB64 } from '../kernel/crypto';
import { Spinner, Empty } from '../ui';

const MAX_STORAGE = 2_000_000;

export default function SandboxHost({ win }: AppProps) {
  const id = win.appId.slice(4);
  const [manifest, setManifest] = useState<ExtManifest | null | undefined>(undefined);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const dark = useIsDark();
  const accent = useSettings((s) => s.accent);

  useEffect(() => { void readManifest(id).then((m) => { setManifest(m); if (m) wm.setTitle(win.id, m.name); }); }, [id, win.id]);

  // The document is built once; theme changes are pushed as events so app state survives.
  const doc = useMemo(() => (manifest ? buildSandboxDocument(manifest.html, { dark, accent }) : ''), [manifest]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage({ __aether: true, event: 'theme', data: { dark, accent } }, '*');
  }, [dark, accent]);

  useEffect(() => {
    if (!manifest) return;
    const appId = win.appId;
    const has = (p: Perm) => manifest.permissions.includes(p);
    const storeKey = `ext.${id}`;
    const need = async (p: Perm, reason: string) => {
      if (!has(p)) { logAccess(appId, p, false, 'Not declared in manifest'); throw new Error(`Permission "${p}" is not declared in this app's manifest`); }
      if (!(await requestPermission(appId, p, reason))) throw new Error(`Permission "${p}" was denied`);
    };
    const safePath = (p: string) => {
      const full = resolve(HOME, p);
      if (!isInside(full, HOME) && full !== HOME) throw new Error('Apps may only access files inside your home folder');
      return full;
    };

    const handlers: Record<string, (...a: any[]) => unknown> = {
      'app.info': () => ({ id: manifest.id, name: manifest.name, version: manifest.version, permissions: manifest.permissions }),
      'theme.get': () => ({ dark, accent }),
      'window.setTitle': (t: string) => { wm.setTitle(win.id, `${String(t).slice(0, 80)}`); return true; },
      'log': () => undefined,
      notify: async (title: string, body?: string) => {
        await need('notifications', 'This app would like to show notifications.');
        notify({ appId, title: String(title).slice(0, 120), body: body?.slice(0, 400) });
        return true;
      },
      'clipboard.write': async (text: string) => {
        if (!has('clipboard')) throw new Error('Permission "clipboard" is not declared in this app\'s manifest');
        await copyText(String(text).slice(0, 100_000), { appId });
        return true;
      },
      'storage.get': async (k: string) => { await loadAppData(storeKey, {}); return (getAppData<Record<string, unknown>>(storeKey, {}))[k] ?? null; },
      'storage.set': async (k: string, v: unknown) => {
        await loadAppData(storeKey, {});
        const next = { ...getAppData<Record<string, unknown>>(storeKey, {}), [k]: v };
        if (JSON.stringify(next).length > MAX_STORAGE) throw new Error('Storage quota exceeded (2 MB)');
        setAppData(storeKey, next);
        return true;
      },
      'storage.remove': async (k: string) => { await loadAppData(storeKey, {}); const { [k]: _r, ...rest } = getAppData<Record<string, unknown>>(storeKey, {}); setAppData(storeKey, rest); return true; },
      'storage.keys': async () => { await loadAppData(storeKey, {}); return Object.keys(getAppData<Record<string, unknown>>(storeKey, {})); },
      'fs.pickOpen': async (opts: { extensions?: string[] }) => {
        if (!has('files')) throw new Error('Permission "files" is not declared in this app\'s manifest');
        const p = await dialog.open({ title: `${manifest.name} wants to open a file`, extensions: opts?.extensions });
        if (!p) return null;
        logAccess(appId, 'files', true, `Opened ${basename(p)} via picker`);
        return { path: p.replace(HOME, '~'), name: basename(p), text: await vfs.readText(p) };
      },
      'fs.pickSave': async (name: string, content: string, opts: { startDir?: string }) => {
        if (!has('files')) throw new Error('Permission "files" is not declared in this app\'s manifest');
        const p = await dialog.save({ title: `${manifest.name} wants to save a file`, defaultName: basename(String(name)), startDir: opts?.startDir });
        if (!p) return null;
        const m = /^data:([^;]+);base64,(.*)$/.exec(String(content));
        if (m) await vfs.writeBytes(p, fromB64(m[2]), m[1]);
        else await vfs.writeText(p, String(content), mimeOf(p));
        logAccess(appId, 'files', true, `Saved ${basename(p)} via picker`);
        return p.replace(HOME, '~');
      },
      'fs.readText': async (p: string) => { await need('files', 'This app wants to read files in your home folder.'); return vfs.readText(safePath(p)); },
      'fs.writeText': async (p: string, t: string) => { await need('files', 'This app wants to write files in your home folder.'); await vfs.writeText(safePath(p), String(t)); return true; },
      'fs.list': async (p: string) => { await need('files', 'This app wants to list files in your home folder.'); return vfs.list(safePath(p)).map((n) => ({ name: n.name, kind: n.kind, size: n.size, modified: n.modified })); },
    };

    const onMsg = async (e: MessageEvent) => {
      const d = e.data;
      if (!d || d.__aether !== true || e.source !== iframeRef.current?.contentWindow) return;
      const fn = handlers[d.method];
      const reply = (payload: object) => (e.source as Window).postMessage({ __aether: true, id: d.id, ...payload }, '*');
      if (!fn) { if (d.id) reply({ error: `Unknown method ${d.method}` }); return; }
      try {
        const result = await fn(...(Array.isArray(d.params) ? d.params : []));
        if (d.id) reply({ result });
      } catch (err) {
        if (d.id) reply({ error: (err as Error).message });
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [manifest, win.appId, win.id, id, dark, accent]);

  if (manifest === undefined) return <div className="h-full flex items-center justify-center"><Spinner /></div>;
  if (!manifest) return <Empty icon={AlertTriangle} title="App not found" body="It may have been uninstalled." />;

  return (
    <div className="h-full flex flex-col">
      <iframe ref={iframeRef} title={manifest.name} sandbox="allow-scripts allow-modals" srcDoc={doc} className="flex-1 w-full border-0" allow="" referrerPolicy="no-referrer" />
      <div className="h-6 shrink-0 border-t border-line flex items-center gap-1.5 px-3 text-[10.5px] text-faint">
        <ShieldCheck size={11} className="text-success" /> Sandboxed · no network · {manifest.permissions.length ? `can request: ${manifest.permissions.join(', ')}` : 'no permissions'}
      </div>
    </div>
  );
}
