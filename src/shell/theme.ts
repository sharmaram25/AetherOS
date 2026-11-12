import { useEffect, useState } from 'react';
import { useSettings } from '../kernel/settings';

function contrastText(hex: string) {
  const v = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16);
  const [r, g, b] = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return L > 0.45 ? '#0b0d14' : '#ffffff';
}

export function useIsDark() {
  const theme = useSettings((s) => s.theme);
  const [sys, setSys] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const fn = () => setSys(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return theme === 'auto' ? sys : theme === 'dark';
}

export function useThemeEngine() {
  const dark = useIsDark();
  const { accent, blur, reducedMotion } = useSettings();
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', dark);
    root.style.colorScheme = dark ? 'dark' : 'light';
    root.style.setProperty('--accent', accent);
    root.style.setProperty('--accent-fg', contrastText(accent));
    root.classList.toggle('no-blur', !blur);
    root.classList.toggle('reduce-motion', reducedMotion);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b0d14' : '#eef0f6');
  }, [dark, accent, blur, reducedMotion]);
  return dark;
}
