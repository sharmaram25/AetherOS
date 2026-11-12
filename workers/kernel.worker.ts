
// AetherOS Kernel Worker
// Handles FS operations to keep the UI thread at 60fps

const DB_NAME = 'aether-os-db';
const STORE_NAME = 'files';

let dbInstance: IDBDatabase | null = null;

const initDB = (): Promise<IDBDatabase> => {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
};

const performOp = async (type: string, payload: any) => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, type === 'read' || type === 'readdir' ? 'readonly' : 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    let req;

    switch (type) {
      case 'read':
        req = store.get(payload.key);
        break;
      case 'write':
        req = store.put(payload.value, payload.key);
        break;
      case 'delete':
        req = store.delete(payload.key);
        break;
      case 'getAllKeys':
        req = store.getAllKeys();
        break;
      default:
        reject(new Error('Unknown operation'));
        return;
    }

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

self.onmessage = async (e) => {
  const { id, type, payload } = e.data;
  try {
    const result = await performOp(type, payload);
    self.postMessage({ id, status: 'success', result });
  } catch (error: any) {
    self.postMessage({ id, status: 'error', error: error.message });
  }
};
