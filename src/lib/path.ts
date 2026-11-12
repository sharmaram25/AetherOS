export const HOME = '/home';
export const TRASH = '/Trash';
export const APPDATA = '/System/AppData';
export const APPS_DIR = '/Applications';

export function normalize(p: string): string {
  const parts: string[] = [];
  for (const seg of p.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  return '/' + parts.join('/');
}

export function resolve(cwd: string, p: string): string {
  if (!p) return normalize(cwd);
  if (p === '~') return HOME;
  if (p.startsWith('~/')) return normalize(HOME + p.slice(1));
  if (p.startsWith('/')) return normalize(p);
  return normalize(cwd + '/' + p);
}

export const join = (...parts: string[]) => normalize(parts.join('/'));

export function dirname(p: string): string {
  const n = normalize(p);
  if (n === '/') return '/';
  const i = n.lastIndexOf('/');
  return i <= 0 ? '/' : n.slice(0, i);
}

export function basename(p: string): string {
  const n = normalize(p);
  return n === '/' ? '/' : n.slice(n.lastIndexOf('/') + 1);
}

export function extname(p: string): string {
  const b = basename(p);
  const i = b.lastIndexOf('.');
  return i > 0 ? b.slice(i + 1).toLowerCase() : '';
}

export function stem(p: string): string {
  const b = basename(p);
  const i = b.lastIndexOf('.');
  return i > 0 ? b.slice(0, i) : b;
}

export function isInside(child: string, parent: string): boolean {
  if (parent === '/') return child !== '/';
  return child.startsWith(parent + '/');
}

export function prettyPath(p: string): string {
  if (p === HOME) return '~';
  if (p.startsWith(HOME + '/')) return '~' + p.slice(HOME.length);
  return p;
}

export function validName(name: string): string | null {
  if (!name.trim()) return 'Name cannot be empty';
  if (name.includes('/')) return 'Name cannot contain “/”';
  if (name === '.' || name === '..') return 'Reserved name';
  if (name.length > 200) return 'Name is too long';
  return null;
}
