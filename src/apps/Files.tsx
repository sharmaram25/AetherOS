import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft, ChevronRight, ChevronUp, Home, Monitor, FileText, Download, Image, Music, Video, Trash2, Star, Search, LayoutGrid,
  List, FolderPlus, Upload, ArrowUpDown, PanelRight, ExternalLink, Pencil, Copy, Scissors, ClipboardPaste, Lock, Info, RotateCcw,
  NotebookPen, Code2, HardDrive, X, Hash, FilePlus, SquareTerminal, AppWindow, Check,
} from 'lucide-react';
import type { AppProps } from '../kernel/registry';
import { useVfs, vfs, type FsNode } from '../kernel/vfs';
import { wm } from '../kernel/windows';
import { dialog } from '../kernel/dialog';
import { toast, notify } from '../kernel/notify';
import { openPath, importHostFiles, exportToHost, pickHostFiles, appForPath } from '../kernel/launcher';
import { sealWithPassword, sha256 } from '../kernel/crypto';
import { useSettings } from '../kernel/settings';
import { HOME, TRASH, dirname, join, prettyPath, validName, isInside, basename } from '../lib/path';
import { formatBytes, kindOf, isTextMime } from '../lib/mime';
import { formatDate } from '../lib/format';
import { FileIcon } from '../shell/FileIcon';
import { DRAG_MIME } from '../shell/Dock';
import { Button, IconButton, Input, SidebarItem, SectionLabel, Empty, cx, openMenu, openMenuAt, useObjectUrl, type MenuItem, Segmented } from '../ui';
import { emptyTrash } from '../shell/commands';
import { sound } from '../lib/sound';

const PLACES = [
  { label: 'Home', path: HOME, icon: Home },
  { label: 'Desktop', path: `${HOME}/Desktop`, icon: Monitor },
  { label: 'Documents', path: `${HOME}/Documents`, icon: FileText },
  { label: 'Downloads', path: `${HOME}/Downloads`, icon: Download },
  { label: 'Projects', path: `${HOME}/Projects`, icon: Code2 },
  { label: 'Notes', path: `${HOME}/Notes`, icon: NotebookPen },
];
const MEDIA = [
  { label: 'Pictures', path: `${HOME}/Pictures`, icon: Image },
  { label: 'Music', path: `${HOME}/Music`, icon: Music },
  { label: 'Videos', path: `${HOME}/Videos`, icon: Video },
];

type SortKey = 'name' | 'modified' | 'size' | 'kind';
let clipboard: { mode: 'copy' | 'cut'; paths: string[] } | null = null;

export default function Files({ win }: AppProps) {
  const nodes = useVfs((s) => s.nodes);
  const showHidden = false;
  const [path, setPath] = useState<string>(win.data?.path && vfs.isDir(win.data.path) ? win.data.path : HOME);
  const [back, setBack] = useState<string[]>([]);
  const [fwd, setFwd] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>(win.data?.select ? [win.data.select] : []);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'name', dir: 1 });
  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState(win.w >= 860);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [hostDrop, setHostDrop] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // React to "open folder" requests from elsewhere.
  useEffect(() => {
    if (win.data?.path && vfs.isDir(win.data.path)) navigate(win.data.path);
    if (win.data?.select) setSelected([win.data.select]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win.data?._n]);

  useEffect(() => {
    if (!nodes[path]) setPath(HOME);
  }, [nodes, path]);

  useEffect(() => {
    wm.setTitle(win.id, path === HOME ? 'Home' : path === TRASH ? 'Trash' : basename(path));
  }, [path, win.id]);

  const inTrash = path === TRASH || isInside(path, TRASH);
  const starredView = path === ':starred';

  const items = useMemo(() => {
    let list: FsNode[];
    if (starredView) list = Object.values(nodes).filter((n) => n.starred && !isInside(n.path, TRASH));
    else if (query.trim()) list = vfs.search(query, 200).filter((n) => path === HOME || isInside(n.path, path));
    else list = vfs.list(path, nodes);
    if (!showHidden) list = list.filter((n) => !n.name.startsWith('.'));
    const k = sort.key;
    return [...list].sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1;
      let r = 0;
      if (k === 'name') r = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      else if (k === 'modified') r = a.modified - b.modified;
      else if (k === 'size') r = a.size - b.size;
      else r = kindOf(a.path).localeCompare(kindOf(b.path));
      return r * sort.dir;
    });
  }, [nodes, path, query, sort, starredView, showHidden]);

  const navigate = (p: string) => {
    if (p === path) return;
    setBack((b) => [...b, path]);
    setFwd([]);
    setPath(p);
    setSelected([]);
    setQuery('');
  };
  const goBack = () => { const b = [...back]; const p = b.pop(); if (!p) return; setBack(b); setFwd((f) => [path, ...f]); setPath(p); setSelected([]); };
  const goFwd = () => { const [p, ...rest] = fwd; if (!p) return; setFwd(rest); setBack((b) => [...b, path]); setPath(p); setSelected([]); };

  const open = (n: FsNode) => (n.kind === 'dir' && !inTrash ? navigate(n.path) : void openPath(n.path));

  const select = (n: FsNode, e: React.MouseEvent) => {
    if (e.shiftKey && anchor) {
      const a = items.findIndex((i) => i.path === anchor), b = items.findIndex((i) => i.path === n.path);
      const [lo, hi] = a < b ? [a, b] : [b, a];
      setSelected(items.slice(lo, hi + 1).map((i) => i.path));
    } else if (e.ctrlKey || e.metaKey) {
      setSelected((s) => (s.includes(n.path) ? s.filter((x) => x !== n.path) : [...s, n.path]));
      setAnchor(n.path);
    } else {
      setSelected([n.path]);
      setAnchor(n.path);
    }
  };

  /* ---------- actions ---------- */
  const targetDir = starredView ? HOME : path;

  const newFolder = async () => {
    const name = await dialog.prompt({ title: 'New folder', value: 'Untitled Folder', confirmLabel: 'Create', validate: (v) => validName(v) ?? (vfs.exists(join(targetDir, v)) ? 'Already exists' : null) });
    if (!name) return;
    await vfs.mkdir(join(targetDir, name));
    setSelected([join(targetDir, name)]);
  };

  const newFile = async () => {
    const name = await dialog.prompt({ title: 'New file', value: 'Untitled.txt', selectStem: true, confirmLabel: 'Create', validate: (v) => validName(v) ?? (vfs.exists(join(targetDir, v)) ? 'Already exists' : null) });
    if (!name) return;
    await vfs.writeText(join(targetDir, name), '');
    void openPath(join(targetDir, name));
  };

  const rename = async (n: FsNode) => {
    const name = await dialog.prompt({ title: `Rename ${n.kind === 'dir' ? 'folder' : 'file'}`, value: n.name, selectStem: n.kind === 'file', confirmLabel: 'Rename', validate: (v) => validName(v) ?? (v !== n.name && vfs.exists(join(dirname(n.path), v)) ? 'An item with that name exists' : null) });
    if (!name || name === n.name) return;
    const np = await vfs.rename(n.path, name);
    setSelected([np]);
  };

  const trash = async (paths: string[]) => {
    if (!paths.length) return;
    if (inTrash) {
      const ok = await dialog.confirm({ title: `Delete ${paths.length} item${paths.length > 1 ? 's' : ''} forever?`, message: 'This cannot be undone.', confirmLabel: 'Delete', danger: true });
      if (!ok) return;
      await vfs.deletePermanent(paths);
    } else {
      await vfs.trash(paths);
      if (useSettings.getState().sounds) sound('trash');
      toast(`Moved ${paths.length} item${paths.length > 1 ? 's' : ''} to Trash`, 'info');
    }
    setSelected([]);
  };

  const paste = async () => {
    if (!clipboard) return;
    for (const p of clipboard.paths) {
      if (!vfs.exists(p)) continue;
      const dest = vfs.uniquePath(targetDir, basename(p));
      try {
        if (clipboard.mode === 'copy') await vfs.copy(p, dest);
        else if (dirname(p) !== targetDir) await vfs.move(p, dest);
      } catch (e) { toast((e as Error).message, 'error'); }
    }
    if (clipboard.mode === 'cut') clipboard = null;
  };

  const seal = async (n: FsNode) => {
    const pw = await dialog.prompt({ title: `Seal “${n.name}”`, message: 'Creates a password-encrypted copy you can safely share or store anywhere. Anyone with the password can open it.', password: true, label: 'Password (min 8 characters)', confirmLabel: 'Seal', validate: (v) => (v.length < 8 ? 'At least 8 characters' : null) });
    if (!pw) return;
    const sealed = await sealWithPassword(pw, await vfs.readBytes(n.path));
    const dest = vfs.uniquePath(dirname(n.path), n.name + '.sealed');
    await vfs.writeText(dest, JSON.stringify({ ...sealed, name: n.name }), 'application/x-aether-sealed');
    notify({ appId: 'files', title: 'File sealed', body: `${basename(dest)} · AES-256-GCM`, tone: 'success' });
  };

  const moveInto = async (paths: string[], dir: string) => {
    for (const p of paths) {
      if (p === dir || dirname(p) === dir || isInside(dir, p)) continue;
      try {
        if (dir === TRASH) await vfs.trash([p]);
        else await vfs.move(p, vfs.uniquePath(dir, basename(p)));
      } catch (e) { toast((e as Error).message, 'error'); }
    }
  };

  const itemMenu = (e: React.MouseEvent, n: FsNode) => {
    e.stopPropagation();
    const sel = selected.includes(n.path) ? selected : [n.path];
    if (!selected.includes(n.path)) setSelected([n.path]);
    const single = sel.length === 1;
    if (inTrash) {
      openMenu(e, [
        { label: 'Put back', icon: RotateCcw, onClick: async () => { for (const p of sel) await vfs.restore(p); } },
        { separator: true },
        { label: 'Delete forever…', icon: Trash2, danger: true, onClick: () => trash(sel) },
      ]);
      return;
    }
    const openWith: MenuItem[] = ['code', 'notes', 'photos', 'media', 'sheets', 'preview'].map((id) => ({ label: { code: 'Code', notes: 'Notes', photos: 'Photos', media: 'Media', sheets: 'Sheets', preview: 'Preview' }[id]!, checked: appForPath(n.path) === id, onClick: () => void openPath(n.path, id) }));
    openMenu(e, [
      { label: 'Open', icon: ExternalLink, onClick: () => sel.forEach((p) => { const x = vfs.stat(p); if (x) open(x); }) },
      ...(n.kind === 'file' && single ? [{ label: 'Open with', icon: AppWindow, submenu: openWith }] : []),
      ...(n.kind === 'dir' && single ? [{ label: 'Open in new window', icon: AppWindow, onClick: () => { wm.open('files', { path: n.path }, { newWindow: true }); } }, { label: 'Open in Terminal', icon: SquareTerminal, onClick: () => { wm.open('terminal', { cwd: n.path }, { newWindow: true }); } }] : []),
      { separator: true },
      { label: 'Rename…', icon: Pencil, shortcut: 'F2', disabled: !single, onClick: () => rename(n) },
      { label: 'Duplicate', icon: Copy, onClick: async () => { for (const p of sel) await vfs.copy(p, vfs.uniquePath(dirname(p), basename(p))); } },
      { label: 'Copy', icon: Copy, shortcut: 'Ctrl C', onClick: () => { clipboard = { mode: 'copy', paths: sel }; toast(`Copied ${sel.length} item${sel.length > 1 ? 's' : ''}`); } },
      { label: 'Cut', icon: Scissors, shortcut: 'Ctrl X', onClick: () => { clipboard = { mode: 'cut', paths: sel }; } },
      { separator: true },
      { label: n.starred ? 'Remove from Starred' : 'Add to Starred', icon: Star, onClick: () => sel.forEach((p) => vfs.setStarred(p, !n.starred)) },
      ...(n.kind === 'file' ? [
        { label: 'Export to computer', icon: Download, onClick: () => sel.forEach((p) => void exportToHost(p)) },
        { label: 'Seal with password…', icon: Lock, disabled: !single, onClick: () => seal(n) },
      ] : []),
      ...(n.kind === 'file' && /\.(png|jpe?g|webp|svg)$/i.test(n.name) && single ? [{ label: 'Set as wallpaper', icon: Image, onClick: () => { useSettings.getState().set({ wallpaper: 'custom:' + n.path }); toast('Wallpaper updated', 'success'); } }] : []),
      { label: 'Get info', icon: Info, onClick: () => { setPreview(true); setSelected([n.path]); } },
      { separator: true },
      { label: 'Move to Trash', icon: Trash2, shortcut: 'Del', danger: true, onClick: () => trash(sel) },
    ]);
  };

  const bgMenu = (e: React.MouseEvent) => {
    if (inTrash) {
      openMenu(e, [{ label: 'Empty Trash…', icon: Trash2, danger: true, disabled: !items.length, onClick: emptyTrash }]);
      return;
    }
    openMenu(e, [
      { label: 'New folder', icon: FolderPlus, shortcut: 'Ctrl Shift N', onClick: newFolder },
      { label: 'New file…', icon: FilePlus, onClick: newFile },
      { label: 'Import files…', icon: Upload, onClick: importFiles },
      { label: 'Paste', icon: ClipboardPaste, shortcut: 'Ctrl V', disabled: !clipboard, onClick: paste },
      { separator: true },
      { label: 'Open in Terminal', icon: SquareTerminal, onClick: () => { wm.open('terminal', { cwd: targetDir }, { newWindow: true }); } },
      { label: view === 'grid' ? 'View as list' : 'View as icons', icon: view === 'grid' ? List : LayoutGrid, onClick: () => setView(view === 'grid' ? 'list' : 'grid') },
    ]);
  };

  const importFiles = async () => {
    const files = await pickHostFiles();
    if (files.length) await importHostFiles(files, targetDir);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    const mod = e.ctrlKey || e.metaKey;
    const idx = items.findIndex((i) => i.path === selected[selected.length - 1]);
    const cols = view === 'grid' && listRef.current ? Math.max(1, Math.floor(listRef.current.clientWidth / 108)) : 1;
    const move = (d: number) => {
      e.preventDefault();
      const next = items[Math.max(0, Math.min(items.length - 1, (idx < 0 ? -1 : idx) + d))];
      if (next) { setSelected([next.path]); setAnchor(next.path); listRef.current?.querySelector(`[data-path="${CSS.escape(next.path)}"]`)?.scrollIntoView({ block: 'nearest' }); }
    };
    if (e.key === 'ArrowRight' && view === 'grid') move(1);
    else if (e.key === 'ArrowLeft' && view === 'grid') move(-1);
    else if (e.key === 'ArrowDown') move(cols);
    else if (e.key === 'ArrowUp') move(-cols);
    else if (e.key === 'Enter' && selected.length) { const n = vfs.stat(selected[0]); if (n) open(n); }
    else if (e.key === 'Backspace' && !selected.length && path !== '/') navigate(dirname(path));
    else if (e.key === 'Delete' || (e.key === 'Backspace' && mod)) void trash(selected);
    else if (e.key === 'F2' && selected.length === 1) { const n = vfs.stat(selected[0]); if (n) void rename(n); }
    else if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); setSelected(items.map((i) => i.path)); }
    else if (mod && e.key.toLowerCase() === 'c' && selected.length) { clipboard = { mode: 'copy', paths: selected }; toast(`Copied ${selected.length} item${selected.length > 1 ? 's' : ''}`); }
    else if (mod && e.key.toLowerCase() === 'x' && selected.length) clipboard = { mode: 'cut', paths: selected };
    else if (mod && e.key.toLowerCase() === 'v') void paste();
    else if (mod && e.shiftKey && e.key.toLowerCase() === 'n') { e.preventDefault(); void newFolder(); }
  };

  /* ---------- drag & drop ---------- */
  const dragProps = (n: FsNode) => ({
    draggable: !inTrash,
    onDragStart: (e: React.DragEvent) => {
      const paths = selected.includes(n.path) ? selected : [n.path];
      if (!selected.includes(n.path)) setSelected([n.path]);
      e.dataTransfer.setData(DRAG_MIME, JSON.stringify(paths));
      e.dataTransfer.effectAllowed = 'copyMove';
    },
    ...(n.kind === 'dir' ? dropProps(n.path) : {}),
  });

  function dropProps(dir: string) {
    return {
      onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = e.dataTransfer.types.includes(DRAG_MIME) ? (e.altKey ? 'copy' : 'move') : 'copy'; setDropTarget(dir); },
      onDragLeave: () => setDropTarget((t) => (t === dir ? null : t)),
      onDrop: async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDropTarget(null);
        setHostDrop(false);
        const raw = e.dataTransfer.getData(DRAG_MIME);
        if (raw) {
          const paths = JSON.parse(raw) as string[];
          if (e.altKey) { for (const p of paths) await vfs.copy(p, vfs.uniquePath(dir, basename(p))); }
          else await moveInto(paths, dir);
        } else if (e.dataTransfer.files.length) {
          await importHostFiles(e.dataTransfer.files, dir);
        }
      },
    };
  }

  const crumbs = starredView ? [] : path.split('/').filter(Boolean);
  const selNodes = selected.map((p) => nodes[p]).filter(Boolean);
  const selSize = selNodes.reduce((a, n) => a + n.size, 0);
  const trashCount = vfs.list(TRASH, nodes).length;
  const usage = useMemo(() => vfs.usage(), [nodes]);

  return (
    <div className="h-full flex" onKeyDown={onKey} tabIndex={0}>
      {/* Sidebar */}
      <div className="w-[196px] shrink-0 border-r border-line flex flex-col bg-hover/40">
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          <SectionLabel>Favorites</SectionLabel>
          {PLACES.map((p) => <SidebarItem key={p.path} icon={p.icon} label={p.label} active={path === p.path} onClick={() => navigate(p.path)} {...dropTargets(p.path)} />)}
          <SidebarItem icon={Star} label="Starred" active={starredView} onClick={() => navigate(':starred')} color="#f59e0b" />
          <SectionLabel>Media</SectionLabel>
          {MEDIA.map((p) => <SidebarItem key={p.path} icon={p.icon} label={p.label} active={path === p.path} onClick={() => navigate(p.path)} {...dropTargets(p.path)} />)}
          <SectionLabel>System</SectionLabel>
          <SidebarItem icon={Trash2} label="Trash" count={trashCount} active={inTrash} onClick={() => navigate(TRASH)} onDrop={async (e) => { const raw = e.dataTransfer.getData(DRAG_MIME); if (raw) await trash(JSON.parse(raw)); }} />
        </div>
        <div className="p-3 border-t border-line">
          <div className="flex items-center gap-2 text-[11.5px] text-muted"><HardDrive size={13} /> {usage.files} files · {formatBytes(usage.bytes)}</div>
          <div className="mt-2 h-1.5 rounded-full bg-line overflow-hidden flex">
            {Object.entries(usage.byKind).map(([k, v], i) => (
              <div key={k} style={{ width: `${(v / Math.max(1, usage.bytes)) * 100}%`, background: ['#6366f1', '#ec4899', '#22c55e', '#f59e0b', '#06b6d4'][i % 5] }} />
            ))}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-success"><Lock size={11} /> Encrypted at rest</div>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-12 shrink-0 flex items-center gap-1 px-2 border-b border-line">
          <IconButton icon={ChevronLeft} label="Back" disabled={!back.length} onClick={goBack} />
          <IconButton icon={ChevronRight} label="Forward" disabled={!fwd.length} onClick={goFwd} />
          <IconButton icon={ChevronUp} label="Enclosing folder" disabled={path === '/' || starredView} onClick={() => navigate(dirname(path))} />
          <div className="flex-1 flex items-center gap-0.5 min-w-0 overflow-hidden px-1">
            {starredView ? <span className="font-semibold text-[13px] px-1.5">Starred</span> : crumbs.map((c, i) => {
              const p = '/' + crumbs.slice(0, i + 1).join('/');
              return (
                <span key={p} className="flex items-center gap-0.5 shrink-0 last:shrink">
                  {i > 0 && <ChevronRight size={13} className="text-faint" />}
                  <button
                    onClick={() => navigate(p)}
                    {...dropProps(p)}
                    className={cx('px-1.5 py-1 rounded-md text-[13px] hover:bg-hover truncate max-w-[160px]', i === crumbs.length - 1 ? 'font-semibold' : 'text-muted', dropTarget === p && 'bg-accent/20 ring-1 ring-accent')}
                  >
                    {p === HOME ? 'Home' : p === TRASH ? 'Trash' : c}
                  </button>
                </span>
              );
            })}
          </div>
          <div className="w-[200px]"><Input icon={Search} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${path === HOME ? 'Home' : basename(path)}`} className="h-7" /></div>
          <IconButton icon={ArrowUpDown} label="Sort" onClick={(e) => openMenuAt(e.currentTarget, ([['name', 'Name'], ['modified', 'Date modified'], ['size', 'Size'], ['kind', 'Kind']] as [SortKey, string][]).map(([k, l]) => ({ label: l, checked: sort.key === k, onClick: () => setSort((s) => ({ key: k, dir: s.key === k ? (s.dir === 1 ? -1 : 1) : k === 'name' ? 1 : -1 })) })), 'right')} />
          <Segmented size="sm" value={view} onChange={setView} options={[{ value: 'grid', label: '', icon: LayoutGrid }, { value: 'list', label: '', icon: List }]} />
          {!inTrash && <IconButton icon={FolderPlus} label="New folder" onClick={newFolder} />}
          {!inTrash && <IconButton icon={Upload} label="Import from computer" onClick={importFiles} />}
          <IconButton icon={PanelRight} label="Preview pane" active={preview} onClick={() => setPreview(!preview)} />
        </div>

        {inTrash && items.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-2 bg-hover border-b border-line text-[12.5px]">
            <Trash2 size={14} className="text-muted" />
            <span className="flex-1 text-muted">Items in Trash are still encrypted. Emptying the Trash erases their encrypted data.</span>
            <Button size="sm" variant="danger" onClick={emptyTrash}>Empty Trash</Button>
          </div>
        )}

        <div className="flex-1 flex min-h-0">
          <div
            ref={listRef}
            className={cx('flex-1 overflow-y-auto relative outline-none', hostDrop && 'ring-2 ring-inset ring-accent bg-accent/5')}
            onClick={(e) => { if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.bg) setSelected([]); }}
            onContextMenu={(e) => { if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.bg) bgMenu(e); }}
            onDragOver={(e) => { if (!inTrash && !starredView) { e.preventDefault(); if (!e.dataTransfer.types.includes(DRAG_MIME)) setHostDrop(true); } }}
            onDragLeave={(e) => { if (e.target === e.currentTarget) setHostDrop(false); }}
            onDrop={(e) => { if (!inTrash && !starredView) void dropProps(path).onDrop(e); }}
          >
            {items.length === 0 ? (
              <div data-bg="1" className="h-full">
                {query ? <Empty icon={Search} title="No matches" body={`Nothing named “${query}” here.`} />
                  : inTrash ? <Empty icon={Trash2} title="Trash is empty" body="Deleted items appear here until you empty the Trash." />
                  : starredView ? <Empty icon={Star} title="No starred items" body="Right-click a file or folder and choose “Add to Starred”." />
                  : <Empty icon={Upload} title="This folder is empty" body="Drop files here to import them. They're encrypted on the way in." action={<Button icon={Upload} onClick={importFiles}>Import files</Button>} />}
              </div>
            ) : view === 'grid' ? (
              <div data-bg="1" className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-1 p-3 content-start">
                {items.map((n) => {
                  const sel = selected.includes(n.path);
                  const cut = clipboard?.mode === 'cut' && clipboard.paths.includes(n.path);
                  return (
                    <button
                      key={n.path}
                      data-path={n.path}
                      {...dragProps(n)}
                      onClick={(e) => select(n, e)}
                      onDoubleClick={() => open(n)}
                      onContextMenu={(e) => itemMenu(e, n)}
                      className={cx('flex flex-col items-center gap-1.5 p-2 rounded-xl transition-colors outline-none', sel ? 'bg-accent/15' : 'hover:bg-hover', dropTarget === n.path && 'ring-2 ring-accent bg-accent/10', cut && 'opacity-45')}
                    >
                      <FileIcon node={n} size={54} />
                      <span className={cx('text-[12px] leading-tight text-center line-clamp-2 break-all px-1 rounded', sel && 'bg-accent text-accent-fg')}>{n.name}</span>
                      {query && <span className="text-[10.5px] text-faint truncate max-w-full -mt-1">{prettyPath(dirname(n.path))}</span>}
                    </button>
                  );
                })}
              </div>
            ) : (
              <table className="w-full text-[12.5px]">
                <thead className="sticky top-0 glass z-10">
                  <tr className="text-left text-faint text-[11.5px]">
                    {([['name', 'Name', ''], ['modified', 'Modified', 'w-44'], ['size', 'Size', 'w-24'], ['kind', 'Kind', 'w-28']] as [SortKey, string, string][]).map(([k, l, w]) => (
                      <th key={k} className={cx('font-medium px-3 h-8 border-b border-line cursor-pointer hover:text-fg', w)} onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? (s.dir === 1 ? -1 : 1) : 1 }))}>
                        {l} {sort.key === k && (sort.dir === 1 ? '↑' : '↓')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((n, i) => {
                    const sel = selected.includes(n.path);
                    return (
                      <tr
                        key={n.path}
                        data-path={n.path}
                        {...dragProps(n)}
                        onClick={(e) => select(n, e)}
                        onDoubleClick={() => open(n)}
                        onContextMenu={(e) => itemMenu(e, n)}
                        className={cx('h-8 cursor-default', sel ? 'bg-accent text-accent-fg' : i % 2 ? 'bg-hover/50' : '', dropTarget === n.path && 'outline-2 outline-accent')}
                      >
                        <td className="px-3"><div className="flex items-center gap-2.5 min-w-0"><FileIcon node={n} size={20} /><span className="truncate">{n.name}</span></div></td>
                        <td className={cx('px-3', !sel && 'text-muted')}>{formatDate(n.modified)}</td>
                        <td className={cx('px-3 tabular-nums', !sel && 'text-muted')}>{n.kind === 'dir' ? `${vfs.list(n.path, nodes).length} items` : formatBytes(n.size)}</td>
                        <td className={cx('px-3 capitalize', !sel && 'text-muted')}>{kindOf(n.path, n.kind === 'dir')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          {preview && <PreviewPane nodes={selNodes} dir={nodes[path]} onClose={() => setPreview(false)} />}
        </div>

        <div className="h-7 shrink-0 border-t border-line flex items-center px-3 text-[11.5px] text-muted gap-3">
          <span>{items.length} item{items.length === 1 ? '' : 's'}</span>
          {selected.length > 0 && <span>· {selected.length} selected{selSize ? ` · ${formatBytes(selSize)}` : ''}</span>}
          <span className="flex-1" />
          <span className="truncate">{starredView ? 'Starred' : prettyPath(path)}</span>
        </div>
      </div>
    </div>
  );

  function dropTargets(dir: string) {
    const p = dropProps(dir);
    return { onDrop: p.onDrop as (e: React.DragEvent) => void, onDragOver: (_e: React.DragEvent) => {} };
  }
}

function PreviewPane({ nodes, dir, onClose }: { nodes: FsNode[]; dir?: FsNode; onClose: () => void }) {
  const n = nodes.length === 1 ? nodes[0] : null;
  const kind = n ? kindOf(n.path, n.kind === 'dir') : null;
  const [text, setText] = useState<string | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const url = useObjectUrl(n && (kind === 'image' || kind === 'audio' || kind === 'video') && n.size < 50_000_000 ? () => vfs.objectUrl(n.path) : null, [n?.path, n?.modified]);
  const target0 = n ?? (nodes.length === 0 ? dir : null);
  const childCount = useVfs((s) => (target0?.kind === 'dir' ? vfs.list(target0.path, s.nodes).length : 0));

  useEffect(() => {
    setText(null);
    setHash(null);
    if (n && n.kind === 'file' && isTextMime(n.mime) && n.size < 200_000 && kind !== 'image') {
      vfs.readText(n.path).then((t) => setText(t.slice(0, 2000))).catch(() => {});
    }
  }, [n?.path, n?.modified]); // eslint-disable-line react-hooks/exhaustive-deps

  const target = n ?? (nodes.length === 0 ? dir : null);

  return (
    <div className="w-[260px] shrink-0 border-l border-line flex flex-col overflow-y-auto">
      <div className="flex items-center justify-between px-3 h-9 border-b border-line">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">Info</span>
        <IconButton icon={X} size={13} className="w-6 h-6" onClick={onClose} />
      </div>
      {nodes.length > 1 ? (
        <div className="p-6 text-center">
          <div className="text-[28px] font-semibold">{nodes.length}</div>
          <div className="text-[12.5px] text-muted">items selected · {formatBytes(nodes.reduce((a, x) => a + x.size, 0))}</div>
        </div>
      ) : target ? (
        <div className="p-4 space-y-4">
          <div className="flex justify-center rounded-xl bg-hover border border-line min-h-[140px] items-center overflow-hidden">
            {url && kind === 'image' ? <img src={url} className="max-h-[200px] max-w-full object-contain" alt="" />
              : url && kind === 'video' ? <video src={url} controls className="max-h-[200px] w-full" />
              : url && kind === 'audio' ? <div className="p-3 w-full"><FileIcon node={target} size={64} /><audio src={url} controls className="w-full mt-3" /></div>
              : text != null ? <pre className="text-[10.5px] font-mono p-3 w-full max-h-[200px] overflow-hidden text-muted whitespace-pre-wrap break-all selectable">{text || '(empty file)'}</pre>
              : <div className="py-6"><FileIcon node={target} size={72} /></div>}
          </div>
          <div>
            <div className="font-semibold text-[13.5px] break-all">{target.path === HOME ? 'Home' : target.name}</div>
            <div className="text-[12px] text-muted capitalize">{kindOf(target.path, target.kind === 'dir')}{target.kind === 'file' ? ` · ${formatBytes(target.size)}` : ` · ${childCount} items`}</div>
          </div>
          <dl className="text-[12px] space-y-2">
            {[['Where', prettyPath(dirname(target.path))], ['Created', formatDate(target.created)], ['Modified', formatDate(target.modified)], ...(target.kind === 'file' ? [['Type', target.mime ?? '—']] : []), ['Storage', 'AES-256-GCM encrypted']].map(([k, v]) => (
              <div key={k} className="flex gap-2"><dt className="text-faint w-16 shrink-0">{k}</dt><dd className="text-fg break-all selectable">{v}</dd></div>
            ))}
            {target.trashedFrom && <div className="flex gap-2"><dt className="text-faint w-16 shrink-0">From</dt><dd className="break-all">{prettyPath(target.trashedFrom)}</dd></div>}
          </dl>
          {target.kind === 'file' && (
            <div>
              {hash ? (
                <div className="text-[10.5px] font-mono break-all text-muted bg-hover rounded-lg p-2 border border-line selectable"><span className="text-faint">SHA-256</span><br />{hash}</div>
              ) : (
                <Button size="sm" icon={Hash} onClick={async () => setHash(await sha256(await vfs.readBytes(target.path)))}>Compute checksum</Button>
              )}
            </div>
          )}
          {target.kind === 'file' && (
            <div className="flex gap-1.5">
              <Button size="sm" variant="primary" icon={ExternalLink} onClick={() => void openPath(target.path)}>Open</Button>
              <Button size="sm" icon={Download} onClick={() => void exportToHost(target.path)}>Export</Button>
            </div>
          )}
        </div>
      ) : null}
      {nodes.length === 0 && !target && <div className="p-6 text-center text-[12px] text-faint"><Check size={16} className="mx-auto mb-2" />Select an item to see details</div>}
    </div>
  );
}
