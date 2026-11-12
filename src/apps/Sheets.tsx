import { useEffect, useMemo, useRef, useState } from 'react';
import { Save, FolderOpen, FilePlus, Bold, AlignLeft, AlignCenter, AlignRight, Sigma, Download, Undo2 } from 'lucide-react';
import type { AppProps } from '../kernel/registry';
import { vfs } from '../kernel/vfs';
import { wm, setCloseGuard, useWindows } from '../kernel/windows';
import { dialog } from '../kernel/dialog';
import { toast } from '../kernel/notify';
import { downloadBlob } from '../kernel/launcher';
import { HOME, basename, extname } from '../lib/path';
import { evaluate, formatNumber } from '../lib/calc';
import { parseCsv } from './Keychain';
import { IconButton, Button, cx } from '../ui';

const COLS = 26, ROWS = 200;
const colName = (c: number) => String.fromCharCode(65 + c);
const key = (r: number, c: number) => `${colName(c)}${r + 1}`;
const parseRef = (ref: string) => { const m = /^([A-Z])(\d+)$/.exec(ref.toUpperCase()); return m ? { c: m[1].charCodeAt(0) - 65, r: Number(m[2]) - 1 } : null; };

interface Style { b?: boolean; align?: 'left' | 'center' | 'right' }
interface Sheet { cells: Record<string, string>; styles: Record<string, Style>; widths: Record<number, number> }

function compute(cells: Record<string, string>) {
  const cache = new Map<string, number | string>();
  const visiting = new Set<string>();
  const val = (k: string): number | string => {
    if (cache.has(k)) return cache.get(k)!;
    const raw = cells[k] ?? '';
    let out: number | string;
    if (raw.startsWith('=')) {
      if (visiting.has(k)) return '#CYCLE';
      visiting.add(k);
      try {
        const n = evaluate(raw.slice(1), {
          resolve: (name) => { const r = parseRef(name); if (!r) return undefined; const v = val(name.toUpperCase()); return typeof v === 'number' ? v : v === '' ? 0 : NaN; },
          range: (a, b) => {
            const ra = parseRef(a), rb = parseRef(b);
            if (!ra || !rb) return [];
            const out2: number[] = [];
            for (let r = Math.min(ra.r, rb.r); r <= Math.max(ra.r, rb.r); r++) for (let c = Math.min(ra.c, rb.c); c <= Math.max(ra.c, rb.c); c++) { const v = val(key(r, c)); if (typeof v === 'number') out2.push(v); }
            return out2;
          },
        });
        out = Number.isFinite(n) ? n : '#NUM';
      } catch (e) { out = (e as Error).message.includes('Unknown') ? '#NAME?' : '#ERR'; }
      visiting.delete(k);
    } else if (raw.trim() !== '' && !isNaN(Number(raw.replace(/,/g, '')))) out = Number(raw.replace(/,/g, ''));
    else out = raw;
    cache.set(k, out);
    return out;
  };
  return val;
}

export default function Sheets({ win }: AppProps) {
  const [sheet, setSheet] = useState<Sheet>({ cells: {}, styles: {}, widths: {} });
  const [sel, setSel] = useState({ r: 0, c: 0 });
  const [anchor, setAnchor] = useState<{ r: number; c: number } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [path, setPath] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const history = useRef<Sheet[]>([]);
  const gridRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLInputElement>(null);
  const active = useWindows((s) => s.activeId === win.id);
  const val = useMemo(() => compute(sheet.cells), [sheet.cells]);
  const k = key(sel.r, sel.c);

  useEffect(() => { if (win.data?.path) void open(win.data.path); }, [win.data?._n]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { wm.setTitle(win.id, `${path ? basename(path) : 'Untitled'}${dirty ? ' •' : ''} — Sheets`); }, [path, dirty, win.id]);
  const dirtyRef = useRef(dirty); dirtyRef.current = dirty;
  useEffect(() => { setCloseGuard(win.id, async () => !dirtyRef.current || dialog.confirm({ title: 'Discard unsaved changes?', danger: true, confirmLabel: 'Discard' })); return () => setCloseGuard(win.id, null); }, [win.id]);

  async function open(p: string) {
    const text = await vfs.readText(p);
    if (extname(p) === 'sheet') setSheet({ widths: {}, styles: {}, ...JSON.parse(text) });
    else {
      const rows = extname(p) === 'tsv' ? text.split('\n').map((l) => l.split('\t')) : parseCsv(text);
      const cells: Record<string, string> = {};
      rows.forEach((row, r) => row.forEach((v, c) => { if (v !== '' && c < COLS && r < ROWS) cells[key(r, c)] = v; }));
      setSheet({ cells, styles: {}, widths: {} });
    }
    setPath(p); setDirty(false); history.current = [];
  }

  const change = (fn: (s: Sheet) => Sheet) => { history.current.push(sheet); if (history.current.length > 100) history.current.shift(); setSheet(fn); setDirty(true); };
  const setCell = (ck: string, v: string) => change((s) => { const cells = { ...s.cells }; if (v === '') delete cells[ck]; else cells[ck] = v; return { ...s, cells }; });

  const range = () => {
    const a = anchor ?? sel;
    return { r0: Math.min(a.r, sel.r), r1: Math.max(a.r, sel.r), c0: Math.min(a.c, sel.c), c1: Math.max(a.c, sel.c) };
  };
  const inRange = (r: number, c: number) => { const g = range(); return r >= g.r0 && r <= g.r1 && c >= g.c0 && c <= g.c1; };
  const styleRange = (p: Style) => change((s) => { const styles = { ...s.styles }; const g = range(); for (let r = g.r0; r <= g.r1; r++) for (let c = g.c0; c <= g.c1; c++) styles[key(r, c)] = { ...styles[key(r, c)], ...p }; return { ...s, styles }; });

  const toCsv = () => {
    let maxR = 0, maxC = 0;
    Object.keys(sheet.cells).forEach((ck) => { const p = parseRef(ck)!; maxR = Math.max(maxR, p.r); maxC = Math.max(maxC, p.c); });
    return Array.from({ length: maxR + 1 }, (_, r) => Array.from({ length: maxC + 1 }, (_, c) => { const v = sheet.cells[key(r, c)] ?? ''; return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; }).join(',')).join('\n');
  };

  const save = async (as = false) => {
    let target = path;
    if (!target || as) target = await dialog.save({ defaultName: 'Spreadsheet.csv', startDir: `${HOME}/Documents`, extensions: ['csv', 'sheet'] });
    if (!target) return;
    await vfs.writeText(target, extname(target) === 'sheet' ? JSON.stringify(sheet) : toCsv());
    setPath(target); setDirty(false);
    toast(`Saved ${basename(target)}${extname(target) === 'csv' && Object.keys(sheet.styles).length ? ' (formatting kept only in .sheet)' : ''}`, 'success');
  };

  const move = (dr: number, dc: number, extend = false) => {
    if (extend && !anchor) setAnchor(sel);
    if (!extend) setAnchor(null);
    setSel((s) => ({ r: Math.max(0, Math.min(ROWS - 1, s.r + dr)), c: Math.max(0, Math.min(COLS - 1, s.c + dc)) }));
  };

  useEffect(() => { gridRef.current?.querySelector(`[data-k="${k}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }, [k]);

  const commit = (v: string, dr = 1, dc = 0) => { setCell(k, v); setEditing(null); move(dr, dc); requestAnimationFrame(() => gridRef.current?.focus()); };

  const onKey = (e: React.KeyboardEvent) => {
    if (editing !== null) return;
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1, 0, e.shiftKey); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1, 0, e.shiftKey); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); move(0, -1, e.shiftKey); }
    else if (e.key === 'ArrowRight' || e.key === 'Tab') { e.preventDefault(); move(0, e.shiftKey && e.key === 'Tab' ? -1 : 1, e.shiftKey && e.key !== 'Tab'); }
    else if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); setEditing(sheet.cells[k] ?? ''); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { const g = range(); change((s) => { const cells = { ...s.cells }; for (let r = g.r0; r <= g.r1; r++) for (let c = g.c0; c <= g.c1; c++) delete cells[key(r, c)]; return { ...s, cells }; }); }
    else if (mod && e.key === 's') { e.preventDefault(); void save(); }
    else if (mod && e.key === 'z') { e.preventDefault(); const p = history.current.pop(); if (p) setSheet(p); }
    else if (mod && e.key === 'b') { e.preventDefault(); styleRange({ b: !sheet.styles[k]?.b }); }
    else if (mod && e.key === 'c') { e.preventDefault(); const g = range(); const t = Array.from({ length: g.r1 - g.r0 + 1 }, (_, i) => Array.from({ length: g.c1 - g.c0 + 1 }, (_, j) => { const v = val(key(g.r0 + i, g.c0 + j)); return typeof v === 'number' ? String(v) : v; }).join('\t')).join('\n'); void navigator.clipboard.writeText(t); toast('Copied'); }
    else if (mod && e.key === 'v') { e.preventDefault(); void navigator.clipboard.readText().then((t) => change((s) => { const cells = { ...s.cells }; t.replace(/\r/g, '').split('\n').forEach((line, i) => line.split('\t').forEach((v, j) => { if (sel.r + i < ROWS && sel.c + j < COLS) cells[key(sel.r + i, sel.c + j)] = v; })); return { ...s, cells }; })); }
    else if (e.key.length === 1 && !mod && !e.altKey) { setEditing(e.key); }
  };

  const display = (ck: string) => {
    const v = val(ck);
    if (typeof v === 'number') return formatNumber(v, 6);
    return v;
  };

  const g = range();
  const multi = g.r0 !== g.r1 || g.c0 !== g.c1;
  const nums: number[] = [];
  if (multi) for (let r = g.r0; r <= g.r1; r++) for (let c = g.c0; c <= g.c1; c++) { const v = val(key(r, c)); if (typeof v === 'number') nums.push(v); }

  return (
    <div className="h-full flex flex-col" onKeyDown={onKey}>
      <div className="h-11 shrink-0 flex items-center gap-1 px-2 border-b border-line">
        <IconButton icon={FilePlus} label="New" onClick={async () => { if (dirty && !(await dialog.confirm({ title: 'Discard changes?', danger: true, confirmLabel: 'Discard' }))) return; setSheet({ cells: {}, styles: {}, widths: {} }); setPath(null); setDirty(false); }} />
        <IconButton icon={FolderOpen} label="Open" onClick={async () => { const p = await dialog.open({ extensions: ['csv', 'tsv', 'sheet'], startDir: `${HOME}/Documents` }); if (p) await open(p); }} />
        <IconButton icon={Save} label="Save (Ctrl S)" onClick={() => save()} />
        <IconButton icon={Download} label="Export CSV" onClick={() => downloadBlob(new Blob([toCsv()], { type: 'text/csv' }), (path ? basename(path).replace(/\.\w+$/, '') : 'sheet') + '.csv')} />
        <IconButton icon={Undo2} label="Undo" onClick={() => { const p = history.current.pop(); if (p) setSheet(p); }} />
        <div className="w-px h-6 bg-line mx-1" />
        <IconButton icon={Bold} label="Bold" active={!!sheet.styles[k]?.b} onClick={() => styleRange({ b: !sheet.styles[k]?.b })} />
        <IconButton icon={AlignLeft} label="Left" onClick={() => styleRange({ align: 'left' })} />
        <IconButton icon={AlignCenter} label="Center" onClick={() => styleRange({ align: 'center' })} />
        <IconButton icon={AlignRight} label="Right" onClick={() => styleRange({ align: 'right' })} />
        <IconButton icon={Sigma} label="AutoSum" onClick={() => { if (sel.r > 0) { let top = sel.r - 1; while (top > 0 && typeof val(key(top - 1, sel.c)) === 'number') top--; setCell(k, `=SUM(${key(top, sel.c)}:${key(sel.r - 1, sel.c)})`); } }} />
        <div className="flex-1" />
        {path && <Button size="sm" variant="subtle" onClick={() => save(true)}>Save as…</Button>}
      </div>
      <div className="h-9 shrink-0 flex items-center gap-2 px-2 border-b border-line">
        <div className="w-14 text-center text-[12px] font-mono font-semibold text-muted">{multi ? `${key(g.r0, g.c0)}:${key(g.r1, g.c1)}` : k}</div>
        <span className="text-faint italic font-serif text-[14px]">fx</span>
        <input
          value={editing ?? sheet.cells[k] ?? ''}
          onChange={(e) => setEditing(e.target.value)}
          onFocus={() => editing === null && setEditing(sheet.cells[k] ?? '')}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(editing ?? ''); } if (e.key === 'Escape') { setEditing(null); gridRef.current?.focus(); } }}
          className="flex-1 h-7 bg-transparent outline-none font-mono text-[12.5px]"
          placeholder="Value or formula, e.g. =SUM(A1:A5)"
        />
      </div>
      <div ref={gridRef} tabIndex={0} className="flex-1 overflow-auto outline-none relative selectable" style={{ fontVariantNumeric: 'tabular-nums' }} onFocus={() => {}}>
        <table className="border-collapse text-[12.5px]" style={{ tableLayout: 'fixed' }}>
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="sticky left-0 z-20 w-11 min-w-11 h-6 bg-elevated border border-line" />
              {Array.from({ length: COLS }, (_, c) => <th key={c} className={cx('h-6 font-medium text-[11px] border border-line bg-elevated', c >= g.c0 && c <= g.c1 ? 'text-accent bg-accent/10' : 'text-muted')} style={{ width: sheet.widths[c] ?? 104, minWidth: sheet.widths[c] ?? 104 }}>{colName(c)}</th>)}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: ROWS }, (_, r) => (
              <tr key={r}>
                <td className={cx('sticky left-0 z-[5] text-center text-[11px] border border-line bg-elevated', r >= g.r0 && r <= g.r1 ? 'text-accent font-semibold' : 'text-muted')}>{r + 1}</td>
                {Array.from({ length: COLS }, (_, c) => {
                  const ck = key(r, c);
                  const isSel = r === sel.r && c === sel.c;
                  const st = sheet.styles[ck];
                  const v = val(ck);
                  const err = typeof v === 'string' && v.startsWith('#');
                  return (
                    <td key={c} data-k={ck}
                      onMouseDown={(e) => { if (e.shiftKey) { if (!anchor) setAnchor(sel); setSel({ r, c }); } else { setAnchor({ r, c }); setSel({ r, c }); setEditing(null); } gridRef.current?.focus(); }}
                      onMouseEnter={(e) => { if (e.buttons === 1 && anchor) setSel({ r, c }); }}
                      onDoubleClick={() => setEditing(sheet.cells[ck] ?? '')}
                      className={cx('h-6 border border-line px-1.5 truncate relative', inRange(r, c) && multi && 'bg-accent/10', isSel && 'outline-2 outline-accent -outline-offset-1 z-[2]', err && 'text-danger', st?.b && 'font-semibold')}
                      style={{ textAlign: st?.align ?? (typeof v === 'number' ? 'right' : 'left'), maxWidth: sheet.widths[c] ?? 104 }}
                    >
                      {isSel && editing !== null ? (
                        <input ref={editRef} autoFocus value={editing} onChange={(e) => setEditing(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(editing, e.shiftKey ? -1 : 1); } else if (e.key === 'Tab') { e.preventDefault(); commit(editing, 0, e.shiftKey ? -1 : 1); } else if (e.key === 'Escape') { setEditing(null); gridRef.current?.focus(); } e.stopPropagation(); }}
                          onBlur={() => editing !== null && (setCell(ck, editing), setEditing(null))}
                          className="absolute inset-0 px-1.5 bg-elevated outline-2 outline-accent text-fg font-mono text-[12px] z-10" />
                      ) : display(ck)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="h-6 shrink-0 border-t border-line flex items-center gap-4 px-3 text-[11px] text-muted justify-end">
        {multi && nums.length > 0 ? (<><span>Count {nums.length}</span><span>Sum {formatNumber(nums.reduce((a, b) => a + b, 0))}</span><span>Average {formatNumber(nums.reduce((a, b) => a + b, 0) / nums.length)}</span><span>Min {formatNumber(Math.min(...nums))}</span><span>Max {formatNumber(Math.max(...nums))}</span></>) : <span>Functions: SUM AVERAGE MIN MAX COUNT MEDIAN ROUND IF ABS SQRT …</span>}
        {active && <span className="text-faint">·</span>}
      </div>
    </div>
  );
}
