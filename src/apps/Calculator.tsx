import { useEffect, useRef, useState } from 'react';
import { History, Delete, Trash2 } from 'lucide-react';
import type { AppProps } from '../kernel/registry';
import { useWindows } from '../kernel/windows';
import { useAppData } from '../kernel/appdata';
import { copyText } from '../kernel/privacy';
import { toast } from '../kernel/notify';
import { evaluate, formatNumber } from '../lib/calc';
import { IconButton, Segmented, cx } from '../ui';

type Mode = 'standard' | 'scientific' | 'programmer';

export default function Calculator({ win }: AppProps) {
  const [mode, setMode] = useState<Mode>('standard');
  const [expr, setExpr] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [angle, setAngle] = useState<'deg' | 'rad'>('deg');
  const [showHist, setShowHist] = useState(false);
  const [hist, setHist] = useAppData<{ items: { e: string; r: string }[] }>('calculator', { items: [] });
  const [base, setBase] = useState<16 | 10 | 8 | 2>(10);
  const active = useWindows((s) => s.activeId === win.id);
  const ref = useRef<HTMLDivElement>(null);

  const live = (() => {
    if (!expr) return '';
    try {
      const v = evaluate(expr, { angle });
      return Number.isFinite(v) ? formatNumber(v) : '';
    } catch { return ''; }
  })();

  const press = (k: string) => {
    setResult(null);
    if (k === 'C') { setExpr(''); return; }
    if (k === '⌫') { setExpr((e) => e.slice(0, -1)); return; }
    if (k === '=') {
      try {
        const v = evaluate(expr, { angle });
        const r = formatNumber(v);
        setHist((h) => ({ items: [{ e: expr, r }, ...h.items].slice(0, 50) }));
        setResult(r);
        setExpr(String(+v.toPrecision(15)));
      } catch { setResult('Error'); }
      return;
    }
    if (k === '±') { setExpr((e) => (e.startsWith('-(') && e.endsWith(')') ? e.slice(2, -1) : e ? `-(${e})` : '-')); return; }
    const fn = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'ln', 'log', 'sqrt', 'abs', 'exp'];
    if (fn.includes(k)) { setExpr((e) => e + k + '('); return; }
    if (k === 'x²') { setExpr((e) => e + '^2'); return; }
    if (k === 'xʸ') { setExpr((e) => e + '^'); return; }
    if (k === '1/x') { setExpr((e) => `1/(${e || '1'})`); return; }
    if (k === '√') { setExpr((e) => e + 'sqrt('); return; }
    setExpr((e) => e + k);
  };

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || e.altKey) return;
      if (e.ctrlKey && e.key === 'c') { void copyText(result ?? live ?? expr); toast('Copied'); return; }
      if (e.ctrlKey || e.metaKey) return;
      const map: Record<string, string> = { Enter: '=', '=': '=', Backspace: '⌫', Escape: 'C', Delete: 'C', x: '*', '×': '*', '÷': '/' };
      const k = map[e.key] ?? (/^[0-9+\-*/().^%!,e]$|^[a-f]$/i.test(e.key) ? e.key : null);
      if (k) { e.preventDefault(); press(k); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const std = [
    ['C', '±', '%', '/'],
    ['7', '8', '9', '*'],
    ['4', '5', '6', '-'],
    ['1', '2', '3', '+'],
    ['0', '.', '⌫', '='],
  ];
  const sci = [
    ['sin', 'cos', 'tan', '(', ')'],
    ['asin', 'acos', 'atan', 'x²', 'xʸ'],
    ['ln', 'log', '√', '1/x', '!'],
    ['pi', 'e', 'abs', 'exp', angle === 'deg' ? 'DEG' : 'RAD'],
  ];

  const progVal = (() => { try { const v = Math.trunc(evaluate(expr || '0')); return Number.isFinite(v) ? v : 0; } catch { return 0; } })();

  const Key = ({ k }: { k: string }) => {
    const op = ['/', '*', '-', '+'].includes(k);
    const eq = k === '=';
    const fn = ['C', '±', '%', '⌫'].includes(k);
    const label = { '/': '÷', '*': '×', '-': '−', pi: 'π' }[k] ?? k;
    return (
      <button
        onClick={() => (k === 'DEG' || k === 'RAD' ? setAngle(angle === 'deg' ? 'rad' : 'deg') : press(k))}
        className={cx('rounded-2xl font-medium transition-all active:scale-95 flex items-center justify-center select-none',
          mode === 'standard' ? 'text-[20px]' : 'text-[15px]',
          eq ? 'bg-accent text-accent-fg hover:brightness-110 shadow-lg shadow-accent/25' : op ? 'bg-accent/15 text-accent hover:bg-accent/25 text-[22px]' : fn ? 'bg-active hover:bg-line-strong' : 'bg-hover hover:bg-active')}
      >
        {k === '⌫' ? <Delete size={19} /> : label}
      </button>
    );
  };

  return (
    <div ref={ref} className="h-full flex flex-col p-3 gap-3">
      <div className="flex items-center gap-2">
        <Segmented size="sm" value={mode} onChange={setMode} options={[{ value: 'standard', label: 'Basic' }, { value: 'scientific', label: 'Scientific' }, { value: 'programmer', label: 'Dev' }]} className="flex-1" />
        <IconButton icon={History} active={showHist} label="History" onClick={() => setShowHist(!showHist)} />
      </div>
      {showHist ? (
        <div className="flex-1 overflow-y-auto rounded-2xl bg-hover border border-line p-2">
          <div className="flex justify-between items-center px-2 pb-2"><span className="text-[12px] font-semibold text-muted">History</span>{hist.items.length > 0 && <IconButton icon={Trash2} size={13} className="w-6 h-6" onClick={() => setHist({ items: [] })} />}</div>
          {hist.items.length === 0 && <div className="text-center text-[12.5px] text-faint py-8">No calculations yet</div>}
          {hist.items.map((h, i) => (
            <button key={i} onClick={() => { setExpr(h.e); setShowHist(false); }} className="w-full text-right px-3 py-2 rounded-xl hover:bg-active">
              <div className="text-[12px] text-muted font-mono truncate">{h.e}</div>
              <div className="text-[18px] font-semibold tabular-nums">{h.r}</div>
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="rounded-2xl bg-hover border border-line px-4 py-3 text-right min-h-[96px] flex flex-col justify-end selectable">
            <div className="text-[14px] text-muted font-mono break-all min-h-[20px]">{expr.replace(/\*/g, '×').replace(/\//g, '÷') || ' '}</div>
            <div className={cx('font-semibold tabular-nums tracking-tight break-all', (result ?? live).length > 12 ? 'text-[26px]' : 'text-[40px]', result === 'Error' && 'text-danger')}>{result ?? (live || '0')}</div>
          </div>
          {mode === 'programmer' && (
            <div className="rounded-xl bg-hover border border-line p-2 text-[12px] font-mono space-y-0.5">
              {([[16, 'HEX'], [10, 'DEC'], [8, 'OCT'], [2, 'BIN']] as [16 | 10 | 8 | 2, string][]).map(([b, l]) => (
                <button key={b} onClick={() => setBase(b)} className={cx('w-full flex gap-3 px-2 py-1 rounded-lg text-left', base === b ? 'bg-accent/15 text-accent' : 'hover:bg-active')}>
                  <span className="w-8 text-faint">{l}</span><span className="truncate">{(progVal < 0 ? '-' : '') + Math.abs(progVal).toString(b).toUpperCase()}</span>
                </button>
              ))}
            </div>
          )}
          {mode === 'scientific' && <div className="grid grid-cols-5 gap-1.5 h-[150px]">{sci.flat().map((k) => <Key key={k} k={k} />)}</div>}
          <div className="flex-1 grid grid-cols-4 gap-1.5 min-h-[220px]">{std.flat().map((k) => <Key key={k} k={k} />)}</div>
        </>
      )}
    </div>
  );
}
