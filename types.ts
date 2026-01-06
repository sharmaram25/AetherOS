
import { ReactNode } from 'react';

export type AppId = 'aether-text' | 'system-monitor' | 'terminal' | 'wormhole' | 'image-filter' | 'cortex' | 'settings' | 'files' | 'abacus' | 'chronos' | 'lens' | 'epoch' | 'scribe' | 'grid' | 'slides';

export interface AppProps {
  windowId: string;
  isFocused: boolean;
  initialData?: any; // For opening files (e.g. { filePath: '/home/doc.txt' })
}

export interface WindowState {
  id: string;
  appId: AppId;
  title: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
  data?: any;
}

export interface AppConfig {
  id: AppId;
  title: string;
  icon: ReactNode;
  component: React.LazyExoticComponent<React.ComponentType<AppProps>>;
  defaultWidth: number;
  defaultHeight: number;
  isSingleInstance?: boolean;
}

export enum FileType {
  FILE = 'FILE',
  DIRECTORY = 'DIRECTORY',
}

export interface FileNode {
  name: string;
  type: FileType;
  path: string;
  content?: string; // Only for files
  createdAt: number;
  updatedAt: number;
}

export interface IFileSystem {
  files: Record<string, FileNode>;
  init: () => Promise<void>;
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  mkdir: (path: string) => Promise<void>;
  readdir: (path: string) => FileNode[];
  deleteFile: (path: string) => Promise<void>;
}
