/**
 * The Aether SDK runtime injected into every sandboxed app.
 *
 * Apps run in `<iframe sandbox="allow-scripts">` with an opaque origin: they cannot read
 * AetherOS storage, cookies or the parent DOM, and the production CSP blocks all outbound
 * network. Everything an app can do goes through this message bridge, where each call is
 * checked against the app's declared permissions and the user's consent.
 */
export const SDK_RUNTIME = `
(() => {
  let seq = 0;
  const pending = new Map();
  const handlers = {};
  addEventListener('message', (e) => {
    const d = e.data;
    if (!d || d.__aether !== true || e.source !== parent) return;
    if (d.id && pending.has(d.id)) {
      const p = pending.get(d.id); pending.delete(d.id);
      d.error ? p.reject(new Error(d.error)) : p.resolve(d.result);
    } else if (d.event) {
      if (d.event === 'theme') applyTheme(d.data);
      (handlers[d.event] || []).forEach((f) => { try { f(d.data); } catch (err) { console.error(err); } });
    }
  });
  const call = (method, ...params) => new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    parent.postMessage({ __aether: true, id, method, params }, '*');
  });
  function applyTheme(t) {
    if (!t) return;
    const r = document.documentElement;
    r.style.setProperty('--aether-accent', t.accent);
    r.style.colorScheme = t.dark ? 'dark' : 'light';
    r.dataset.theme = t.dark ? 'dark' : 'light';
  }
  applyTheme(window.__AETHER_THEME);
  window.aether = {
    version: '1.0',
    call,
    on: (event, fn) => { (handlers[event] = handlers[event] || []).push(fn); },
    info: () => call('app.info'),
    theme: () => call('theme.get'),
    setTitle: (t) => call('window.setTitle', String(t)),
    notify: (title, body) => call('notify', String(title), body == null ? undefined : String(body)),
    clipboard: { write: (text) => call('clipboard.write', String(text)) },
    storage: {
      get: (key) => call('storage.get', String(key)),
      set: (key, value) => call('storage.set', String(key), value),
      remove: (key) => call('storage.remove', String(key)),
      keys: () => call('storage.keys'),
    },
    fs: {
      open: (opts) => call('fs.pickOpen', opts || {}),
      save: (name, content, opts) => call('fs.pickSave', String(name), content, opts || {}),
      read: (path) => call('fs.readText', String(path)),
      write: (path, text) => call('fs.writeText', String(path), String(text)),
      list: (path) => call('fs.list', String(path || '~')),
    },
  };
  window.addEventListener('error', (e) => parent.postMessage({ __aether: true, method: 'log', params: ['error', String(e.message)] }, '*'));
})();
`;

export function buildSandboxDocument(html: string, theme: { dark: boolean; accent: string }) {
  const boot = `<script>window.__AETHER_THEME=${JSON.stringify(theme)};</script><script>${SDK_RUNTIME}</script>`;
  const base = `<style>:root{--aether-accent:${theme.accent};color-scheme:${theme.dark ? 'dark' : 'light'}}html,body{margin:0}</style>`;
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => `${m}${boot}${base}`);
  if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, (m) => `${m}<head>${boot}${base}</head>`);
  return `<!doctype html><html><head><meta charset="utf-8">${boot}${base}</head><body>${html}</body></html>`;
}
