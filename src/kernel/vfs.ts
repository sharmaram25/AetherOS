/**
 * Aether Virtual File System.
 *
 * - The directory index lives in memory while unlocked and is persisted as a single encrypted record.
 * - File contents are stored as individually encrypted blobs keyed by a random id, so renames and
 *   moves never re-encrypt content, and nothing about a file's name leaks from its storage key.
 */
import { create } from 'zustand';
import { randomId, utf8, fromUtf8 } from './crypto';
import type { Backend, StoredIndex } from './vault';
import { basename, dirname, extname, isInside, join, normalize, stem, TRASH, HOME, APPDATA } from '../lib/path';
import { mimeOf, isTextMime } from '../lib/mime';

export interface FsNode {
  path: string;
  name: string;
  kind: 'file' | 'dir';
  mime?: string;
  size: number;
  created: number;
  modified: number;
  blob?: string;
  trashedFrom?: string;
  trashedAt?: number;
  starred?: boolean;
}

interface VfsState {
  nodes: Record<string, FsNode>;
  ready: boolean;
  backend: Backend | null;
  rev: number;
}

export const useVfs = create<VfsState>(() => ({ nodes: {}, ready: false, backend: null, rev: 0 }));

const cache = new Map<string, Uint8Array>();
let cacheBytes = 0;
const CACHE_LIMIT = 64 * 1024 * 1024;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSave: Promise<void> | null = null;

function cachePut(id: string, data: Uint8Array) {
  if (data.byteLength > CACHE_LIMIT / 4) return;
  const prev = cache.get(id);
  if (prev) cacheBytes -= prev.byteLength;
  cache.set(id, data);
  cacheBytes += data.byteLength;
  while (cacheBytes > CACHE_LIMIT && cache.size) {
    const first = cache.keys().next().value as string;
    cacheBytes -= cache.get(first)!.byteLength;
    cache.delete(first);
  }
}

const get = () => useVfs.getState();

function setNodes(nodes: Record<string, FsNode>) {
  useVfs.setState((s) => ({ nodes, rev: s.rev + 1 }));
  scheduleSave();
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveTimer = null; void persist(); }, 250);
}

async function persist() {
  const { backend, nodes } = get();
  if (!backend) return;
  const index: StoredIndex = { v: 2, nodes: nodes as unknown as Record<string, unknown> };
  pendingSave = backend.saveIndex(index).catch((e) => console.error('[vfs] save failed', e));
  await pendingSave;
}

function now() { return Date.now(); }

function dirNode(path: string, t = now()): FsNode {
  return { path, name: basename(path), kind: 'dir', size: 0, created: t, modified: t };
}

export class FsError extends Error {}

function ensureParents(nodes: Record<string, FsNode>, path: string) {
  const parts = normalize(path).split('/').filter(Boolean);
  let cur = '';
  for (let i = 0; i < parts.length - 1; i++) {
    cur += '/' + parts[i];
    const n = nodes[cur];
    if (!n) nodes[cur] = dirNode(cur);
    else if (n.kind !== 'dir') throw new FsError(`${cur} is not a directory`);
  }
}

function descendants(nodes: Record<string, FsNode>, path: string) {
  return Object.keys(nodes).filter((p) => isInside(p, path));
}

export const vfs = {
  async mount(backend: Backend, seed?: () => Promise<void>) {
    cache.clear();
    cacheBytes = 0;
    const idx = await backend.loadIndex();
    useVfs.setState({ backend, nodes: (idx?.nodes as Record<string, FsNode>) ?? {}, ready: false });
    const nodes = { ...get().nodes };
    for (const p of ['/', HOME, TRASH, '/System', APPDATA, '/Applications']) if (!nodes[p]) nodes[p] = dirNode(p);
    useVfs.setState({ nodes });
    if (!idx && seed) await seed();
    await persist();
    useVfs.setState({ ready: true });
  },

  async unmount() {
    await vfs.flush();
    cache.clear();
    cacheBytes = 0;
    useVfs.setState({ nodes: {}, ready: false, backend: null });
  },

  async flush() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
      await persist();
    }
    if (pendingSave) await pendingSave;
  },

  stat: (path: string): FsNode | undefined => get().nodes[normalize(path)],
  exists: (path: string) => !!get().nodes[normalize(path)],
  isDir: (path: string) => get().nodes[normalize(path)]?.kind === 'dir',

  list(path: string, nodes = get().nodes): FsNode[] {
    const dir = normalize(path);
    const prefix = dir === '/' ? '/' : dir + '/';
    const out: FsNode[] = [];
    for (const p in nodes) {
      if (p !== dir && p.startsWith(prefix) && !p.slice(prefix.length).includes('/')) out.push(nodes[p]);
    }
    return out.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name, undefined, { numeric: true }) : a.kind === 'dir' ? -1 : 1));
  },

  walk(path: string, nodes = get().nodes): FsNode[] {
    const dir = normalize(path);
    return Object.values(nodes).filter((n) => isInside(n.path, dir));
  },

  async readBytes(path: string): Promise<Uint8Array> {
    const node = vfs.stat(path);
    if (!node) throw new FsError(`No such file: ${path}`);
    if (node.kind === 'dir') throw new FsError(`${path} is a directory`);
    if (!node.blob) return new Uint8Array();
    const hit = cache.get(node.blob);
    if (hit) return hit;
    const backend = get().backend;
    if (!backend) throw new FsError('File system is locked');
    const data = (await backend.getBlob(node.blob)) ?? new Uint8Array();
    cachePut(node.blob, data);
    return data;
  },

  async readText(path: string): Promise<string> {
    return fromUtf8(await vfs.readBytes(path));
  },

  async readJSON<T>(path: string, fallback: T): Promise<T> {
    try {
      if (!vfs.exists(path)) return fallback;
      return JSON.parse(await vfs.readText(path)) as T;
    } catch {
      return fallback;
    }
  },

  async readBlob(path: string): Promise<Blob> {
    const node = vfs.stat(path);
    const bytes = await vfs.readBytes(path);
    return new Blob([bytes as BlobPart], { type: node?.mime || mimeOf(path) });
  },

  async objectUrl(path: string): Promise<string> {
    return URL.createObjectURL(await vfs.readBlob(path));
  },

  async writeBytes(path: string, data: Uint8Array, mime?: string): Promise<FsNode> {
    const p = normalize(path);
    const backend = get().backend;
    if (!backend) throw new FsError('File system is locked');
    const nodes = { ...get().nodes };
    const existing = nodes[p];
    if (existing?.kind === 'dir') throw new FsError(`${p} is a directory`);
    ensureParents(nodes, p);
    const id = existing?.blob ?? randomId(20);
    await backend.putBlob(id, data);
    cachePut(id, data);
    const t = now();
    const node: FsNode = {
      ...(existing ?? {}),
      path: p, name: basename(p), kind: 'file', mime: mime || existing?.mime || mimeOf(p),
      size: data.byteLength, blob: id, created: existing?.created ?? t, modified: t,
    };
    nodes[p] = node;
    const parent = nodes[dirname(p)];
    if (parent) nodes[dirname(p)] = { ...parent, modified: t };
    setNodes(nodes);
    return node;
  },

  writeText(path: string, text: string, mime?: string) {
    return vfs.writeBytes(path, utf8(text), mime);
  },

  writeJSON(path: string, value: unknown) {
    return vfs.writeText(path, JSON.stringify(value), 'application/json');
  },

  async mkdir(path: string) {
    const p = normalize(path);
    const nodes = { ...get().nodes };
    if (nodes[p]) {
      if (nodes[p].kind !== 'dir') throw new FsError(`${p} exists and is a file`);
      return nodes[p];
    }
    ensureParents(nodes, p);
    nodes[p] = dirNode(p);
    setNodes(nodes);
    return nodes[p];
  },

  /** Returns a non-colliding path inside `dir` for `name` ("file (2).txt"). */
  uniquePath(dir: string, name: string, nodes = get().nodes) {
    let candidate = join(dir, name);
    if (!nodes[candidate]) return candidate;
    const ext = extname(name);
    const base = stem(name);
    for (let i = 2; i < 10_000; i++) {
      candidate = join(dir, ext ? `${base} (${i}).${ext}` : `${base} (${i})`);
      if (!nodes[candidate]) return candidate;
    }
    return join(dir, `${base}-${randomId(4)}${ext ? '.' + ext : ''}`);
  },

  async move(src: string, dest: string, opts: { overwrite?: boolean } = {}) {
    const from = normalize(src);
    const to = normalize(dest);
    if (from === to) return to;
    if (from === '/' || isInside(to, from)) throw new FsError('Cannot move a folder into itself');
    const nodes = { ...get().nodes };
    const node = nodes[from];
    if (!node) throw new FsError(`No such file: ${from}`);
    if (nodes[to] && !opts.overwrite) throw new FsError(`${basename(to)} already exists`);
    if (nodes[to] && opts.overwrite) await vfs.deletePermanent([to]);
    const fresh = { ...get().nodes };
    ensureParents(fresh, to);
    const t = now();
    for (const p of [from, ...descendants(fresh, from)]) {
      const n = fresh[p];
      delete fresh[p];
      const np = to + p.slice(from.length);
      fresh[np] = { ...n, path: np, name: basename(np), ...(p === from ? { modified: t } : {}) };
    }
    setNodes(fresh);
    return to;
  },

  async rename(path: string, name: string) {
    return vfs.move(path, join(dirname(path), name));
  },

  async copy(src: string, dest: string) {
    const from = normalize(src);
    const to = normalize(dest);
    const node = vfs.stat(from);
    if (!node) throw new FsError(`No such file: ${from}`);
    if (node.kind === 'dir') {
      if (isInside(to, from)) throw new FsError('Cannot copy a folder into itself');
      await vfs.mkdir(to);
      for (const child of vfs.list(from)) await vfs.copy(child.path, join(to, child.name));
      return to;
    }
    const bytes = await vfs.readBytes(from);
    await vfs.writeBytes(to, bytes.slice(), node.mime);
    return to;
  },

  async trash(paths: string[]) {
    for (const raw of paths) {
      const p = normalize(raw);
      const node = vfs.stat(p);
      if (!node || p === '/' || p === HOME || p === TRASH) continue;
      if (isInside(p, TRASH)) { await vfs.deletePermanent([p]); continue; }
      const dest = vfs.uniquePath(TRASH, node.name);
      await vfs.move(p, dest);
      const nodes = { ...get().nodes };
      nodes[dest] = { ...nodes[dest], trashedFrom: p, trashedAt: now() };
      setNodes(nodes);
    }
  },

  async restore(trashPath: string) {
    const node = vfs.stat(trashPath);
    if (!node) return;
    const target = node.trashedFrom ?? join(HOME, node.name);
    const dest = vfs.exists(target) ? vfs.uniquePath(dirname(target), basename(target)) : target;
    await vfs.move(trashPath, dest);
    const nodes = { ...get().nodes };
    const { trashedFrom, trashedAt, ...rest } = nodes[dest];
    nodes[dest] = rest;
    setNodes(nodes);
    return dest;
  },

  async deletePermanent(paths: string[]) {
    const nodes = { ...get().nodes };
    const blobs: string[] = [];
    for (const raw of paths) {
      const p = normalize(raw);
      if (!nodes[p] || p === '/') continue;
      for (const q of [p, ...descendants(nodes, p)]) {
        const b = nodes[q]?.blob;
        if (b) { blobs.push(b); cache.delete(b); }
        delete nodes[q];
      }
    }
    setNodes(nodes);
    await get().backend?.delBlobs(blobs);
  },

  async emptyTrash() {
    await vfs.deletePermanent(vfs.list(TRASH).map((n) => n.path));
  },

  setStarred(path: string, starred: boolean) {
    const nodes = { ...get().nodes };
    if (!nodes[path]) return;
    nodes[path] = { ...nodes[path], starred };
    setNodes(nodes);
  },

  search(query: string, limit = 50): FsNode[] {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    const out: FsNode[] = [];
    for (const n of Object.values(get().nodes)) {
      if (n.path.startsWith('/System') || isInside(n.path, TRASH)) continue;
      if (n.name.toLowerCase().includes(q)) out.push(n);
    }
    return out
      .sort((a, b) => Number(b.name.toLowerCase().startsWith(q)) - Number(a.name.toLowerCase().startsWith(q)) || b.modified - a.modified)
      .slice(0, limit);
  },

  /** Full-text search over small text files (decrypts on demand). */
  async grep(query: string, root = HOME, limit = 30) {
    const q = query.toLowerCase();
    const results: { node: FsNode; line: string; lineNo: number }[] = [];
    for (const n of vfs.walk(root)) {
      if (n.kind !== 'file' || n.size > 512_000 || !isTextMime(n.mime)) continue;
      try {
        const lines = (await vfs.readText(n.path)).split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(q)) {
            results.push({ node: n, line: lines[i].trim().slice(0, 160), lineNo: i + 1 });
            break;
          }
        }
      } catch { /* skip */ }
      if (results.length >= limit) break;
    }
    return results;
  },

  usage() {
    let files = 0, dirs = 0, bytes = 0;
    const byKind: Record<string, number> = {};
    for (const n of Object.values(get().nodes)) {
      if (n.kind === 'dir') { dirs++; continue; }
      files++;
      bytes += n.size;
      const k = (n.mime || 'other').split('/')[0];
      byKind[k] = (byKind[k] ?? 0) + n.size;
    }
    return { files, dirs, bytes, byKind };
  },

  /** Raw export of everything (used for encrypted backups). */
  async exportAll() {
    const nodes = get().nodes;
    const blobs: Record<string, Uint8Array> = {};
    for (const n of Object.values(nodes)) {
      if (n.kind === 'file' && n.blob) blobs[n.blob] = await vfs.readBytes(n.path);
    }
    return { nodes, blobs };
  },

  async importAll(data: { nodes: Record<string, FsNode>; blobs: Record<string, Uint8Array> }, mode: 'merge' | 'replace') {
    if (mode === 'replace') {
      const all = Object.keys(get().nodes).filter((p) => p !== '/');
      await vfs.deletePermanent(all.filter((p) => dirname(p) === '/'));
    }
    const sorted = Object.values(data.nodes).sort((a, b) => a.path.length - b.path.length);
    for (const n of sorted) {
      if (n.path === '/') continue;
      if (n.kind === 'dir') { await vfs.mkdir(n.path); continue; }
      const dest = mode === 'merge' && vfs.exists(n.path) ? vfs.uniquePath(dirname(n.path), n.name) : n.path;
      await vfs.writeBytes(dest, n.blob ? data.blobs[n.blob] ?? new Uint8Array() : new Uint8Array(), n.mime);
    }
  },
};

export type Vfs = typeof vfs;
