import { extname } from './path';

const MAP: Record<string, string> = {
  txt: 'text/plain', md: 'text/markdown', markdown: 'text/markdown', log: 'text/plain',
  js: 'text/javascript', mjs: 'text/javascript', jsx: 'text/javascript', ts: 'text/typescript', tsx: 'text/typescript',
  json: 'application/json', html: 'text/html', htm: 'text/html', css: 'text/css', xml: 'application/xml',
  py: 'text/x-python', sh: 'text/x-sh', yml: 'text/yaml', yaml: 'text/yaml', toml: 'text/plain', ini: 'text/plain',
  csv: 'text/csv', tsv: 'text/tab-separated-values', ics: 'text/calendar', svg: 'image/svg+xml',
  c: 'text/x-c', cpp: 'text/x-c', h: 'text/x-c', rs: 'text/x-rust', go: 'text/x-go', java: 'text/x-java', sql: 'text/x-sql',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', avif: 'image/avif', ico: 'image/x-icon',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg', m4a: 'audio/mp4', flac: 'audio/flac', aac: 'audio/aac', opus: 'audio/opus',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mkv: 'video/x-matroska', ogv: 'video/ogg',
  pdf: 'application/pdf', zip: 'application/zip', aether: 'application/x-aether-backup', aetherapp: 'application/x-aether-app',
  sealed: 'application/x-aether-sealed', sheet: 'application/x-aether-sheet', paint: 'image/png',
};

export function mimeOf(path: string): string {
  return MAP[extname(path)] ?? 'application/octet-stream';
}

export function isTextMime(mime = '') {
  return mime.startsWith('text/') || ['application/json', 'application/xml', 'image/svg+xml', 'application/x-aether-app', 'application/x-aether-sheet', 'application/x-aether-sealed'].includes(mime);
}
export const isImageMime = (m = '') => m.startsWith('image/');
export const isAudioMime = (m = '') => m.startsWith('audio/');
export const isVideoMime = (m = '') => m.startsWith('video/');

export type FileKind = 'folder' | 'text' | 'markdown' | 'code' | 'image' | 'audio' | 'video' | 'sheet' | 'pdf' | 'archive' | 'app' | 'sealed' | 'calendar' | 'unknown';

const CODE = new Set(['js', 'mjs', 'jsx', 'ts', 'tsx', 'json', 'html', 'htm', 'css', 'py', 'sh', 'yml', 'yaml', 'xml', 'c', 'cpp', 'h', 'rs', 'go', 'java', 'sql', 'toml', 'ini']);

export function kindOf(path: string, isDir = false): FileKind {
  if (isDir) return 'folder';
  const ext = extname(path);
  if (ext === 'md' || ext === 'markdown') return 'markdown';
  if (CODE.has(ext)) return 'code';
  if (ext === 'csv' || ext === 'tsv' || ext === 'sheet') return 'sheet';
  if (ext === 'aetherapp') return 'app';
  if (ext === 'sealed') return 'sealed';
  if (ext === 'ics') return 'calendar';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'zip' || ext === 'aether') return 'archive';
  const m = mimeOf(path);
  if (isImageMime(m)) return 'image';
  if (isAudioMime(m)) return 'audio';
  if (isVideoMime(m)) return 'video';
  if (isTextMime(m)) return 'text';
  return 'unknown';
}

export function formatBytes(n: number): string {
  if (!isFinite(n) || n <= 0) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : n / 1024 ** i < 10 ? 1 : 0)} ${u[i]}`;
}
