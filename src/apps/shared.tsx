import { useCallback } from 'react';
import { dialog } from '../kernel/dialog';
import { useSettings } from '../kernel/settings';

/** Intercept clicks on external links: confirm before leaving the private environment. */
export async function openExternal(url: string) {
  let u: URL;
  try { u = new URL(url); } catch { return; }
  if (!['http:', 'https:', 'mailto:'].includes(u.protocol)) return;
  if (useSettings.getState().confirmExternalLinks) {
    const ok = await dialog.confirm({
      title: 'Open external link?',
      message: `${u.href}\n\nThis opens a new browser tab outside AetherOS. The site will see your IP address. No referrer is sent.`,
      confirmLabel: 'Open link',
    });
    if (!ok) return;
  }
  window.open(u.href, '_blank', 'noopener,noreferrer');
}

export function useLinkGuard() {
  return useCallback((e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest('a');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href) return;
    e.preventDefault();
    if (href.startsWith('#')) return;
    void openExternal(href);
  }, []);
}
