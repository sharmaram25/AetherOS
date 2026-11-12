import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, Search, Pin, PinOff, Trash2, Bold, Italic, Heading1, Heading2, List, ListChecks, Code, Link2, Quote, Columns2, Eye,
  PenLine, Download, FolderPlus, Notebook, NotebookText, MoreHorizontal, Table, Minus, Copy, FileText,
} from 'lucide-react';
import type { AppProps } from '../kernel/registry';
import { useVfs, vfs, type FsNode } from '../kernel/vfs';
import { wm } from '../kernel/windows';
import { dialog } from '../kernel/dialog';
import { toast } from '../kernel/notify';
import { useAppData } from '../kernel/appdata';
import { onBeforeLock } from '../kernel/session';
import { downloadBlob } from '../kernel/launcher';
import { HOME, basename, dirname, join, stem, validName, isInside, prettyPath } from '../lib/path';
import { renderMarkdown, toggleTask, plainSnippet } from '../lib/markdown';
import { formatDate } from '../lib/format';
import { Button, IconButton, Input, SidebarItem, SectionLabel, Empty, Segmented, cx, openMenu, openMenuAt } from '../ui';
import { useLinkGuard } from './shared';

const ROOT = `${HOME}/Notes`;
type Mode = 'edit' | 'split' | 'preview';

export default function Notes({ win }: AppProps) {
  const nodes = useVfs((s) => s.nodes);
  const [meta, setMeta] = useAppData<{ pinned: string[]; mode: Mode }>('notes', { pinned: [], mode: 'split' });
  const [folder, setFolder] = useState<string>(ROOT);
  const [current, setCurrent] = useState<string | null>(null);
  const [extra, setExtra] = useState<string | null>(null); // note opened from outside ~/Notes
  const [query, setQuery] = useState('');
  const [snippets, setSnippets] = useState<Record<string, { title: string; snip: string; m: number }>>({});
  const [text, setText] = useState('');
  const [dirty, setDirty] = useState(false);
  const loadedRef = useRef<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mode = meta.mode;
  const linkGuard = useLinkGuard();

  const notebooks = useMemo(() => vfs.list(ROOT, nodes).filter((n) => n.kind === 'dir'), [nodes]);
  const allNotes = useMemo(() => vfs.walk(ROOT, nodes).filter((n) => n.kind === 'file' && /\.(md|markdown|txt)$/i.test(n.name)), [nodes]);

  // Open requested path
  useEffect(() => {
    const p = win.data?.path as string | undefined;
    if (p && vfs.exists(p)) {
      if (!isInside(p, ROOT)) setExtra(p);
      else setFolder(dirname(p) === ROOT ? ROOT : dirname(p));
      void select(p);
    } else if (!current && allNotes.length) {
      void select([...allNotes].sort((a, b) => b.modified - a.modified)[0].path);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win.data?._n]);

  // Build snippets (decrypting lazily, cached by modified time)
  useEffect(() => {
    let alive = true;
    (async () => {
      const next: typeof snippets = {};
      for (const n of allNotes) {
        const c = snippets[n.path];
        if (c && c.m === n.modified) { next[n.path] = c; continue; }
        try {
          const t = await vfs.readText(n.path);
          next[n.path] = { title: stem(n.name), snip: plainSnippet(t), m: n.modified };
        } catch { /* ignore */ }
      }
      if (alive) setSnippets(next);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allNotes]);

  const save = useCallback(async () => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    const p = loadedRef.current;
    if (!p || !dirtyRef.current) return;
    dirtyRef.current = false;
    setDirty(false);
    await vfs.writeText(p, textRef.current, 'text/markdown');
  }, []);
  const textRef = useRef(text);
  const dirtyRef = useRef(false);
  textRef.current = text;

  useEffect(() => onBeforeLock(save), [save]);
  useEffect(() => () => { void save(); }, [save]);

  const select = async (p: string) => {
    await save();
    try {
      const t = await vfs.readText(p);
      loadedRef.current = p;
      setCurrent(p);
      setText(t);
      setDirty(false);
      wm.setTitle(win.id, `${stem(p)} — Notes`);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const update = (t: string) => {
    setText(t);
    dirtyRef.current = true;
    setDirty(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void save(), 600);
  };

  const create = async () => {
    const dir = folder === ':pinned' ? ROOT : folder;
    const p = vfs.uniquePath(dir, 'Untitled.md');
    await vfs.writeText(p, '# Untitled\n\n', 'text/markdown');
    await select(p);
    setTimeout(() => { taRef.current?.focus(); taRef.current?.setSelectionRange(2, 10); }, 50);
  };

  const remove = async (p: string) => {
    await vfs.trash([p]);
    setMeta((m) => ({ ...m, pinned: m.pinned.filter((x) => x !== p) }));
    if (p === current) { loadedRef.current = null; setCurrent(null); setText(''); }
    toast('Note moved to Trash');
  };

  const rename = async (p: string) => {
    const name = await dialog.prompt({ title: 'Rename note', value: stem(p), confirmLabel: 'Rename', validate: (v) => validName(v) ?? (v !== stem(p) && vfs.exists(join(dirname(p), v + '.md')) ? 'A note with that name exists' : null) });
    if (!name) return;
    await save();
    const np = await vfs.rename(p, name.endsWith('.md') ? name : name + '.md');
    setMeta((m) => ({ ...m, pinned: m.pinned.map((x) => (x === p ? np : x)) }));
    if (p === current) { loadedRef.current = np; setCurrent(np); wm.setTitle(win.id, `${stem(np)} — Notes`); }
  };

  const togglePin = (p: string) => setMeta((m) => ({ ...m, pinned: m.pinned.includes(p) ? m.pinned.filter((x) => x !== p) : [p, ...m.pinned] }));

  const newNotebook = async () => {
    const name = await dialog.prompt({ title: 'New notebook', placeholder: 'e.g. Work, Journal, Recipes', confirmLabel: 'Create', validate: (v) => validName(v) ?? (vfs.exists(join(ROOT, v)) ? 'Already exists' : null) });
    if (!name) return;
    await vfs.mkdir(join(ROOT, name));
    setFolder(join(ROOT, name));
  };

  const list = useMemo(() => {
    let l = folder === ':pinned' ? allNotes.filter((n) => meta.pinned.includes(n.path))
      : folder === ROOT ? allNotes : allNotes.filter((n) => dirname(n.path) === folder);
    if (query.trim()) {
      const q = query.toLowerCase();
      l = l.filter((n) => n.name.toLowerCase().includes(q) || snippets[n.path]?.snip.toLowerCase().includes(q));
    }
    return [...l].sort((a, b) => Number(meta.pinned.includes(b.path)) - Number(meta.pinned.includes(a.path)) || b.modified - a.modified);
  }, [allNotes, folder, query, snippets, meta.pinned]);

  /* ---------- formatting ---------- */
  const wrap = (before: string, after = before, placeholder = 'text') => {
    const ta = taRef.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e } = ta;
    const sel = text.slice(s, e) || placeholder;
    const next = text.slice(0, s) + before + sel + after + text.slice(e);
    update(next);
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(s + before.length, s + before.length + sel.length); });
  };
  const linePrefix = (prefix: string) => {
    const ta = taRef.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const lineStart = text.lastIndexOf('\n', s - 1) + 1;
    const next = text.slice(0, lineStart) + prefix + text.slice(lineStart);
    update(next);
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(s + prefix.length, s + prefix.length); });
  };
  const insert = (snippet: string) => {
    const ta = taRef.current;
    if (!ta) return;
    const s = ta.selectionStart;
    update(text.slice(0, s) + snippet + text.slice(ta.selectionEnd));
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(s + snippet.length, s + snippet.length); });
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key === 'b') { e.preventDefault(); wrap('**'); }
    else if (mod && e.key === 'i') { e.preventDefault(); wrap('*'); }
    else if (mod && e.key === 's') { e.preventDefault(); void save().then(() => toast('Saved', 'success')); }
    else if (mod && e.key === 'k') { e.preventDefault(); wrap('[', '](https://)', 'link'); }
    else if (e.key === 'Tab') { e.preventDefault(); insert('  '); }
    else if (e.key === 'Enter') {
      // Continue lists
      const ta = e.currentTarget;
      const s = ta.selectionStart;
      const lineStart = text.lastIndexOf('\n', s - 1) + 1;
      const line = text.slice(lineStart, s);
      const m = /^(\s*)([-*+] \[[ xX]\] |[-*+] |(\d+)\. )/.exec(line);
      if (m) {
        e.preventDefault();
        if (line.trim() === m[2].trim()) { update(text.slice(0, lineStart) + text.slice(s)); return; }
        const bullet = m[3] ? `${Number(m[3]) + 1}. ` : m[2].replace(/\[[xX]\]/, '[ ]');
        insert('\n' + m[1] + bullet);
      }
    }
  };

  const html = useMemo(() => (mode !== 'edit' ? renderMarkdown(text) : ''), [text, mode]);
  const words = useMemo(() => (text.trim() ? text.trim().split(/\s+/).length : 0), [text]);

  const onPreviewClick = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t.tagName === 'INPUT' && (t as HTMLInputElement).type === 'checkbox') {
      const boxes = [...(previewRef.current?.querySelectorAll('input[type=checkbox]') ?? [])];
      const idx = boxes.indexOf(t as HTMLInputElement);
      if (idx >= 0) update(toggleTask(text, idx));
      return;
    }
    linkGuard(e);
  };

  const noteMenu = (e: React.MouseEvent, n: FsNode) => openMenu(e, [
    { label: meta.pinned.includes(n.path) ? 'Unpin' : 'Pin to top', icon: meta.pinned.includes(n.path) ? PinOff : Pin, onClick: () => togglePin(n.path) },
    { label: 'Rename…', onClick: () => rename(n.path) },
    { label: 'Move to notebook', submenu: [{ label: 'Notes (root)', onClick: () => void vfs.move(n.path, vfs.uniquePath(ROOT, n.name)) }, ...notebooks.map((nb) => ({ label: nb.name, onClick: () => void vfs.move(n.path, vfs.uniquePath(nb.path, n.name)) }))] },
    { label: 'Open in Code', onClick: () => { wm.open('code', { path: n.path }); } },
    { separator: true },
    { label: 'Move to Trash', icon: Trash2, danger: true, onClick: () => remove(n.path) },
  ]);

  return (
    <div className="h-full flex">
      {/* Notebooks */}
      <div className="w-[180px] shrink-0 border-r border-line bg-hover/40 flex flex-col">
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          <SectionLabel>Library</SectionLabel>
          <SidebarItem icon={NotebookText} label="All notes" count={allNotes.length} active={folder === ROOT} onClick={() => setFolder(ROOT)} />
          <SidebarItem icon={Pin} label="Pinned" count={meta.pinned.filter((p) => vfs.exists(p)).length} active={folder === ':pinned'} onClick={() => setFolder(':pinned')} />
          <SectionLabel action={<IconButton icon={FolderPlus} size={13} className="w-6 h-6" label="New notebook" onClick={newNotebook} />}>Notebooks</SectionLabel>
          {notebooks.length === 0 && <div className="px-2.5 text-[11.5px] text-faint">No notebooks yet</div>}
          {notebooks.map((nb) => (
            <SidebarItem key={nb.path} icon={Notebook} label={nb.name} count={allNotes.filter((n) => dirname(n.path) === nb.path).length} active={folder === nb.path} onClick={() => setFolder(nb.path)}
              onContextMenu={(e) => openMenu(e, [{ label: 'Delete notebook', danger: true, icon: Trash2, onClick: async () => { if (await dialog.confirm({ title: `Delete “${nb.name}”?`, message: 'Its notes will be moved to the Trash.', danger: true, confirmLabel: 'Delete' })) { await vfs.trash([nb.path]); setFolder(ROOT); } } }])} />
          ))}
          {extra && (<><SectionLabel>Opened file</SectionLabel><SidebarItem icon={FileText} label={basename(extra)} active={current === extra} onClick={() => select(extra)} /></>)}
        </div>
      </div>

      {/* List */}
      <div className="w-[260px] shrink-0 border-r border-line flex flex-col">
        <div className="h-12 flex items-center gap-1.5 px-2.5 border-b border-line">
          <Input icon={Search} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes" className="h-7" />
          <IconButton icon={Plus} label="New note" onClick={create} />
        </div>
        <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
          {list.length === 0 && <div className="text-center text-[12px] text-faint py-10">{query ? 'No matching notes' : 'No notes here yet'}</div>}
          {list.map((n) => {
            const s = snippets[n.path];
            const active = n.path === current;
            return (
              <button key={n.path} onClick={() => select(n.path)} onContextMenu={(e) => noteMenu(e, n)}
                className={cx('w-full text-left rounded-xl px-3 py-2.5 transition-colors', active ? 'bg-accent/15' : 'hover:bg-hover')}>
                <div className="flex items-center gap-1.5">
                  {meta.pinned.includes(n.path) && <Pin size={11} className="text-accent shrink-0" />}
                  <span className="font-semibold text-[13px] truncate">{s?.title ?? stem(n.name)}</span>
                </div>
                <div className="text-[11.5px] text-muted line-clamp-2 mt-0.5 min-h-[2.4em]">{s?.snip || 'No additional text'}</div>
                <div className="text-[10.5px] text-faint mt-1">{formatDate(n.modified)}{folder === ROOT && dirname(n.path) !== ROOT ? ` · ${basename(dirname(n.path))}` : ''}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col min-w-0">
        {current ? (
          <>
            <div className="h-12 shrink-0 flex items-center gap-0.5 px-2 border-b border-line">
              {mode !== 'preview' && (
                <>
                  <IconButton icon={Heading1} label="Heading" onClick={() => linePrefix('# ')} />
                  <IconButton icon={Heading2} label="Subheading" onClick={() => linePrefix('## ')} />
                  <IconButton icon={Bold} label="Bold (Ctrl B)" onClick={() => wrap('**')} />
                  <IconButton icon={Italic} label="Italic (Ctrl I)" onClick={() => wrap('*')} />
                  <IconButton icon={List} label="Bullet list" onClick={() => linePrefix('- ')} />
                  <IconButton icon={ListChecks} label="Checklist" onClick={() => linePrefix('- [ ] ')} />
                  <IconButton icon={Quote} label="Quote" onClick={() => linePrefix('> ')} />
                  <IconButton icon={Code} label="Code" onClick={() => wrap('`')} />
                  <IconButton icon={Link2} label="Link (Ctrl K)" onClick={() => wrap('[', '](https://)', 'link')} />
                  <IconButton icon={Table} label="Table" onClick={() => insert('\n| Column | Column |\n|---|---|\n| Cell | Cell |\n')} />
                  <IconButton icon={Minus} label="Divider" onClick={() => insert('\n---\n')} />
                </>
              )}
              <div className="flex-1" />
              <span className="text-[11px] text-faint mr-2">{dirty ? 'Saving…' : 'Saved · encrypted'}</span>
              <Segmented size="sm" value={mode} onChange={(m) => setMeta((x) => ({ ...x, mode: m }))} options={[{ value: 'edit', label: '', icon: PenLine }, { value: 'split', label: '', icon: Columns2 }, { value: 'preview', label: '', icon: Eye }]} />
              <IconButton icon={MoreHorizontal} label="More" onClick={(e) => openMenuAt(e.currentTarget, [
                { label: meta.pinned.includes(current) ? 'Unpin' : 'Pin', icon: Pin, onClick: () => togglePin(current) },
                { label: 'Rename…', onClick: () => rename(current) },
                { label: 'Copy as Markdown', icon: Copy, onClick: () => { void navigator.clipboard.writeText(text); toast('Copied'); } },
                { label: 'Export .md', icon: Download, onClick: () => downloadBlob(new Blob([text], { type: 'text/markdown' }), basename(current)) },
                { label: 'Export .html', icon: Download, onClick: () => downloadBlob(new Blob([`<!doctype html><meta charset="utf-8"><title>${stem(current)}</title><body style="font-family:system-ui;max-width:720px;margin:40px auto;line-height:1.6">${renderMarkdown(text)}</body>`], { type: 'text/html' }), stem(current) + '.html') },
                { separator: true },
                { label: 'Move to Trash', icon: Trash2, danger: true, onClick: () => remove(current) },
              ], 'right')} />
            </div>
            <div className="flex-1 flex min-h-0">
              {mode !== 'preview' && (
                <textarea
                  ref={taRef}
                  value={text}
                  onChange={(e) => update(e.target.value)}
                  onKeyDown={onKey}
                  spellCheck
                  className={cx('flex-1 min-w-0 resize-none bg-transparent outline-none p-6 font-mono text-[13.5px] leading-[1.75] text-fg', mode === 'split' && 'border-r border-line')}
                  placeholder="Start writing…"
                />
              )}
              {mode !== 'edit' && (
                <div ref={previewRef} onClick={onPreviewClick} className="flex-1 min-w-0 overflow-y-auto px-8 py-6 selectable">
                  <div className="prose-aether max-w-[720px] mx-auto" dangerouslySetInnerHTML={{ __html: html }} />
                </div>
              )}
            </div>
            <div className="h-7 shrink-0 border-t border-line flex items-center px-3 text-[11px] text-faint gap-3">
              <span>{words} words</span><span>{text.length} characters</span><span>{Math.max(1, Math.round(words / 230))} min read</span>
              <span className="flex-1" /><span className="truncate">{prettyPath(current)}</span>
            </div>
          </>
        ) : (
          <Empty icon={NotebookText} title="No note selected" body="Pick a note from the list, or start something new." action={<Button variant="primary" icon={Plus} onClick={create}>New note</Button>} />
        )}
      </div>
    </div>
  );
}
