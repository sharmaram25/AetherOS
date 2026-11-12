import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Calculator, FileText, Folder, CornerDownLeft, TextSearch, Copy, Sparkles } from 'lucide-react';
import { allApps } from '../kernel/registry';
import { vfs, useVfs, type FsNode } from '../kernel/vfs';
import { wm } from '../kernel/windows';
import { openPath } from '../kernel/launcher';
import { copyText } from '../kernel/privacy';
import { toast } from '../kernel/notify';
import { tryEvaluate, formatNumber, fuzzy } from '../lib/calc';
import { prettyPath, dirname } from '../lib/path';
import { kindOf } from '../lib/mime';
import { getCommands } from './commands';
import { shell, useShell } from './store';
import { AppGlyph, Kbd, cx } from '../ui';

interface Result {
  id: string;
  group: string;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  run: () => void;
  score: number;
}

const ICON_BOX = 'w-8 h-8 rounded-lg flex items-center justify-center shrink-0';

export function Spotlight() {
  const initial = useShell((s) => s.spotlightQuery);
  const [q, setQ] = useState(initial);
  const [sel, setSel] = useState(0);
  const [grep, setGrep] = useState<{ node: FsNode; line: string; lineNo: number }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const nodes = useVfs((s) => s.nodes);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Debounced full-text search over decrypted text files.
  useEffect(() => {
    setGrep([]);
    const query = q.trim();
    if (query.length < 3 || query.startsWith('>') || query.startsWith('=')) return;
    const t = setTimeout(() => { void vfs.grep(query, '/home', 8).then(setGrep); }, 220);
    return () => clearTimeout(t);
  }, [q]);

  const results = useMemo<Result[]>(() => {
    const query = q.trim();
    const out: Result[] = [];
    const cmdOnly = query.startsWith('>');
    const qq = cmdOnly ? query.slice(1).trim() : query.startsWith('=') ? query.slice(1) : query;

    const calc = tryEvaluate(qq);
    if (calc !== null && !cmdOnly) {
      const text = formatNumber(calc);
      out.push({
        id: 'calc', group: 'Calculator', title: text, subtitle: `${qq} — press Enter to copy`, score: 2000,
        icon: <div className={cx(ICON_BOX, 'bg-gradient-to-br from-orange-500 to-amber-500 text-white')}><Calculator size={16} /></div>,
        run: () => { void copyText(String(calc)); toast(`Copied ${text}`, 'success'); },
      });
    }

    if (!cmdOnly) {
      for (const app of allApps()) {
        const s = Math.max(fuzzy(qq, app.name), ...(app.keywords ?? []).map((k) => fuzzy(qq, k) - 120));
        if (!qq || s > 0) out.push({ id: 'app:' + app.id, group: 'Applications', title: app.name, subtitle: app.description, score: (qq ? s : 0) + 300, icon: <AppGlyph app={app} size={32} />, run: () => { wm.open(app.id); } });
      }
    }

    for (const c of getCommands()) {
      const s = Math.max(fuzzy(qq, c.title), c.keywords ? fuzzy(qq, c.keywords) - 150 : -1);
      if ((cmdOnly && !qq) || (qq && s > 0)) {
        out.push({ id: 'cmd:' + c.id, group: 'Commands', title: c.title, subtitle: c.subtitle ?? c.shortcut, score: s + (cmdOnly ? 500 : 100), icon: <div className={cx(ICON_BOX, 'bg-hover border border-line text-fg')}><c.icon size={15} /></div>, run: () => void c.run() });
      }
    }

    if (qq && !cmdOnly) {
      for (const n of vfs.search(qq, 12)) {
        out.push({
          id: 'file:' + n.path, group: 'Files', title: n.name, subtitle: prettyPath(dirname(n.path)), score: fuzzy(qq, n.name) * 0.5 + 50,
          icon: <div className={cx(ICON_BOX, n.kind === 'dir' ? 'bg-sky-500/15 text-sky-500' : 'bg-hover text-muted')}>{n.kind === 'dir' ? <Folder size={16} /> : <FileText size={16} />}</div>,
          run: () => void openPath(n.path),
        });
      }
      for (const g of grep) {
        if (out.some((o) => o.id === 'file:' + g.node.path)) continue;
        out.push({
          id: 'grep:' + g.node.path, group: 'Inside files', title: g.node.name, subtitle: `${g.lineNo}: ${g.line}`, score: 20,
          icon: <div className={cx(ICON_BOX, 'bg-violet-500/15 text-violet-500')}><TextSearch size={16} /></div>,
          run: () => void openPath(g.node.path),
        });
      }
      if (qq.length > 3 && qq.includes(' ') && calc === null) {
        out.push({
          id: 'ask', group: 'Assistant', title: `Ask Cortex: “${qq}”`, subtitle: 'Answered on-device, privately', score: 1,
          icon: <div className={cx(ICON_BOX, 'bg-gradient-to-br from-violet-500 to-cyan-500 text-white')}><Sparkles size={15} /></div>,
          run: () => { wm.open('cortex', { prompt: qq }); },
        });
      }
    }

    // Keep group order stable by best score, items sorted within group.
    const groups = new Map<string, Result[]>();
    out.sort((a, b) => b.score - a.score).forEach((r) => {
      if (!groups.has(r.group)) groups.set(r.group, []);
      groups.get(r.group)!.push(r);
    });
    const limits: Record<string, number> = { Applications: qq ? 5 : 12, Commands: cmdOnly ? 30 : 4, Files: 6, 'Inside files': 5 };
    return [...groups.entries()].flatMap(([g, list]) => list.slice(0, limits[g] ?? 3));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, grep, nodes]);

  useEffect(() => setSel(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${sel}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  const run = (r?: Result) => {
    if (!r) return;
    shell.close();
    r.run();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(results.length - 1, s + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); run(results[sel]); }
    else if (e.key === 'Escape') { e.preventDefault(); shell.close(); }
  };

  let lastGroup = '';
  const current = results[sel];

  return (
    <div className="fixed inset-0 z-[70] flex justify-center pt-[14vh]" onMouseDown={(e) => e.target === e.currentTarget && shell.close()}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.16, ease: [0.2, 0.8, 0.2, 1] }}
        className="w-[640px] max-w-[92vw] h-fit max-h-[62vh] flex flex-col glass rounded-2xl border border-line-strong shadow-[0_30px_90px_-10px_rgba(0,0,0,0.6)] overflow-hidden"
      >
        <div className="flex items-center gap-3 px-4 h-14 border-b border-line">
          <Search size={19} className="text-muted shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search apps, files, commands — or type math"
            className="flex-1 bg-transparent outline-none text-[17px] placeholder:text-faint"
            spellCheck={false}
          />
          <Kbd>esc</Kbd>
        </div>
        <div ref={listRef} className="overflow-y-auto p-2">
          {results.length === 0 && <div className="py-10 text-center text-muted text-[13px]">No results for “{q}”</div>}
          {results.map((r, i) => {
            const header = r.group !== lastGroup ? r.group : null;
            lastGroup = r.group;
            return (
              <div key={r.id}>
                {header && <div className="px-2.5 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-faint">{header}</div>}
                <button
                  data-idx={i}
                  onMouseMove={() => sel !== i && setSel(i)}
                  onClick={() => run(r)}
                  className={cx('w-full flex items-center gap-3 px-2.5 py-1.5 rounded-xl text-left transition-colors', i === sel ? 'bg-accent/15' : 'hover:bg-hover')}
                >
                  {r.icon}
                  <div className="flex-1 min-w-0">
                    <div className={cx('truncate text-[13.5px]', r.id === 'calc' ? 'text-[20px] font-semibold tabular-nums' : 'font-medium')}>{r.title}</div>
                    {r.subtitle && <div className="truncate text-[12px] text-muted">{r.subtitle}</div>}
                  </div>
                  {i === sel && <CornerDownLeft size={14} className="text-muted shrink-0" />}
                </button>
              </div>
            );
          })}
        </div>
        <div className="h-9 shrink-0 border-t border-line flex items-center gap-4 px-4 text-[11px] text-faint">
          <span className="flex items-center gap-1.5"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
          <span className="flex items-center gap-1.5"><Kbd>↵</Kbd> open</span>
          <span className="flex items-center gap-1.5"><Kbd>&gt;</Kbd> commands</span>
          <span className="flex-1" />
          {current?.id.startsWith('file:') && (
            <span className="flex items-center gap-1 truncate"><Copy size={11} /> {kindOf(current.id.slice(5))}</span>
          )}
          <span>Searched locally · nothing leaves this device</span>
        </div>
      </motion.div>
    </div>
  );
}
