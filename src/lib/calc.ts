/**
 * Safe expression evaluator (no eval). Supports + - * / % ^ !, parentheses, implicit
 * multiplication, functions, constants, and an optional variable/cell resolver.
 */
type Tok = { t: 'num'; v: number } | { t: 'id'; v: string } | { t: 'op'; v: string } | { t: '('; } | { t: ')' } | { t: ',' } | { t: 'range'; a: string; b: string };

const FUNCS: Record<string, (...a: number[]) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, exp: Math.exp, ln: Math.log, log: Math.log10, log2: Math.log2,
  floor: Math.floor, ceil: Math.ceil, round: (x, d = 0) => Math.round(x * 10 ** d) / 10 ** d, trunc: Math.trunc, sign: Math.sign,
  min: Math.min, max: Math.max, pow: Math.pow, hypot: Math.hypot, mod: (a, b) => ((a % b) + b) % b,
  sum: (...a) => a.reduce((x, y) => x + y, 0),
  avg: (...a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0),
  average: (...a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0),
  count: (...a) => a.length,
  median: (...a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; },
  if: (c, a, b) => (c ? a : b),
  rand: () => Math.random(),
};
const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E, tau: Math.PI * 2, phi: (1 + Math.sqrt(5)) / 2 };

function fact(n: number) {
  if (n < 0 || !Number.isInteger(n)) return NaN;
  if (n > 170) return Infinity;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function lex(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const s = src.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/π/g, 'pi');
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      const m = /^(\d*\.?\d+(?:e[+-]?\d+)?|\d+\.)/i.exec(s.slice(i));
      if (!m) throw new Error('Bad number');
      out.push({ t: 'num', v: parseFloat(m[0]) });
      i += m[0].length;
      continue;
    }
    if (/[a-z_$]/i.test(c)) {
      const m = /^[a-z_$][a-z0-9_$]*(?::[a-z_$]*[a-z]+[0-9]+)?/i.exec(s.slice(i))!;
      const word = m[0];
      if (word.includes(':')) {
        const [a, b] = word.split(':');
        out.push({ t: 'range', a: a.toUpperCase(), b: b.toUpperCase() });
      } else out.push({ t: 'id', v: word });
      i += word.length;
      continue;
    }
    if ('+-*/%^!'.includes(c)) { out.push({ t: 'op', v: c }); i++; continue; }
    if (c === '(') { out.push({ t: '(' }); i++; continue; }
    if (c === ')') { out.push({ t: ')' }); i++; continue; }
    if (c === ',' || c === ';') { out.push({ t: ',' }); i++; continue; }
    if (c === '<' || c === '>' || c === '=') {
      const two = s.slice(i, i + 2);
      if (['<=', '>=', '==', '!=', '<>'].includes(two)) { out.push({ t: 'op', v: two }); i += 2; }
      else { out.push({ t: 'op', v: c }); i++; }
      continue;
    }
    throw new Error(`Unexpected “${c}”`);
  }
  return out;
}

export interface CalcEnv {
  resolve?: (name: string) => number | undefined;
  range?: (a: string, b: string) => number[];
  angle?: 'rad' | 'deg';
}

export function evaluate(src: string, env: CalcEnv = {}): number {
  const toks = lex(src);
  let p = 0;
  const peek = () => toks[p];
  const eat = () => toks[p++];
  const deg = env.angle === 'deg';

  function cmp(): number {
    let l = add();
    while (peek()?.t === 'op' && ['<', '>', '<=', '>=', '==', '=', '!=', '<>'].includes((peek() as { v: string }).v)) {
      const op = (eat() as { v: string }).v;
      const r = add();
      l = op === '<' ? +(l < r) : op === '>' ? +(l > r) : op === '<=' ? +(l <= r) : op === '>=' ? +(l >= r) : op === '!=' || op === '<>' ? +(l !== r) : +(l === r);
    }
    return l;
  }
  function add(): number {
    let l = mul();
    while (peek()?.t === 'op' && '+-'.includes((peek() as { v: string }).v)) {
      const op = (eat() as { v: string }).v;
      const r = mul();
      l = op === '+' ? l + r : l - r;
    }
    return l;
  }
  function mul(): number {
    let l = unary();
    for (;;) {
      const t = peek();
      if (t?.t === 'op' && '*/%'.includes(t.v)) {
        eat();
        const r = unary();
        l = t.v === '*' ? l * r : t.v === '/' ? l / r : l % r;
      } else if (t && (t.t === 'num' || t.t === 'id' || t.t === '(')) {
        l *= unary(); // implicit multiplication: 2pi, 3(4+1)
      } else return l;
    }
  }
  function unary(): number {
    const t = peek();
    if (t?.t === 'op' && (t.v === '-' || t.v === '+')) { eat(); const v = unary(); return t.v === '-' ? -v : v; }
    return pow();
  }
  function pow(): number {
    let b = postfix();
    if (peek()?.t === 'op' && (peek() as { v: string }).v === '^') { eat(); b = b ** unary(); }
    return b;
  }
  function postfix(): number {
    let v = atom();
    while (peek()?.t === 'op') {
      const op = (peek() as { v: string }).v;
      if (op === '!') { eat(); v = fact(v); }
      else if (op === '%' && (!toks[p + 1] || toks[p + 1].t === 'op' || toks[p + 1].t === ')')) { eat(); v = v / 100; }
      else break;
    }
    return v;
  }
  function args(): number[] {
    const out: number[] = [];
    if (peek()?.t === ')') { eat(); return out; }
    for (;;) {
      const t = peek();
      if (t?.t === 'range') { eat(); out.push(...(env.range?.(t.a, t.b) ?? [])); }
      else out.push(cmp());
      const n = eat();
      if (!n) throw new Error('Missing )');
      if (n.t === ')') return out;
      if (n.t !== ',') throw new Error('Expected ,');
    }
  }
  function atom(): number {
    const t = eat();
    if (!t) throw new Error('Unexpected end');
    if (t.t === 'num') return t.v;
    if (t.t === '(') {
      const v = cmp();
      if (eat()?.t !== ')') throw new Error('Missing )');
      return v;
    }
    if (t.t === 'range') return (env.range?.(t.a, t.b) ?? []).reduce((a, b) => a + b, 0);
    if (t.t === 'id') {
      const name = t.v.toLowerCase();
      if (peek()?.t === '(') {
        eat();
        const fn = FUNCS[name];
        if (!fn) throw new Error(`Unknown function ${t.v}`);
        let a = args();
        if (deg && ['sin', 'cos', 'tan'].includes(name)) a = [a[0] * Math.PI / 180];
        const r = fn(...a);
        return deg && ['asin', 'acos', 'atan'].includes(name) ? r * 180 / Math.PI : r;
      }
      if (name in CONSTS) return CONSTS[name];
      const v = env.resolve?.(t.v);
      if (v !== undefined) return v;
      throw new Error(`Unknown “${t.v}”`);
    }
    throw new Error('Syntax error');
  }

  const v = cmp();
  if (p < toks.length) throw new Error('Syntax error');
  return v;
}

export function tryEvaluate(src: string): number | null {
  if (!/[0-9]/.test(src) && !/\b(pi|e|tau)\b/i.test(src)) return null;
  if (!/[+\-*/^%!()]|\b[a-z]+\(/i.test(src)) return null;
  try {
    const v = evaluate(src);
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

export function formatNumber(n: number, maxFrac = 10): string {
  if (!Number.isFinite(n)) return n > 0 ? '∞' : n < 0 ? '-∞' : 'Error';
  if (Math.abs(n) >= 1e15 || (Math.abs(n) < 1e-9 && n !== 0)) return n.toExponential(8).replace(/\.?0+e/, 'e');
  return parseFloat(n.toFixed(maxFrac)).toLocaleString(undefined, { maximumFractionDigits: maxFrac });
}

/** Simple subsequence fuzzy score (higher is better; -1 = no match). */
export function fuzzy(query: string, text: string): number {
  const q = query.toLowerCase(), t = text.toLowerCase();
  if (!q) return 0;
  if (t === q) return 1000;
  if (t.startsWith(q)) return 800 - t.length;
  const idx = t.indexOf(q);
  if (idx >= 0) return 600 - idx - t.length * 0.5;
  // word-initial match ("nc" → "Notification Center")
  const initials = t.split(/[\s\-_.]+/).map((w) => w[0]).join('');
  if (initials.startsWith(q)) return 500;
  let ti = 0, score = 0, streak = 0;
  for (const ch of q) {
    const found = t.indexOf(ch, ti);
    if (found < 0) return -1;
    streak = found === ti ? streak + 1 : 0;
    score += 10 + streak * 5 - (found - ti);
    ti = found + 1;
  }
  return Math.max(1, score);
}
