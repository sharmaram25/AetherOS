/** Minimal promise-based IndexedDB key-value store. All values written here are ciphertext. */

const DB_NAME = 'aether-v2';
const STORE = 'kv';
let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => { db.close(); dbPromise = null; };
      resolve(db);
    };
    req.onerror = () => { dbPromise = null; reject(req.error); };
  });
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const store = tx.objectStore(STORE);
        const req = fn(store);
        let result: T;
        if (req) req.onsuccess = () => { result = req.result; };
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

export const db = {
  get: <T = unknown>(key: string) => run<T>('readonly', (s) => s.get(key) as IDBRequest<T>),
  put: (key: string, value: unknown) => run<IDBValidKey>('readwrite', (s) => s.put(value, key)),
  del: (key: string) => run<undefined>('readwrite', (s) => s.delete(key)),
  keys: () => run<IDBValidKey[]>('readonly', (s) => s.getAllKeys()),
  putMany: (entries: [string, unknown][]) =>
    run<void>('readwrite', (s) => { for (const [k, v] of entries) s.put(v, k); }),
  delMany: (keys: string[]) => run<void>('readwrite', (s) => { for (const k of keys) s.delete(k); }),
  async clear() {
    await run<undefined>('readwrite', (s) => s.clear());
  },
  async destroy() {
    const d = await open().catch(() => null);
    d?.close();
    dbPromise = null;
    await new Promise<void>((res) => {
      const r = indexedDB.deleteDatabase(DB_NAME);
      r.onsuccess = r.onerror = r.onblocked = () => res();
    });
  },
};

/** Read files from AetherOS v1 (unencrypted) so users can migrate on first setup. */
export async function readLegacyV1(): Promise<{ path: string; content: string }[]> {
  try {
    const dbs = (await (indexedDB as any).databases?.()) as { name: string }[] | undefined;
    if (dbs && !dbs.some((d) => d.name === 'aether-os-db')) return [];
    return await new Promise((resolve) => {
      const req = indexedDB.open('aether-os-db');
      req.onupgradeneeded = () => { req.transaction?.abort(); resolve([]); };
      req.onerror = () => resolve([]);
      req.onsuccess = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains('files')) { d.close(); return resolve([]); }
        const all = d.transaction('files', 'readonly').objectStore('files').getAll();
        all.onsuccess = () => {
          const out = (all.result as any[])
            .filter((n) => n && n.type === 'FILE' && typeof n.content === 'string' && typeof n.path === 'string')
            .map((n) => ({ path: n.path as string, content: n.content as string }));
          d.close();
          resolve(out);
        };
        all.onerror = () => { d.close(); resolve([]); };
      };
    });
  } catch {
    return [];
  }
}

export async function deleteLegacyV1() {
  await new Promise<void>((res) => {
    const r = indexedDB.deleteDatabase('aether-os-db');
    r.onsuccess = r.onerror = r.onblocked = () => res();
  });
}
