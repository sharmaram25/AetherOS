
import { create } from 'zustand';
import { IFileSystem, FileNode, FileType } from '../types';

interface FileSystemState extends IFileSystem {
  isInitialized: boolean;
}

const DEFAULT_FS: Record<string, FileNode> = {
  '/': { name: '', type: FileType.DIRECTORY, path: '/', createdAt: Date.now(), updatedAt: Date.now() },
  '/home': { name: 'home', type: FileType.DIRECTORY, path: '/home', createdAt: Date.now(), updatedAt: Date.now() },
  '/home/user': { name: 'user', type: FileType.DIRECTORY, path: '/home/user', createdAt: Date.now(), updatedAt: Date.now() },
  '/home/user/documents': { name: 'documents', type: FileType.DIRECTORY, path: '/home/user/documents', createdAt: Date.now(), updatedAt: Date.now() },
  '/home/user/documents/manifesto.txt': { 
    name: 'manifesto.txt', 
    type: FileType.FILE, 
    path: '/home/user/documents/manifesto.txt', 
    content: 'AetherOS: Weightless Computing.\n\nEverything is fluid. Everything is alive.',
    createdAt: Date.now(), 
    updatedAt: Date.now() 
  },
};

// Lazy initialization of the worker to prevent top-level crashes
let workerInstance: Worker | null = null;

const getWorker = () => {
  if (workerInstance) return workerInstance;
  
  try {
    // Check if import.meta.url is available, otherwise allow fallbacks or silent fail
    const baseUrl = import.meta.url;
    if (baseUrl) {
        workerInstance = new Worker(new URL('../workers/kernel.worker.ts', baseUrl), { type: 'module' });
    } else {
        console.warn("FileSystem: import.meta.url unavailable, running in in-memory mode.");
    }
  } catch (e) {
    console.warn("FileSystem: Worker initialization failed. Falling back to memory.", e);
  }
  return workerInstance;
};

const requestWorker = (type: string, payload: any): Promise<any> => {
  return new Promise((resolve, reject) => {
    const worker = getWorker();
    
    if (!worker) {
        // Fallback: If worker fails, just resolve null (or could implement in-mem logic here)
        // For now, we resolve null to let the UI load empty instead of crashing.
        resolve(null); 
        return;
    }

    const id = Math.random().toString(36).substring(7);
    const handler = (e: MessageEvent) => {
      if (e.data.id === id) {
        worker.removeEventListener('message', handler);
        if (e.data.status === 'success') resolve(e.data.result);
        else reject(new Error(e.data.error));
      }
    };
    worker.addEventListener('message', handler);
    worker.postMessage({ id, type, payload });
  });
};

export const useFileSystem = create<FileSystemState>((set, get) => ({
  files: {},
  isInitialized: false,

  init: async () => {
    if (get().isInitialized) return;

    try {
      const keys = await requestWorker('getAllKeys', {});
      if (!keys || keys.length === 0) {
        // Seed
        for (const [path, node] of Object.entries(DEFAULT_FS)) {
          await requestWorker('write', { key: path, value: node });
        }
        set({ files: DEFAULT_FS, isInitialized: true });
      } else {
        // Load Cache
        const newFiles: Record<string, FileNode> = {};
        for (const key of keys) {
           const node = await requestWorker('read', { key: key.toString() });
           if (node) newFiles[key.toString()] = node;
        }
        set({ files: newFiles, isInitialized: true });
      }
    } catch (error) {
      console.error("Kernel Panic:", error);
      // Fallback to default FS in memory if worker fails entirely
      set({ files: DEFAULT_FS, isInitialized: true });
    }
  },

  readFile: async (path: string) => {
    // Fast path: read from memory cache
    const node = get().files[path];
    if (node && node.type === FileType.FILE && node.content) return node.content;

    // Slow path: read from worker
    const dbNode = await requestWorker('read', { key: path });
    if (!dbNode) throw new Error('File not found');
    return dbNode.content;
  },

  writeFile: async (path: string, content: string) => {
    const name = path.split('/').pop() || 'untitled';
    const newNode: FileNode = {
      name,
      type: FileType.FILE,
      path,
      content,
      createdAt: get().files[path]?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    // Optimistic UI Update
    set({ files: { ...get().files, [path]: newNode } });
    
    // Async Worker Write
    await requestWorker('write', { key: path, value: newNode });
  },

  mkdir: async (path: string) => {
    const name = path.split('/').pop() || 'untitled';
    const newNode: FileNode = {
      name,
      type: FileType.DIRECTORY,
      path,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    set({ files: { ...get().files, [path]: newNode } });
    await requestWorker('write', { key: path, value: newNode });
  },

  readdir: (path: string) => {
    const allFiles = get().files;
    const cleanPath = path === '/' ? '' : path;
    return Object.values(allFiles).filter(node => {
        if (node.path === path) return false;
        if (!node.path.startsWith(cleanPath + '/')) return false;
        const relative = node.path.substring(cleanPath.length + 1);
        return !relative.includes('/');
    });
  },

  deleteFile: async (path: string) => {
    const { files } = get();
    const newFiles = { ...files };
    delete newFiles[path];
    set({ files: newFiles });
    await requestWorker('delete', { key: path });
  }
}));
