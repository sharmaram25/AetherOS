import { Fragment, useEffect, useState } from 'react';
import { Sparkles, Package, Code2, Download, Trash2, Play, ShieldCheck, Upload, FileCode, Check, Lock, Globe, KeyRound, BookOpen } from 'lucide-react';
import type { AppProps } from '../kernel/registry';
import { useExtApps, allApps } from '../kernel/registry';
import { CATALOG, MANIFEST_TEMPLATE } from '../sdk/catalog';
import { installApp, uninstallApp, validateManifest } from '../sdk/apps';
import { wm } from '../kernel/windows';
import { vfs } from '../kernel/vfs';
import { dialog } from '../kernel/dialog';
import { notify, toast } from '../kernel/notify';
import { pickHostFiles } from '../kernel/launcher';
import { PERM_LABEL } from '../kernel/privacy';
import { HOME } from '../lib/path';
import { AppGlyph, Button, Card, Badge, Segmented, Empty, cx } from '../ui';

export default function Store({ win }: AppProps) {
  const [tab, setTab] = useState<'discover' | 'installed' | 'dev'>('discover');
  const installed = useExtApps((s) => s.apps);

  useEffect(() => {
    const p = win.data?.path as string | undefined;
    if (p?.endsWith('.aetherapp')) {
      void (async () => {
        try {
          const m = validateManifest(JSON.parse(await vfs.readText(p)));
          if (await dialog.confirm({ title: `Install “${m.name}”?`, message: `Permissions: ${m.permissions.join(', ') || 'none'}`, confirmLabel: 'Install' })) { await installApp(m); toast(`${m.name} installed`, 'success'); }
        } catch (e) { toast((e as Error).message, 'error'); }
      })();
    }
  }, [win.data?._n]); // eslint-disable-line react-hooks/exhaustive-deps

  const install = async (m: (typeof CATALOG)[number]) => {
    if (m.permissions.length) {
      const ok = await dialog.confirm({ title: `Install ${m.name}?`, message: `This app can ask for: ${m.permissions.map((p) => PERM_LABEL[p]).join(', ')}.\nYou'll be prompted before it uses any of them. It runs in a sandbox with no network access.`, confirmLabel: 'Install' });
      if (!ok) return;
    }
    await installApp(m);
    notify({ appId: 'store', title: `${m.name} installed`, tone: 'success', actions: [{ label: 'Open', run: () => wm.open('ext:' + m.id) }] });
  };

  const remove = async (id: string, name: string) => {
    if (!(await dialog.confirm({ title: `Uninstall ${name}?`, message: 'The app and its private storage will be deleted.', danger: true, confirmLabel: 'Uninstall' }))) return;
    wm.closeApp('ext:' + id);
    await uninstallApp(id);
    toast(`${name} uninstalled`);
  };

  const installFromFile = async () => {
    const [f] = await pickHostFiles({ accept: '.aetherapp,.json,.html', multiple: false });
    if (!f) return;
    try {
      const text = await f.text();
      let m;
      if (/\.html?$/i.test(f.name)) {
        const name = await dialog.prompt({ title: 'Name this app', value: f.name.replace(/\.\w+$/, '') });
        if (!name) return;
        m = validateManifest({ id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'app', name, icon: '🧩', color: '#6366f1', permissions: ['notifications', 'storage'], html: text });
      } else m = validateManifest(JSON.parse(text));
      if (!(await dialog.confirm({ title: `Install “${m.name}”?`, message: `${m.description ?? ''}\nPermissions: ${m.permissions.join(', ') || 'none'}`, confirmLabel: 'Install' }))) return;
      await installApp(m);
      notify({ appId: 'store', title: `${m.name} installed`, tone: 'success', actions: [{ label: 'Open', run: () => wm.open('ext:' + m!.id) }] });
    } catch (e) { toast((e as Error).message, 'error'); }
  };

  const newProject = async () => {
    const p = vfs.uniquePath(`${HOME}/Projects`, 'my-app.html');
    await vfs.writeText(p, `<!doctype html>\n<html>\n<head>\n  <style>\n    body { font-family: system-ui; padding: 24px; }\n    button { background: var(--aether-accent); color: white; border: 0; padding: 10px 16px; border-radius: 10px; font-size: 14px; cursor: pointer; }\n  </style>\n</head>\n<body>\n  <h1>Hello, Aether 👋</h1>\n  <p>Clicks: <b id="n">0</b></p>\n  <button id="b">Click me</button>\n  <script>\n    let n = 0;\n    aether.storage.get('clicks').then(v => { n = v || 0; document.getElementById('n').textContent = n; });\n    document.getElementById('b').onclick = async () => {\n      n++;\n      document.getElementById('n').textContent = n;\n      await aether.storage.set('clicks', n);\n      if (n % 10 === 0) aether.notify('Milestone!', n + ' clicks');\n    };\n  </script>\n</body>\n</html>\n`);
    wm.open('code', { path: p });
  };

  const builtins = allApps().filter((a) => !a.external);

  return (
    <div className="h-full flex flex-col">
      <div className="h-12 shrink-0 flex items-center justify-center border-b border-line">
        <Segmented value={tab} onChange={setTab} options={[{ value: 'discover', label: 'Discover', icon: Sparkles }, { value: 'installed', label: `Installed · ${Object.keys(installed).length}`, icon: Package }, { value: 'dev', label: 'Developers', icon: Code2 }]} />
      </div>
      <div className="flex-1 overflow-y-auto">
        {tab === 'discover' && (
          <div className="p-6 max-w-[860px] mx-auto space-y-7">
            <div className="rounded-3xl p-7 text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg,#4f46e5,#9333ea 55%,#db2777)' }}>
              <div className="absolute -right-10 -top-10 w-56 h-56 rounded-full bg-white/10 blur-2xl" />
              <div className="relative">
                <Badge className="!bg-white/20 !text-white !border-white/30"><ShieldCheck size={10} /> Sandboxed by design</Badge>
                <div className="text-[26px] font-semibold mt-3 tracking-tight">Apps that respect you</div>
                <div className="text-[13.5px] text-white/80 mt-1 max-w-md">Every app runs in an isolated sandbox with no network access. They can only touch your files or clipboard if you say so — and Shield logs every access.</div>
              </div>
            </div>
            <section>
              <div className="text-[15px] font-semibold mb-3">Featured</div>
              <div className="grid grid-cols-2 gap-3">
                {CATALOG.map((m) => {
                  const isIn = !!installed[m.id];
                  return (
                    <Card key={m.id} className="p-4 flex gap-4">
                      <AppGlyph app={{ icon: m.icon, gradient: [m.color, m.color], name: m.name }} size={56} />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-[14px]">{m.name}</div>
                        <div className="text-[12px] text-muted line-clamp-2 mt-0.5">{m.description}</div>
                        <div className="flex items-center gap-2 mt-2.5">
                          {isIn ? <Button size="sm" icon={Play} onClick={() => { wm.open('ext:' + m.id); }}>Open</Button> : <Button size="sm" variant="primary" icon={Download} onClick={() => install(m)}>Get</Button>}
                          <span className="text-[11px] text-faint">{m.permissions.length ? m.permissions.map((p) => PERM_LABEL[p]).join(' · ') : 'No permissions'}</span>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
            <section>
              <div className="text-[15px] font-semibold mb-3">Included with AetherOS</div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
                {builtins.map((a) => (
                  <button key={a.id} onClick={() => { wm.open(a.id); }} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-hover text-left">
                    <AppGlyph app={a} size={36} />
                    <div className="min-w-0"><div className="text-[13px] font-medium truncate">{a.name}</div><div className="text-[11px] text-muted truncate">{a.category}</div></div>
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}

        {tab === 'installed' && (
          <div className="p-6 max-w-[760px] mx-auto space-y-3">
            <div className="flex justify-between items-center">
              <div className="text-[15px] font-semibold">Installed apps</div>
              <Button size="sm" icon={Upload} onClick={installFromFile}>Install from file…</Button>
            </div>
            {Object.keys(installed).length === 0 ? <Card className="h-64"><Empty icon={Package} title="No apps installed yet" body="Get one from Discover, or build your own in Code." /></Card>
              : Object.values(installed).map((m) => (
                <Card key={m.id} className="p-4 flex items-center gap-4">
                  <AppGlyph app={{ icon: m.icon, gradient: [m.color, m.color], name: m.name }} size={44} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[13.5px]">{m.name} <span className="text-faint font-normal text-[12px]">{m.version}</span></div>
                    <div className="text-[12px] text-muted truncate">{m.description ?? 'Sandboxed app'}{m.author ? ` · ${m.author}` : ''}</div>
                    <div className="flex gap-1 mt-1.5 flex-wrap">{m.permissions.length ? m.permissions.map((p) => <Badge key={p}>{PERM_LABEL[p]}</Badge>) : <Badge tone="success">No permissions</Badge>}</div>
                  </div>
                  <Button size="sm" icon={Play} onClick={() => { wm.open('ext:' + m.id); }}>Open</Button>
                  <Button size="sm" variant="ghost" icon={Trash2} className="text-danger" onClick={() => remove(m.id, m.name)}>Remove</Button>
                </Card>
              ))}
          </div>
        )}

        {tab === 'dev' && (
          <div className="p-6 max-w-[780px] mx-auto space-y-5">
            <div>
              <div className="text-[22px] font-semibold tracking-tight">Build for AetherOS</div>
              <div className="text-[13.5px] text-muted mt-1">An Aether app is a single HTML document plus a tiny manifest. Write it in Code, preview it live, and install it with one click — no build tools, no accounts, no store review.</div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[{ i: Lock, t: 'Isolated', d: 'Opaque-origin iframe. No cookies, storage or DOM access to the OS.' }, { i: Globe, t: 'Offline', d: 'CSP blocks all outbound network. Apps can\'t phone home.' }, { i: KeyRound, t: 'Capabilities', d: 'Declare permissions; users approve each one at runtime.' }].map((x) => (
                <Card key={x.t} className="p-4"><x.i size={18} className="text-accent" /><div className="font-semibold text-[13px] mt-2">{x.t}</div><div className="text-[12px] text-muted mt-0.5">{x.d}</div></Card>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="primary" icon={FileCode} onClick={newProject}>Start a new app in Code</Button>
              <Button icon={Upload} onClick={installFromFile}>Install .aetherapp or .html</Button>
            </div>
            <Card className="p-5">
              <div className="flex items-center gap-2 font-semibold text-[14px]"><BookOpen size={15} /> SDK reference</div>
              <div className="text-[12.5px] text-muted mt-1 mb-3">Available as <code className="font-mono">window.aether</code> in every app. All calls return Promises.</div>
              <div className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5 text-[12.5px] font-mono">
                {[
                  ['aether.notify(title, body?)', 'Show a notification · needs "notifications"'],
                  ['aether.clipboard.write(text)', 'Copy text · needs "clipboard"'],
                  ['aether.storage.get/set/remove/keys', 'Private, encrypted key-value store (2 MB)'],
                  ['aether.fs.open({ extensions })', 'User picks a file → { name, path, text } · "files"'],
                  ['aether.fs.save(name, content)', 'User picks where to save · "files"'],
                  ['aether.fs.read/write/list(path)', 'Direct access to ~ after user consent · "files"'],
                  ['aether.setTitle(text)', 'Set the window title'],
                  ['aether.theme() · aether.on("theme")', 'Read and follow light/dark + accent'],
                ].map(([a, b]) => <Fragment key={a}><span className="text-accent">{a}</span><span className="font-sans text-muted">{b}</span></Fragment>)}
              </div>
              <div className="text-[12px] text-muted mt-3 font-sans">CSS variable <code className="font-mono">--aether-accent</code> and <code className="font-mono">[data-theme]</code> are set automatically.</div>
            </Card>
            <Card className="p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold text-[14px]">Manifest (.aetherapp)</div>
                <Button size="sm" icon={Check} onClick={async () => { const p = vfs.uniquePath(`${HOME}/Projects`, 'my-app.aetherapp'); await vfs.writeText(p, MANIFEST_TEMPLATE); wm.open('code', { path: p }); }}>Open template in Code</Button>
              </div>
              <pre className="text-[12px] font-mono bg-hover border border-line rounded-xl p-4 overflow-x-auto selectable">{MANIFEST_TEMPLATE}</pre>
              <div className="text-[12px] text-muted mt-2">Double-click any <code className="font-mono">.aetherapp</code> file in Files to install it. Valid permissions: notifications, clipboard, files, storage.</div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

export { cx };
