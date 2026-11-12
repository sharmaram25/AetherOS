import { memo } from 'react';
import { FileText, FileCode2, Music, Video, Sheet, FileArchive, Lock, Calendar, File, Puzzle, Star, FileType2 } from 'lucide-react';
import { vfs, type FsNode } from '../kernel/vfs';
import { kindOf, type FileKind } from '../lib/mime';
import { extname, TRASH, HOME } from '../lib/path';
import { useObjectUrl } from '../ui';

const KIND_STYLE: Record<FileKind, { icon: typeof File; color: string }> = {
  folder: { icon: File, color: '#38bdf8' },
  text: { icon: FileText, color: '#94a3b8' },
  markdown: { icon: FileType2, color: '#f59e0b' },
  code: { icon: FileCode2, color: '#8b5cf6' },
  image: { icon: File, color: '#ec4899' },
  audio: { icon: Music, color: '#f43f5e' },
  video: { icon: Video, color: '#a855f7' },
  sheet: { icon: Sheet, color: '#22c55e' },
  pdf: { icon: FileText, color: '#ef4444' },
  archive: { icon: FileArchive, color: '#eab308' },
  app: { icon: Puzzle, color: '#6366f1' },
  sealed: { icon: Lock, color: '#14b8a6' },
  calendar: { icon: Calendar, color: '#ef4444' },
  unknown: { icon: File, color: '#64748b' },
};

function FolderGlyph({ size, special }: { size: number; special?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="drop-shadow-[0_3px_6px_rgba(0,0,0,0.3)]">
      <defs>
        <linearGradient id="fg-back" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3b9cf0" /><stop offset="1" stopColor="#1d6fd1" /></linearGradient>
        <linearGradient id="fg-front" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7cc4ff" /><stop offset="1" stopColor="#3a95f0" /></linearGradient>
      </defs>
      <path d="M6 16a4 4 0 0 1 4-4h14l5 5h25a4 4 0 0 1 4 4v29a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V16Z" fill="url(#fg-back)" />
      <path d="M6 24a4 4 0 0 1 4-4h44a4 4 0 0 1 4 4v26a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V24Z" fill="url(#fg-front)" />
      <path d="M6 24a4 4 0 0 1 4-4h44a4 4 0 0 1 4 4v1H6v-1Z" fill="#fff" opacity="0.35" />
      {special && <text x="32" y="44" textAnchor="middle" fontSize="16" fill="#1e5fb3" opacity="0.75" fontFamily="system-ui" fontWeight="700">{special}</text>}
    </svg>
  );
}

const SPECIAL: Record<string, string> = {
  [`${HOME}/Documents`]: '≡', [`${HOME}/Downloads`]: '↓', [`${HOME}/Pictures`]: '◉', [`${HOME}/Music`]: '♪',
  [`${HOME}/Videos`]: '▶', [`${HOME}/Notes`]: '✎', [`${HOME}/Projects`]: '</>', [`${HOME}/Desktop`]: '▭', [TRASH]: '🗑',
};

function Thumb({ node, size }: { node: FsNode; size: number }) {
  const url = useObjectUrl(node.size < 4_000_000 ? () => vfs.objectUrl(node.path) : null, [node.path, node.modified]);
  if (!url) return <DocGlyph node={node} size={size} kind="image" />;
  return (
    <div className="rounded-lg overflow-hidden bg-white/10 shadow-[0_3px_8px_rgba(0,0,0,0.35)] ring-2 ring-white/80" style={{ width: size * 0.92, height: size * 0.72 }}>
      <img src={url} className="w-full h-full object-cover" draggable={false} alt="" />
    </div>
  );
}

function DocGlyph({ node, size, kind }: { node: FsNode; size: number; kind: FileKind }) {
  const st = KIND_STYLE[kind];
  const Icon = st.icon;
  const ext = extname(node.name).slice(0, 4).toUpperCase();
  return (
    <div className="relative drop-shadow-[0_3px_6px_rgba(0,0,0,0.3)]" style={{ width: size * 0.78, height: size }}>
      <svg viewBox="0 0 48 62" className="absolute inset-0 w-full h-full">
        <path d="M4 4a4 4 0 0 1 4-4h24l12 12v46a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V4Z" fill="#fbfcff" />
        <path d="M32 0v8a4 4 0 0 0 4 4h8" fill="#dfe4ee" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 pt-1">
        <Icon size={size * 0.34} style={{ color: st.color }} strokeWidth={2} />
        {ext && <span className="font-bold tracking-wide" style={{ fontSize: Math.max(7, size * 0.14), color: st.color }}>{ext}</span>}
      </div>
    </div>
  );
}

export const FileIcon = memo(function FileIcon({ node, size = 48 }: { node: FsNode; size?: number }) {
  const kind = kindOf(node.path, node.kind === 'dir');
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {kind === 'folder' ? <FolderGlyph size={size} special={size >= 40 ? SPECIAL[node.path] : undefined} />
        : kind === 'image' ? <Thumb node={node} size={size} />
        : <DocGlyph node={node} size={size * 0.92} kind={kind} />}
      {node.starred && <Star size={Math.max(10, size * 0.22)} className="absolute -top-0.5 -right-0.5 text-amber-400 fill-amber-400 drop-shadow" />}
    </div>
  );
});
