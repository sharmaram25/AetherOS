import { useEffect } from 'react';
import { useWindows, wm, WORKSPACES } from '../kernel/windows';
import { useSettings } from '../kernel/settings';
import { session, useSession } from '../kernel/session';
import { shell, useShell } from './store';

function isEditable(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable || !!el.closest?.('.cm-editor'));
}

/** Global keyboard shortcuts. Alt-based so they never collide with app/editor shortcuts. */
export function useShortcuts() {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const s = useWindows.getState();
      const active = s.activeId;
      // Spotlight
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'k' && !isEditable(e.target)) { e.preventDefault(); shell.open('spotlight'); return; }
      if (e.altKey && e.code === 'Space') { e.preventDefault(); shell.open('spotlight'); return; }
      if (!e.altKey || e.ctrlKey || e.metaKey) return;

      // Alt+Tab / Alt+` switcher
      if (e.key === 'Tab' || e.code === 'Backquote') {
        e.preventDefault();
        const cur = s.switcher;
        useWindows.setState({ switcher: { index: (cur ? cur.index : 0) + (e.shiftKey ? -1 : 1) } });
        return;
      }

      const k = e.key.toLowerCase();
      const digit = /^Digit([1-9])$/.exec(e.code);
      let handled = true;
      if (digit) {
        const n = Number(digit[1]) - 1;
        if (n < WORKSPACES) {
          if (e.shiftKey && active) wm.moveToWs(active, n);
          else wm.switchWs(n);
        }
      } else if (e.code === 'PageUp') wm.switchWs(Math.max(0, s.ws - 1));
      else if (e.code === 'PageDown') wm.switchWs(Math.min(WORKSPACES - 1, s.ws + 1));
      else if (e.key === 'ArrowUp' && active) wm.toggleMaximize(active);
      else if (e.key === 'ArrowDown' && active) {
        const w = s.wins[active];
        if (w.state === 'maximized' || w.snap) wm.unsnap(active); else wm.minimize(active);
      } else if (e.key === 'ArrowLeft' && active) wm.snap(active, 'left');
      else if (e.key === 'ArrowRight' && active) wm.snap(active, 'right');
      else if (k === 'q' && active) wm.close(active);
      else if (k === 'm' && active) wm.minimize(active);
      else if (k === 'd') wm.showDesktop();
      else if (k === 'o') wm.toggleOverview();
      else if (k === 'l') void session.lock();
      else if (k === 'n') shell.open('center');
      else if (k === 'a') shell.open('launchpad');
      else if (k === 't') wm.open('terminal', undefined, { newWindow: true });
      else if (k === 'e') wm.open('files');
      else if (e.key === '/' || e.key === '?') shell.open('shortcuts');
      else if (e.key === ',') wm.open('settings');
      else handled = false;
      if (handled) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        const sw = useWindows.getState().switcher;
        if (sw) {
          const list = wm.mru();
          if (list.length) wm.focus(list[((sw.index % list.length) + list.length) % list.length].id);
          useWindows.setState({ switcher: null });
        }
      }
    };
    const blur = () => useWindows.setState({ switcher: null });
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);
}

/** Lock after inactivity, and optionally when the tab is hidden. */
export function useAutoLock() {
  const minutes = useSettings((s) => s.autoLockMinutes);
  const lockOnHide = useSettings((s) => s.lockOnHide);
  const mode = useSession((s) => s.mode);
  useEffect(() => {
    if (mode === 'guest') return;
    let last = Date.now();
    const bump = () => { last = Date.now(); };
    const events = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, bump, { passive: true }));
    const id = minutes > 0 ? setInterval(() => { if (Date.now() - last > minutes * 60_000) void session.lock(); }, 5000) : null;
    const vis = () => { if (lockOnHide && document.visibilityState === 'hidden') void session.lock(); };
    document.addEventListener('visibilitychange', vis);
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, bump));
      if (id) clearInterval(id);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [minutes, lockOnHide, mode]);
}

/** Blur window contents whenever AetherOS loses focus — protects against shoulder-surfing and screen shares. */
export function usePrivacyShield() {
  const on = useSettings((s) => s.privacyShield);
  useEffect(() => {
    if (!on) { useShell.setState({ shielded: false }); return; }
    const hide = () => setTimeout(() => {
      // Focus moving into one of our own iframes is not "leaving".
      if (document.activeElement?.tagName === 'IFRAME') return;
      useShell.setState({ shielded: true });
    }, 50);
    const show = () => useShell.setState({ shielded: false });
    const vis = () => (document.hidden ? useShell.setState({ shielded: true }) : show());
    window.addEventListener('blur', hide);
    window.addEventListener('focus', show);
    document.addEventListener('visibilitychange', vis);
    return () => {
      window.removeEventListener('blur', hide);
      window.removeEventListener('focus', show);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [on]);
}
