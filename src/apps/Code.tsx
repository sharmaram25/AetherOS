import { useEffect, useMemo, useRef, useState } from 'react';
import { basicSetup } from 'codemirror';
import { EditorView, keymap } from '@codemirror/view';
import { EditorState, Compartment, Prec, type Extension } from '@codemirror/state';
import { indentWithTab } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { markdown } from '@codemirror/lang-markdown';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';
import {
  X, Play, PanelLeft, FolderOpen, FilePlus, Save, ChevronRight, ChevronDown, Folder, Eye, Terminal as TermIcon, Trash2, Package, Circle, RefreshCw,
} from 'lucide-react';
import type { AppProps } from '../kernel/registry';
import { useVfs, vfs, type FsNode } from '../kernel/vfs';
import { wm, setCloseGuard } from '../kernel/windows';
import { dialog } from '../kernel/dialog';
import { toast, notify } from '../kernel/notify';
import { onBeforeLock } from '../kernel/session';
import { HOME, basename, extname, join, prettyPath, validName, dirname } from '../lib/path';
import { mimeOf } from '../lib/mime';
import { renderMarkdown } from '../lib/markdown';
import { buildSandboxDocument } from '../sdk/runtime';
import { installApp } from '../sdk/apps';
import { FileIcon } from '../shell/FileIcon';
import { useIsDark } from '../shell/theme';
import { Button, IconButton, Empty, cx, openMenu } from '../ui';
import { useLinkGuard } from './shared';

interface Tab { path: string; state: EditorState; dirty: boolean; saved: string }

function langFor(path: string): Extension {
  switch (extname(path)) {
    case 'js': case 'mjs': case 'cjs': return javascript();
    case 'jsx': return javascript({ jsx: true });
    case 'ts': return javascript({ typescript: true });
    case 'tsx': return javascript({ typescript: true, jsx: true });
    case 'json': case 'aetherapp': return json();
    case 'html': case 'htm': case 'svg': case 'xml': return html();
    case 'css': return css();
    case 'md': case 'markdown': return markdown();
    case 'py': return python();
    default: return [];
  }
}

const LANG_NAME: Record<string, string> = { js: 'JavaScript', mjs: 'JavaScript', jsx: 'JSX', ts: 'TypeScript', tsx: 'TSX', json: 'JSON', html: 'HTML', htm: 'HTML', css: 'CSS', md: 'Markdown', py: 'Python', svg: 'SVG', txt: 'Plain text', csv: 'CSV' };

const baseTheme = EditorView.theme({
  '&': { backgroundColor: 'transparent', height: '100%' },
  '.cm-gutters': { backgroundColor: 'transparent', border: 'none', color: 'var(--faint)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--fg)' },
  '.cm-activeLine': { backgroundColor: 'var(--hover)' },
  '.cm-content': { padding: '12px 0' },
  '.cm-cursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': { backgroundColor: 'color-mix(in oklab, var(--accent) 30%, transparent) !important' },
  '.cm-panels': { backgroundColor: 'var(--elevated)', color: 'var(--fg)' },
  '.cm-tooltip': { backgroundColor: 'var(--elevated)', border: '1px solid var(--line-strong)', borderRadius: '8px' },
});

const RUNNER = (code: string) => `<!doctype html><html><head><meta charset="utf-8"></head><body><script>
const send=(level,args)=>parent.postMessage({__run:true,level,text:args.map(a=>{try{return typeof a==='string'?a:a instanceof Error?a.stack||a.message:JSON.stringify(a,null,2)}catch{return String(a)}}).join(' ')},'*');
['log','info','warn','error','debug'].forEach(l=>{console[l]=(...a)=>send(l,a)});
window.onerror=(m,s,l,c,e)=>{send('error',[e||m]);};
window.onunhandledrejection=e=>send('error',['Unhandled rejection: '+(e.reason&&e.reason.message||e.reason)]);
(async()=>{const t0=performance.now();try{${'\n'}${code.replace(/<\/script>/gi, '<\\/script>')}${'\n'};send('done',['Finished in '+(performance.now()-t0).toFixed(1)+' ms'])}catch(e){send('error',[e])}})();
</script></body></html>`;

export default function Code({ win }: AppProps) {
  const nodes = useVfs((s) => s.nodes);
  const dark = useIsDark();
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const langComp = useRef(new Compartment());
  const themeComp = useRef(new Compartment());
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const tabsRef = useRef<Tab[]>([]);
  tabsRef.current = tabs;
  const activeRef = useRef<string | null>(null);
  activeRef.current = active;
  const [root, setRoot] = useState(`${HOME}/Projects`);
  const [sidebar, setSidebar] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [panel, setPanel] = useState<'none' | 'console' | 'preview'>('none');
  const [logs, setLogs] = useState<{ level: string; text: string }[]>([]);
  const [runId, setRunId] = useState(0);
  const [runDoc, setRunDoc] = useState<string | null>(null);
  const [cursor, setCursor] = useState({ line: 1, col: 1 });
  const [previewTick, setPreviewTick] = useState(0);
  const linkGuard = useLinkGuard();

  const makeState = (path: string, doc: string) => EditorState.create({
    doc,
    extensions: [
      basicSetup,
      keymap.of([indentWithTab, { key: 'Mod-s', preventDefault: true, run: () => { void saveActive(); return true; } }]),
      langComp.current.of(langFor(path)),
      themeComp.current.of(dark ? oneDark : []),
      Prec.highest(baseTheme),
      EditorView.lineWrapping,
      EditorView.updateListener.of((u) => {
        if (u.docChanged) {
          const p = activeRef.current;
          setTabs((ts) => ts.map((t) => (t.path === p ? { ...t, dirty: u.state.doc.toString() !== t.saved } : t)));
          if (panelRef.current === 'preview') setPreviewTick((x) => x + 1);
        }
        if (u.selectionSet || u.docChanged) {
          const pos = u.state.selection.main.head;
          const line = u.state.doc.lineAt(pos);
          setCursor({ line: line.number, col: pos - line.from + 1 });
        }
      }),
    ],
  });
  const panelRef = useRef(panel);
  panelRef.current = panel;

  // Create the editor view once.
  useEffect(() => {
    const view = new EditorView({ parent: hostRef.current!, state: EditorState.create({ doc: '' }) });
    viewRef.current = view;
    return () => view.destroy();
  }, []);

  // Theme switching
  useEffect(() => {
    viewRef.current?.dispatch({ effects: themeComp.current.reconfigure(dark ? oneDark : []) });
  }, [dark]);

  // Open requested file
  useEffect(() => {
    const p = win.data?.path as string | undefined;
    if (p) void openFile(p);
    if (win.data?.root) setRoot(win.data.root);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win.data?._n]);

  // Unsaved-changes guard and lock hook
  useEffect(() => {
    setCloseGuard(win.id, async () => {
      syncActive();
      const dirty = tabsRef.current.filter((t) => t.dirty);
      if (!dirty.length) return true;
      const ok = await dialog.confirm({ title: `Save changes to ${dirty.length} file${dirty.length > 1 ? 's' : ''}?`, message: dirty.map((t) => basename(t.path)).join(', '), confirmLabel: 'Save all', cancelLabel: 'Discard' });
      if (ok) await saveAll();
      return true;
    });
    const off = onBeforeLock(async () => { syncActive(); await saveAll(); });
    return () => { setCloseGuard(win.id, null); off(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win.id]);

  // Console messages from the runner iframe
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (!e.data?.__run || e.source !== runnerRef.current?.contentWindow) return;
      setLogs((l) => [...l, { level: e.data.level, text: e.data.text }].slice(-500));
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);
  const runnerRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    wm.setTitle(win.id, active ? `${basename(active)}${tabs.find((t) => t.path === active)?.dirty ? ' •' : ''} — Code` : 'Code');
  }, [active, tabs, win.id]);

  function syncActive() {
    const v = viewRef.current;
    const p = activeRef.current;
    if (!v || !p) return;
    tabsRef.current = tabsRef.current.map((t) => (t.path === p ? { ...t, state: v.state } : t));
    setTabs(tabsRef.current);
  }

  async function openFile(path: string) {
    if (!vfs.exists(path) || vfs.isDir(path)) return;
    syncActive();
    const existing = tabsRef.current.find((t) => t.path === path);
    if (existing) { activate(path, existing.state); return; }
    const node = vfs.stat(path)!;
    if (node.size > 5_000_000) { toast('File is too large to edit', 'error'); return; }
    const text = await vfs.readText(path);
    const state = makeState(path, text);
    const tab: Tab = { path, state, dirty: false, saved: text };
    tabsRef.current = [...tabsRef.current, tab];
    setTabs(tabsRef.current);
    activate(path, state);
    if (!path.startsWith(root + '/') && path.startsWith(HOME)) setRoot(dirname(path));
    setExpanded((e) => new Set([...e, dirname(path)]));
    if (['md', 'markdown', 'html', 'htm', 'svg'].includes(extname(path))) setPanel('preview');
  }

  function activate(path: string, state: EditorState) {
    viewRef.current?.setState(state);
    viewRef.current?.dispatch({ effects: themeComp.current.reconfigure(dark ? oneDark : []) });
    setActive(path);
    activeRef.current = path;
    requestAnimationFrame(() => viewRef.current?.focus());
  }

  async function saveTab(path: string) {
    const t = tabsRef.current.find((x) => x.path === path);
    if (!t) return;
    const text = path === activeRef.current && viewRef.current ? viewRef.current.state.doc.toString() : t.state.doc.toString();
    await vfs.writeText(path, text, mimeOf(path));
    tabsRef.current = tabsRef.current.map((x) => (x.path === path ? { ...x, saved: text, dirty: false } : x));
    setTabs(tabsRef.current);
  }
  async function saveActive() {
    const p = activeRef.current;
    if (!p) return;
    await saveTab(p);
    toast(`Saved ${basename(p)}`, 'success');
  }
  async function saveAll() {
    for (const t of tabsRef.current) if (t.dirty) await saveTab(t.path);
  }

  async function closeTab(path: string) {
    syncActive();
    const t = tabsRef.current.find((x) => x.path === path);
    if (t?.dirty) {
      const ok = await dialog.confirm({ title: `Save changes to ${basename(path)}?`, confirmLabel: 'Save', cancelLabel: 'Discard' });
      if (ok) await saveTab(path);
    }
    const idx = tabsRef.current.findIndex((x) => x.path === path);
    tabsRef.current = tabsRef.current.filter((x) => x.path !== path);
    setTabs(tabsRef.current);
    if (activeRef.current === path) {
      const next = tabsRef.current[Math.max(0, idx - 1)];
      if (next) activate(next.path, next.state);
      else { setActive(null); viewRef.current?.setState(EditorState.create({ doc: '' })); }
    }
  }

  async function newFile() {
    const name = await dialog.prompt({ title: 'New file', value: 'untitled.js', selectStem: true, message: `In ${prettyPath(root)}`, confirmLabel: 'Create', validate: (v) => validName(v) ?? (vfs.exists(join(root, v)) ? 'Already exists' : null) });
    if (!name) return;
    await vfs.writeText(join(root, name), '');
    await openFile(join(root, name));
  }

  async function openFolder() {
    const p = await dialog.folder({ startDir: root });
    if (p) { setRoot(p); setSidebar(true); }
  }

  const currentText = () => viewRef.current?.state.doc.toString() ?? '';

  function run() {
    if (!active) return;
    syncActive();
    const ext = extname(active);
    if (['html', 'htm', 'md', 'markdown', 'svg'].includes(ext)) { setPanel('preview'); setPreviewTick((x) => x + 1); return; }
    if (!['js', 'mjs'].includes(ext)) { toast('Only JavaScript, HTML and Markdown can be run', 'warn'); return; }
    setLogs([{ level: 'system', text: `▶ Running ${basename(active)} in an isolated sandbox…` }]);
    setRunDoc(RUNNER(currentText()));
    setRunId((x) => x + 1);
    setPanel('console');
  }

  async function packageApp() {
    if (!active) return;
    const name = await dialog.prompt({ title: 'Install as Aether app', message: 'Packages this HTML file as a sandboxed app and adds it to Launchpad.', value: basename(active).replace(/\.\w+$/, '').replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), confirmLabel: 'Install' });
    if (!name) return;
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'my-app';
    try {
      await installApp({ id, name, icon: '🧩', color: '#6366f1', description: `Built in Code from ${basename(active)}`, permissions: ['notifications', 'storage', 'clipboard'], html: currentText() });
      notify({ appId: 'store', title: `${name} installed`, body: 'Find it in Launchpad. It runs sandboxed with no network access.', tone: 'success', actions: [{ label: 'Open', run: () => wm.open('ext:' + id) }] });
    } catch (e) { toast((e as Error).message, 'error'); }
  }

  const previewHtml = useMemo(() => {
    if (panel !== 'preview' || !active) return '';
    const ext = extname(active);
    const text = currentText();
    if (ext === 'md' || ext === 'markdown') return '';
    if (ext === 'svg') return `<!doctype html><body style="margin:0;display:grid;place-items:center;height:100vh;background:#8881">${text}</body>`;
    return buildSandboxDocument(text, { dark, accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#6d7cff' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel, active, previewTick, dark]);
  const mdHtml = useMemo(() => (panel === 'preview' && active && /\.(md|markdown)$/.test(active) ? renderMarkdown(currentText()) : ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [panel, active, previewTick]);

  const ext = active ? extname(active) : '';
  const canRun = ['js', 'mjs', 'html', 'htm', 'md', 'markdown', 'svg'].includes(ext);

  return (
    <div className="h-full flex flex-col">
      <div className="h-11 shrink-0 flex items-center gap-1 px-2 border-b border-line">
        <IconButton icon={PanelLeft} label="Toggle explorer" active={sidebar} onClick={() => setSidebar(!sidebar)} />
        <IconButton icon={FilePlus} label="New file" onClick={newFile} />
        <IconButton icon={FolderOpen} label="Open folder" onClick={openFolder} />
        <IconButton icon={Save} label="Save (Ctrl S)" disabled={!active} onClick={saveActive} />
        <div className="flex-1" />
        {(ext === 'html' || ext === 'htm') && <Button size="sm" icon={Package} onClick={packageApp}>Install as app</Button>}
        <Button size="sm" variant={canRun ? 'primary' : 'secondary'} icon={['md', 'markdown', 'html', 'htm', 'svg'].includes(ext) ? Eye : Play} disabled={!canRun} onClick={run}>
          {['md', 'markdown', 'html', 'htm', 'svg'].includes(ext) ? 'Preview' : 'Run'}
        </Button>
        <IconButton icon={TermIcon} label="Console" active={panel === 'console'} onClick={() => setPanel(panel === 'console' ? 'none' : 'console')} />
      </div>
      <div className="flex-1 flex min-h-0">
        {sidebar && (
          <div className="w-[220px] shrink-0 border-r border-line flex flex-col bg-hover/40">
            <div className="h-8 flex items-center px-3 text-[11px] font-semibold uppercase tracking-wider text-faint justify-between">
              <span className="truncate">{basename(root) === 'home' ? 'Home' : basename(root)}</span>
            </div>
            <div className="flex-1 overflow-y-auto pb-2 text-[12.5px]">
              <Tree dir={root} nodes={nodes} depth={0} expanded={expanded} setExpanded={setExpanded} active={active} onOpen={openFile} />
            </div>
          </div>
        )}
        <div className="flex-1 flex flex-col min-w-0">
          {tabs.length > 0 && (
            <div className="h-9 shrink-0 flex items-end overflow-x-auto border-b border-line bg-hover/30">
              {tabs.map((t) => (
                <div
                  key={t.path}
                  onClick={() => { syncActive(); activate(t.path, tabsRef.current.find((x) => x.path === t.path)!.state); }}
                  onAuxClick={(e) => e.button === 1 && closeTab(t.path)}
                  onContextMenu={(e) => openMenu(e, [{ label: 'Close', onClick: () => closeTab(t.path) }, { label: 'Close others', onClick: async () => { for (const o of tabsRef.current.filter((x) => x.path !== t.path)) await closeTab(o.path); } }, { label: 'Reveal in Files', onClick: () => { wm.open('files', { path: dirname(t.path), select: t.path }); } }])}
                  className={cx('group h-full flex items-center gap-2 pl-3 pr-1.5 border-r border-line cursor-default text-[12.5px] shrink-0 max-w-[200px]',
                    t.path === active ? 'bg-surface text-fg border-t-2 border-t-accent' : 'text-muted hover:bg-hover')}
                  style={t.path === active ? { background: 'var(--window)' } : undefined}
                >
                  <span className="truncate">{basename(t.path)}</span>
                  <button onClick={(e) => { e.stopPropagation(); void closeTab(t.path); }} className="w-5 h-5 rounded flex items-center justify-center hover:bg-active">
                    {t.dirty ? <Circle size={8} className="fill-current group-hover:hidden" /> : null}
                    <X size={12} className={cx(t.dirty && 'hidden group-hover:block')} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex-1 flex min-h-0">
            <div className="flex-1 min-w-0 relative">
              <div ref={hostRef} className={cx('absolute inset-0 selectable', !active && 'invisible')} />
              {!active && <Empty icon={FilePlus} title="No file open" body="Open a file from the explorer, or create a new one. Everything is saved encrypted." action={<Button variant="primary" icon={FilePlus} onClick={newFile}>New file</Button>} />}
            </div>
            {panel === 'preview' && active && (
              <div className="w-[45%] min-w-[260px] border-l border-line flex flex-col">
                <div className="h-8 shrink-0 flex items-center gap-2 px-3 border-b border-line text-[11.5px] text-muted">
                  <Eye size={12} /> Live preview · sandboxed
                  <span className="flex-1" />
                  <IconButton icon={RefreshCw} size={12} className="w-6 h-6" onClick={() => setPreviewTick((x) => x + 1)} />
                  <IconButton icon={X} size={12} className="w-6 h-6" onClick={() => setPanel('none')} />
                </div>
                {/\.(md|markdown)$/.test(active)
                  ? <div className="flex-1 overflow-y-auto p-6 selectable" onClick={linkGuard}><div className="prose-aether" dangerouslySetInnerHTML={{ __html: mdHtml }} /></div>
                  : <iframe key={previewTick} title="preview" sandbox="allow-scripts" srcDoc={previewHtml} className="flex-1 w-full bg-white" />}
              </div>
            )}
          </div>
          {panel === 'console' && (
            <div className="h-[34%] min-h-[120px] shrink-0 border-t border-line flex flex-col">
              <div className="h-8 shrink-0 flex items-center gap-2 px-3 border-b border-line text-[11.5px] text-muted">
                <TermIcon size={12} /> Console
                <span className="flex-1" />
                <IconButton icon={Trash2} size={12} className="w-6 h-6" label="Clear" onClick={() => setLogs([])} />
                <IconButton icon={X} size={12} className="w-6 h-6" onClick={() => setPanel('none')} />
              </div>
              <div className="flex-1 overflow-y-auto font-mono text-[12px] p-2 selectable">
                {logs.length === 0 && <div className="text-faint px-1">Press Run to execute JavaScript in an isolated sandbox (no network, no access to your files).</div>}
                {logs.map((l, i) => (
                  <div key={i} className={cx('px-1 py-0.5 border-b border-line/50 whitespace-pre-wrap break-all',
                    l.level === 'error' ? 'text-danger bg-danger/5' : l.level === 'warn' ? 'text-warn' : l.level === 'system' || l.level === 'done' ? 'text-faint' : 'text-fg')}>{l.text}</div>
                ))}
              </div>
              {runDoc && <iframe key={runId} ref={runnerRef} title="runner" sandbox="allow-scripts" srcDoc={runDoc} className="hidden" />}
            </div>
          )}
        </div>
      </div>
      <div className="h-6 shrink-0 border-t border-line flex items-center gap-4 px-3 text-[11px] text-faint">
        {active ? (
          <>
            <span>Ln {cursor.line}, Col {cursor.col}</span>
            <span>{LANG_NAME[ext] ?? (ext.toUpperCase() || 'Plain text')}</span>
            <span>UTF-8</span>
            <span className="flex-1" />
            <span className="truncate">{prettyPath(active)}</span>
          </>
        ) : <span>Ready</span>}
      </div>
    </div>
  );
}

function Tree({ dir, nodes, depth, expanded, setExpanded, active, onOpen }: {
  dir: string; nodes: Record<string, FsNode>; depth: number; expanded: Set<string>; setExpanded: (f: (s: Set<string>) => Set<string>) => void; active: string | null; onOpen: (p: string) => void;
}) {
  const items = vfs.list(dir, nodes).filter((n) => !n.name.startsWith('.'));
  if (!items.length && depth === 0) return <div className="px-3 py-2 text-faint text-[12px]">Empty folder</div>;
  return (
    <>
      {items.map((n) => {
        const open = expanded.has(n.path);
        return (
          <div key={n.path}>
            <button
              onClick={() => (n.kind === 'dir' ? setExpanded((s) => { const x = new Set(s); if (x.has(n.path)) x.delete(n.path); else x.add(n.path); return x; }) : onOpen(n.path))}
              className={cx('w-full flex items-center gap-1.5 h-[26px] pr-2 text-left hover:bg-hover', active === n.path && 'bg-accent/15 text-fg')}
              style={{ paddingLeft: 8 + depth * 12 }}
            >
              {n.kind === 'dir' ? (open ? <ChevronDown size={13} className="text-faint shrink-0" /> : <ChevronRight size={13} className="text-faint shrink-0" />) : <span className="w-[13px] shrink-0" />}
              {n.kind === 'dir' ? <Folder size={14} className="text-sky-500 shrink-0" /> : <FileIcon node={n} size={15} />}
              <span className="truncate">{n.name}</span>
            </button>
            {n.kind === 'dir' && open && <Tree dir={n.path} nodes={nodes} depth={depth + 1} expanded={expanded} setExpanded={setExpanded} active={active} onOpen={onOpen} />}
          </div>
        );
      })}
    </>
  );
}
