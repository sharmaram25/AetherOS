import { vfs } from '../kernel/vfs';
import { useExtApps, type ExtManifest } from '../kernel/registry';
import { APPS_DIR } from '../lib/path';
import type { Perm } from '../kernel/privacy';

const VALID_PERMS: Perm[] = ['notifications', 'clipboard', 'files', 'storage', 'camera', 'microphone', 'location'];

export function validateManifest(raw: unknown): ExtManifest {
  const m = raw as Partial<ExtManifest>;
  if (!m || typeof m !== 'object') throw new Error('Manifest must be a JSON object');
  if (!m.id || !/^[a-z0-9][a-z0-9-]{1,40}$/.test(m.id)) throw new Error('Manifest "id" must be lowercase letters, numbers and dashes');
  if (!m.name || typeof m.name !== 'string') throw new Error('Manifest needs a "name"');
  if (!m.html || typeof m.html !== 'string') throw new Error('Manifest needs an "html" string');
  const permissions = (Array.isArray(m.permissions) ? m.permissions : []).filter((p): p is Perm => VALID_PERMS.includes(p as Perm));
  return {
    id: m.id, name: m.name.slice(0, 40), description: m.description?.slice(0, 200), author: m.author?.slice(0, 60), version: m.version?.slice(0, 20),
    icon: typeof m.icon === 'string' && m.icon ? [...m.icon].slice(0, 2).join('') : '🧩',
    color: typeof m.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(m.color) ? m.color : '#6366f1',
    permissions, width: clamp(m.width, 320, 1600, 720), height: clamp(m.height, 240, 1200, 520), html: m.html, builtin: m.builtin,
  };
}

const clamp = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);

const pathFor = (id: string) => `${APPS_DIR}/${id}.aetherapp`;

export async function loadInstalledApps() {
  const apps: Record<string, Omit<ExtManifest, 'html'> & { path: string }> = {};
  for (const n of vfs.list(APPS_DIR)) {
    if (!n.name.endsWith('.aetherapp')) continue;
    try {
      const { html: _html, ...meta } = validateManifest(JSON.parse(await vfs.readText(n.path)));
      apps[meta.id] = { ...meta, path: n.path };
    } catch (e) {
      console.warn('[sdk] invalid app', n.path, e);
    }
  }
  useExtApps.setState({ apps });
}

export async function installApp(manifest: ExtManifest) {
  const m = validateManifest(manifest);
  await vfs.writeText(pathFor(m.id), JSON.stringify(m, null, 2), 'application/x-aether-app');
  const { html: _h, ...meta } = m;
  useExtApps.setState((s) => ({ apps: { ...s.apps, [m.id]: { ...meta, path: pathFor(m.id) } } }));
  return m;
}

export async function uninstallApp(id: string) {
  await vfs.deletePermanent([pathFor(id), `/System/AppData/ext.${id}.json`]);
  useExtApps.setState((s) => {
    const { [id]: _gone, ...rest } = s.apps;
    return { apps: rest };
  });
}

export async function readManifest(id: string): Promise<ExtManifest | null> {
  try {
    return validateManifest(JSON.parse(await vfs.readText(pathFor(id))));
  } catch {
    return null;
  }
}
