import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { create } from 'zustand';
import {
  FolderOpen, NotebookPen, CodeXml, SquareTerminal, KeyRound, CalendarDays, SquareKanban, Calculator,
  Clock, Images, Disc3, Brush, Camera, Activity, Sheet, Sparkles, ShieldCheck, Settings, LayoutGrid,
  FileText, AppWindow, type LucideIcon,
} from 'lucide-react';
import type { Win } from './windows';
import type { Perm } from './privacy';

export interface AppProps { win: Win }

export type AppCategory = 'Productivity' | 'Creativity' | 'Media' | 'Utilities' | 'Privacy' | 'Developer' | 'System' | 'Installed';

export interface AppDef {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon | string;
  gradient: [string, string];
  component: LazyExoticComponent<ComponentType<AppProps>>;
  width: number;
  height: number;
  minW?: number;
  minH?: number;
  single?: boolean;
  category: AppCategory;
  keywords?: string[];
  hidden?: boolean;
  external?: boolean;
}

const A = (
  id: string, name: string, icon: LucideIcon, gradient: [string, string], loader: () => Promise<{ default: ComponentType<AppProps> }>,
  o: Partial<AppDef> & { description: string; category: AppCategory },
): AppDef => ({ id, name, icon, gradient, component: lazy(loader), width: 900, height: 620, ...o });

export const APPS: AppDef[] = [
  A('files', 'Files', FolderOpen, ['#3b82f6', '#06b6d4'], () => import('../apps/Files'), {
    description: 'Browse, import and organize your encrypted files', category: 'System', width: 980, height: 640, keywords: ['finder', 'explorer', 'folder'],
  }),
  A('notes', 'Notes', NotebookPen, ['#f59e0b', '#f97316'], () => import('../apps/Notes'), {
    description: 'Markdown notes with live preview', category: 'Productivity', single: true, width: 1040, height: 680, keywords: ['markdown', 'write', 'journal'],
  }),
  A('code', 'Code', CodeXml, ['#6366f1', '#8b5cf6'], () => import('../apps/Code'), {
    description: 'Code editor with syntax highlighting, tabs and sandboxed run', category: 'Developer', single: true, width: 1100, height: 720, keywords: ['editor', 'ide', 'text'],
  }),
  A('terminal', 'Terminal', SquareTerminal, ['#1f2937', '#4b5563'], () => import('../apps/Terminal'), {
    description: 'A real shell for the Aether file system', category: 'Developer', width: 760, height: 480, keywords: ['shell', 'console', 'bash', 'cli'],
  }),
  A('keychain', 'Keychain', KeyRound, ['#10b981', '#059669'], () => import('../apps/Keychain'), {
    description: 'Password manager with 2FA codes and security audit', category: 'Privacy', single: true, width: 980, height: 640, keywords: ['password', 'vault', 'totp', '2fa', 'secret'],
  }),
  A('calendar', 'Calendar', CalendarDays, ['#ef4444', '#f43f5e'], () => import('../apps/Calendar'), {
    description: 'Events, reminders and .ics import/export', category: 'Productivity', single: true, width: 1060, height: 700, keywords: ['events', 'schedule', 'agenda'],
  }),
  A('tasks', 'Tasks', SquareKanban, ['#0ea5e9', '#6366f1'], () => import('../apps/Tasks'), {
    description: 'Kanban boards and to-do lists', category: 'Productivity', single: true, width: 1060, height: 660, keywords: ['todo', 'kanban', 'board'],
  }),
  A('sheets', 'Sheets', Sheet, ['#16a34a', '#65a30d'], () => import('../apps/Sheets'), {
    description: 'Spreadsheets with formulas and CSV', category: 'Productivity', width: 1060, height: 660, keywords: ['excel', 'spreadsheet', 'csv', 'table'],
  }),
  A('photos', 'Photos', Images, ['#ec4899', '#8b5cf6'], () => import('../apps/Photos'), {
    description: 'Library, viewer and editor — strips hidden metadata', category: 'Media', single: true, width: 1060, height: 700, keywords: ['image', 'gallery', 'picture'],
  }),
  A('media', 'Media', Disc3, ['#f43f5e', '#a855f7'], () => import('../apps/Media'), {
    description: 'Music and video player with visualizer', category: 'Media', single: true, width: 880, height: 580, keywords: ['music', 'video', 'audio', 'player'],
  }),
  A('paint', 'Canvas', Brush, ['#f97316', '#ec4899'], () => import('../apps/Paint'), {
    description: 'Sketch and paint', category: 'Creativity', width: 1000, height: 680, keywords: ['draw', 'paint', 'sketch'],
  }),
  A('camera', 'Camera', Camera, ['#334155', '#0f172a'], () => import('../apps/Camera'), {
    description: 'Photos and video, saved straight to your encrypted library', category: 'Media', single: true, width: 760, height: 580, keywords: ['webcam', 'photo', 'record'],
  }),
  A('cortex', 'Cortex', Sparkles, ['#8b5cf6', '#06b6d4'], () => import('../apps/Cortex'), {
    description: 'On-device AI assistant — nothing leaves your machine', category: 'Productivity', single: true, width: 760, height: 680, keywords: ['ai', 'assistant', 'chat', 'llm'],
  }),
  A('calculator', 'Calculator', Calculator, ['#f97316', '#eab308'], () => import('../apps/Calculator'), {
    description: 'Standard, scientific and programmer modes', category: 'Utilities', single: true, width: 380, height: 580, minW: 320, keywords: ['math'],
  }),
  A('clock', 'Clock', Clock, ['#0f172a', '#334155'], () => import('../apps/Clock'), {
    description: 'World clock, alarms, timers and focus sessions', category: 'Utilities', single: true, width: 640, height: 560, keywords: ['timer', 'alarm', 'stopwatch', 'pomodoro', 'focus'],
  }),
  A('monitor', 'Monitor', Activity, ['#22c55e', '#0ea5e9'], () => import('../apps/Monitor'), {
    description: 'Live system resources and processes', category: 'System', single: true, width: 820, height: 600, keywords: ['task manager', 'cpu', 'memory', 'process'],
  }),
  A('shield', 'Shield', ShieldCheck, ['#14b8a6', '#3b82f6'], () => import('../apps/Shield'), {
    description: 'Privacy center: encryption, permissions, network log', category: 'Privacy', single: true, width: 980, height: 680, keywords: ['privacy', 'security', 'permissions', 'network'],
  }),
  A('store', 'App Center', LayoutGrid, ['#6366f1', '#ec4899'], () => import('../apps/Store'), {
    description: 'Install sandboxed apps and build your own', category: 'System', single: true, width: 1000, height: 680, keywords: ['store', 'apps', 'sdk', 'install', 'developer'],
  }),
  A('settings', 'Settings', Settings, ['#64748b', '#334155'], () => import('../apps/Settings'), {
    description: 'Personalize and configure AetherOS', category: 'System', single: true, width: 940, height: 640, keywords: ['preferences', 'config', 'wallpaper', 'theme'],
  }),
  A('preview', 'Preview', FileText, ['#0ea5e9', '#22d3ee'], () => import('../apps/Preview'), {
    description: 'Quick look at PDFs and other documents', category: 'Utilities', width: 860, height: 680, hidden: true,
  }),
  A('sandbox', 'App', AppWindow, ['#6366f1', '#8b5cf6'], () => import('../apps/SandboxHost'), {
    description: 'Sandboxed app host', category: 'Installed', hidden: true,
  }),
];

const BY_ID = new Map(APPS.map((a) => [a.id, a]));

/* ---------- Installed (sandboxed) apps ---------- */
export interface ExtManifest {
  id: string;
  name: string;
  description?: string;
  author?: string;
  version?: string;
  icon: string;
  color: string;
  permissions: Perm[];
  width?: number;
  height?: number;
  html: string;
  builtin?: boolean;
}

export const useExtApps = create<{ apps: Record<string, Omit<ExtManifest, 'html'> & { path: string }> }>(() => ({ apps: {} }));

const SandboxComponent = BY_ID.get('sandbox')!.component;

export function getApp(id: string): AppDef | undefined {
  const s = BY_ID.get(id);
  if (s) return s;
  if (id.startsWith('ext:')) {
    const m = useExtApps.getState().apps[id.slice(4)];
    if (!m) return undefined;
    return {
      id, name: m.name, description: m.description ?? 'Sandboxed app', icon: m.icon, gradient: [m.color, m.color],
      component: SandboxComponent, width: m.width ?? 720, height: m.height ?? 520, category: 'Installed', single: true, external: true,
    };
  }
  return undefined;
}

export function allApps(includeHidden = false): AppDef[] {
  const ext = Object.keys(useExtApps.getState().apps).map((id) => getApp('ext:' + id)!).filter(Boolean);
  return [...APPS.filter((a) => includeHidden || !a.hidden), ...ext];
}
