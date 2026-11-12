import React, { createContext, forwardRef, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { Check, ChevronRight, Loader2, type LucideIcon } from 'lucide-react';
import type { AppDef } from '../kernel/registry';
import type { Win } from '../kernel/windows';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/* ---------- Window context ---------- */
export const WinContext = createContext<Win | null>(null);
export const useWin = () => useContext(WinContext)!;

/* ---------- Buttons ---------- */
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = 'secondary', size = 'md', icon: Icon, loading, className, children, disabled, ...rest }, ref,
) {
  const base = 'inline-flex items-center justify-center gap-1.5 font-medium rounded-lg transition-all duration-150 active:scale-[0.97] disabled:opacity-45 disabled:pointer-events-none whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';
  const sizes = { sm: 'h-7 px-2.5 text-[12px]', md: 'h-8 px-3.5 text-[13px]', lg: 'h-10 px-5 text-sm' };
  const variants: Record<BtnVariant, string> = {
    primary: 'bg-accent text-accent-fg shadow-sm shadow-accent/25 hover:brightness-110',
    secondary: 'bg-hover border border-line text-fg hover:bg-active',
    ghost: 'text-fg hover:bg-hover',
    subtle: 'text-muted hover:text-fg hover:bg-hover',
    danger: 'bg-danger text-white hover:brightness-110',
  };
  return (
    <button ref={ref} className={cx(base, sizes[size], variants[variant], className)} disabled={disabled || loading} {...rest}>
      {loading ? <Loader2 size={size === 'sm' ? 13 : 15} className="animate-spin" /> : Icon ? <Icon size={size === 'sm' ? 13 : 15} /> : null}
      {children}
    </button>
  );
});

interface IconBtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { icon: LucideIcon; size?: number; active?: boolean; label?: string }
export const IconButton = forwardRef<HTMLButtonElement, IconBtnProps>(function IconButton({ icon: Icon, size = 16, active, label, className, ...rest }, ref) {
  return (
    <button
      ref={ref}
      title={label}
      aria-label={label}
      className={cx('inline-flex items-center justify-center rounded-lg w-8 h-8 transition-colors disabled:opacity-40 disabled:pointer-events-none',
        active ? 'bg-accent/15 text-accent' : 'text-muted hover:text-fg hover:bg-hover', className)}
      {...rest}
    >
      <Icon size={size} />
    </button>
  );
});

/* ---------- Inputs ---------- */
export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { icon?: LucideIcon }>(function Input({ className, icon: Icon, ...rest }, ref) {
  const input = (
    <input
      ref={ref}
      spellCheck={false}
      className={cx('h-8 w-full rounded-lg bg-hover border border-line px-3 text-[13px] text-fg placeholder:text-faint outline-none transition-colors focus:border-accent focus:bg-transparent focus:ring-3 focus:ring-accent/15',
        Icon && 'pl-8', className)}
      {...rest}
    />
  );
  if (!Icon) return input;
  return (
    <div className="relative w-full">
      <Icon size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
      {input}
    </div>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cx('w-full rounded-lg bg-hover border border-line px-3 py-2 text-[13px] text-fg placeholder:text-faint outline-none focus:border-accent focus:ring-3 focus:ring-accent/15 resize-none', className)} {...rest} />;
});

export function Select({ value, onChange, options, className }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; className?: string }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cx('h-8 rounded-lg bg-hover border border-line px-2.5 text-[13px] text-fg outline-none focus:border-accent cursor-pointer [&>option]:bg-elevated', className)}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function Switch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx('relative w-9 h-[22px] rounded-full transition-colors duration-200 shrink-0 disabled:opacity-40', checked ? 'bg-accent' : 'bg-line-strong')}
    >
      <span className={cx('absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white shadow transition-transform duration-200', checked && 'translate-x-[14px]')} />
    </button>
  );
}

export function Slider({ value, min, max, step = 1, onChange, className }: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; className?: string }) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range" min={min} max={max} step={step} value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={cx('aether-range w-full', className)}
      style={{ ['--fill' as string]: `${fill}%` }}
    />
  );
}

export function Segmented<T extends string>({ value, onChange, options, size = 'md', className }: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode; icon?: LucideIcon }[]; size?: 'sm' | 'md'; className?: string }) {
  return (
    <div className={cx('inline-flex p-0.5 rounded-lg bg-hover border border-line', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx('inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-all flex-1',
            size === 'sm' ? 'h-6 px-2 text-[11.5px]' : 'h-7 px-3 text-[12.5px]',
            value === o.value ? 'bg-elevated text-fg shadow-sm' : 'text-muted hover:text-fg')}
        >
          {o.icon && <o.icon size={13} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Misc ---------- */
export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-md bg-hover border border-line text-[10.5px] font-medium text-muted font-sans">{children}</kbd>;
}

export function Spinner({ size = 18, className }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={cx('animate-spin text-muted', className)} />;
}

export function Badge({ children, tone = 'neutral', className }: { children: React.ReactNode; tone?: 'neutral' | 'accent' | 'success' | 'warn' | 'danger'; className?: string }) {
  const tones = {
    neutral: 'bg-hover text-muted border-line',
    accent: 'bg-accent/12 text-accent border-accent/25',
    success: 'bg-success/12 text-success border-success/25',
    warn: 'bg-warn/12 text-warn border-warn/25',
    danger: 'bg-danger/12 text-danger border-danger/25',
  };
  return <span className={cx('inline-flex items-center gap-1 h-5 px-1.5 rounded-md border text-[10.5px] font-semibold uppercase tracking-wide whitespace-nowrap shrink-0', tones[tone], className)}>{children}</span>;
}

export function Empty({ icon: Icon, title, body, action }: { icon: LucideIcon; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center text-center p-8 gap-3 animate-fade-in">
      <div className="w-14 h-14 rounded-2xl bg-hover border border-line flex items-center justify-center text-faint"><Icon size={26} /></div>
      <div>
        <div className="font-semibold text-[14px]">{title}</div>
        {body && <div className="text-[12.5px] text-muted mt-1 max-w-[320px]">{body}</div>}
      </div>
      {action}
    </div>
  );
}

export function SidebarItem({ icon: Icon, label, active, count, onClick, onContextMenu, color, trailing, onDrop, onDragOver }: {
  icon: LucideIcon; label: string; active?: boolean; count?: number | string; onClick?: () => void; onContextMenu?: (e: React.MouseEvent) => void; color?: string; trailing?: React.ReactNode;
  onDrop?: (e: React.DragEvent) => void; onDragOver?: (e: React.DragEvent) => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <button
      onClick={onClick}
      onContextMenu={onContextMenu}
      onDragOver={onDrop ? (e) => { e.preventDefault(); setOver(true); onDragOver?.(e); } : undefined}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop ? (e) => { setOver(false); onDrop(e); } : undefined}
      className={cx('group w-full flex items-center gap-2.5 h-[30px] px-2.5 rounded-lg text-[13px] transition-colors text-left',
        active ? 'bg-accent/14 text-fg font-medium' : 'text-muted hover:bg-hover hover:text-fg', over && 'ring-2 ring-accent bg-accent/10')}
    >
      <Icon size={15} style={{ color: color ?? (active ? 'var(--accent)' : undefined) }} className="shrink-0" />
      <span className="truncate flex-1">{label}</span>
      {trailing}
      {count !== undefined && count !== 0 && <span className="text-[11px] text-faint tabular-nums">{count}</span>}
    </button>
  );
}

export function SectionLabel({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-2.5 pt-4 pb-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">{children}</span>
      {action}
    </div>
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx('rounded-xl bg-panel border border-line', className)}>{children}</div>;
}

export function Row({ title, desc, children, icon: Icon }: { title: React.ReactNode; desc?: React.ReactNode; children?: React.ReactNode; icon?: LucideIcon }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-line last:border-0 min-h-[52px]">
      {Icon && <Icon size={17} className="text-muted shrink-0" />}
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium">{title}</div>
        {desc && <div className="text-[12px] text-muted mt-0.5">{desc}</div>}
      </div>
      {children && <div className="shrink-0 flex items-center gap-2">{children}</div>}
    </div>
  );
}

export function Toolbar({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx('h-11 shrink-0 flex items-center gap-1 px-2 border-b border-line bg-chrome', className)} style={{ background: 'var(--chrome)' }}>{children}</div>;
}

/* ---------- App icon (squircle) ---------- */
export function AppGlyph({ app, size = 40, className }: { app: Pick<AppDef, 'icon' | 'gradient' | 'name'>; size?: number; className?: string }) {
  const [a, b] = app.gradient;
  const Icon = app.icon;
  return (
    <div
      className={cx('relative shrink-0 flex items-center justify-center text-white overflow-hidden', className)}
      style={{
        width: size, height: size, borderRadius: size * 0.27,
        background: `linear-gradient(145deg, ${a}, ${b})`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -1px 0 rgba(0,0,0,0.15), 0 ${size * 0.08}px ${size * 0.25}px -${size * 0.06}px rgba(0,0,0,0.45)`,
      }}
    >
      <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 80% at 30% 0%, rgba(255,255,255,0.32), transparent 55%)' }} />
      {typeof Icon === 'string'
        ? <span style={{ fontSize: size * 0.52, lineHeight: 1 }} className="relative">{Icon}</span>
        : <Icon size={size * 0.5} strokeWidth={1.9} className="relative drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)]" />}
    </div>
  );
}

/* ---------- Menus ---------- */
export type MenuItem =
  | { label: string; icon?: LucideIcon; shortcut?: string; onClick?: () => void; danger?: boolean; disabled?: boolean; checked?: boolean; submenu?: MenuItem[] }
  | { separator: true }
  | { header: string };

interface MenuState { open: boolean; x: number; y: number; items: MenuItem[]; minWidth?: number }
export const useMenu = create<MenuState>(() => ({ open: false, x: 0, y: 0, items: [] }));

export function openMenu(e: { clientX: number; clientY: number; preventDefault?: () => void; stopPropagation?: () => void }, items: MenuItem[], minWidth?: number) {
  e.preventDefault?.();
  e.stopPropagation?.();
  useMenu.setState({ open: true, x: e.clientX, y: e.clientY, items, minWidth });
}
export function openMenuAt(el: HTMLElement, items: MenuItem[], align: 'left' | 'right' = 'left') {
  const r = el.getBoundingClientRect();
  useMenu.setState({ open: true, x: align === 'left' ? r.left : r.right - 220, y: r.bottom + 4, items, minWidth: Math.max(r.width, 200) });
}
export const closeMenu = () => useMenu.setState({ open: false });

function MenuList({ items, x, y, minWidth, onClose, depth = 0 }: { items: MenuItem[]; x: number; y: number; minWidth?: number; onClose: () => void; depth?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });
  const [sub, setSub] = useState<{ index: number; x: number; y: number } | null>(null);
  const [hi, setHi] = useState(-1);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let nx = x, ny = y;
    if (nx + r.width > window.innerWidth - 6) nx = depth ? x - r.width - (minWidth ?? 200) - 4 : window.innerWidth - r.width - 6;
    if (ny + r.height > window.innerHeight - 6) ny = Math.max(6, window.innerHeight - r.height - 6);
    setPos({ x: Math.max(6, nx), y: ny });
  }, [x, y, depth, minWidth]);

  const actionable = items.map((it, i) => ('label' in it && !it.disabled ? i : -1)).filter((i) => i >= 0);

  useEffect(() => {
    if (depth) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const idx = actionable.indexOf(hi);
        const next = e.key === 'ArrowDown' ? actionable[(idx + 1) % actionable.length] : actionable[(idx - 1 + actionable.length) % actionable.length];
        setHi(next ?? -1);
      }
      if (e.key === 'Enter' && hi >= 0) {
        const it = items[hi];
        if ('label' in it && it.onClick) { onClose(); it.onClick(); }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  return (
    <>
      <div
        ref={ref}
        className="fixed z-[100000] glass rounded-xl border border-line-strong shadow-2xl shadow-black/30 p-1 animate-pop text-[13px]"
        style={{ left: pos.x, top: pos.y, minWidth: minWidth ?? 200 }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {items.map((it, i) => {
          if ('separator' in it) return <div key={i} className="h-px bg-line my-1 mx-1.5" />;
          if ('header' in it) return <div key={i} className="px-2.5 pt-1.5 pb-1 text-[11px] font-semibold text-faint uppercase tracking-wide">{it.header}</div>;
          const Icon = it.icon;
          return (
            <button
              key={i}
              disabled={it.disabled}
              onMouseEnter={(e) => {
                setHi(i);
                if (it.submenu) {
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setSub({ index: i, x: r.right + 4, y: r.top - 4 });
                } else setSub(null);
              }}
              onClick={() => {
                if (it.submenu) return;
                onClose();
                it.onClick?.();
              }}
              className={cx('w-full flex items-center gap-2.5 h-[30px] px-2.5 rounded-lg text-left transition-colors disabled:opacity-40',
                hi === i ? (it.danger ? 'bg-danger text-white' : 'bg-accent text-accent-fg') : it.danger ? 'text-danger' : 'text-fg')}
            >
              <span className="w-4 flex items-center justify-center shrink-0">
                {it.checked ? <Check size={14} /> : Icon ? <Icon size={14} className={hi === i ? '' : 'opacity-70'} /> : null}
              </span>
              <span className="flex-1 truncate">{it.label}</span>
              {it.shortcut && <span className={cx('text-[11px] ml-4', hi === i ? 'opacity-80' : 'text-faint')}>{it.shortcut}</span>}
              {it.submenu && <ChevronRight size={13} className="opacity-60" />}
            </button>
          );
        })}
      </div>
      {sub && (items[sub.index] as { submenu?: MenuItem[] }).submenu && (
        <MenuList items={(items[sub.index] as { submenu: MenuItem[] }).submenu} x={sub.x} y={sub.y} onClose={onClose} depth={depth + 1} minWidth={180} />
      )}
    </>
  );
}

export function MenuHost() {
  const { open, x, y, items, minWidth } = useMenu();
  useEffect(() => {
    if (!open) return;
    const close = () => closeMenu();
    const t = setTimeout(() => {
      window.addEventListener('pointerdown', onDown, true);
      window.addEventListener('blur', close);
      window.addEventListener('resize', close);
    });
    function onDown(e: PointerEvent) {
      if (!(e.target as HTMLElement).closest('.animate-pop')) close();
    }
    return () => {
      clearTimeout(t);
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('blur', close);
      window.removeEventListener('resize', close);
    };
  }, [open]);
  if (!open) return null;
  return <MenuList key={`${x}:${y}`} items={items} x={x} y={y} minWidth={minWidth} onClose={closeMenu} />;
}

/* ---------- Hooks ---------- */
export function useInterval(fn: () => void, ms: number | null) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (ms == null) return;
    const id = setInterval(() => ref.current(), ms);
    return () => clearInterval(id);
  }, [ms]);
}

export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => new Date());
  useInterval(() => setNow(new Date()), ms);
  return now;
}

export function useObjectUrl(loader: (() => Promise<string>) | null, deps: unknown[]) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    let current: string | null = null;
    setUrl(null);
    if (loader) loader().then((u) => { if (alive) { current = u; setUrl(u); } else URL.revokeObjectURL(u); }).catch(() => alive && setUrl(null));
    return () => { alive = false; if (current) URL.revokeObjectURL(current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return url;
}
