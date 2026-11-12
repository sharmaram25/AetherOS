/**
 * Key management.
 *
 * A random 256-bit Data Encryption Key (DEK) encrypts everything the user stores.
 * The DEK itself is stored only in wrapped (encrypted) form:
 *   - mode "passphrase": wrapped by a key derived from the user's passphrase (PBKDF2, 600k).
 *   - mode "device":     wrapped by a non-extractable device key held by the browser.
 * Changing the passphrase re-wraps the DEK; no file needs to be re-encrypted.
 */
import { db } from './db';
import {
  decrypt, deriveKey, encrypt, fromB64, generateDeviceKey, importAesKey,
  PBKDF2_ITERATIONS, randomBytes, toB64, utf8, wipe, decryptJSON, encryptJSON,
} from './crypto';

export type VaultMode = 'passphrase' | 'device';

export interface VaultHeader {
  v: 2;
  mode: VaultMode;
  salt?: string;
  iter?: number;
  wrapped: string;
  hint?: string;
  createdAt: number;
  changedAt?: number;
}

const HEADER_KEY = 'vault:header';
const DEVICE_KEY = 'vault:device';
const DEK_AAD = utf8('aether:dek:v2');

export async function readHeader(): Promise<VaultHeader | null> {
  try {
    return (await db.get<VaultHeader>(HEADER_KEY)) ?? null;
  } catch {
    return null;
  }
}

async function wrapDek(raw: Uint8Array, passphrase: string | null, hint?: string, createdAt = Date.now()): Promise<VaultHeader> {
  if (passphrase) {
    const salt = randomBytes(16);
    const kek = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS);
    const wrapped = await encrypt(kek, raw, DEK_AAD);
    return { v: 2, mode: 'passphrase', salt: toB64(salt), iter: PBKDF2_ITERATIONS, wrapped: toB64(wrapped), hint: hint || undefined, createdAt, changedAt: Date.now() };
  }
  let device = await db.get<CryptoKey>(DEVICE_KEY);
  if (!device) {
    device = await generateDeviceKey();
    await db.put(DEVICE_KEY, device);
  }
  const wrapped = await encrypt(device, raw, DEK_AAD);
  return { v: 2, mode: 'device', wrapped: toB64(wrapped), createdAt, changedAt: Date.now() };
}

/** Create a brand-new vault. Returns the usable (non-extractable) DEK. */
export async function createVault(passphrase: string | null, hint?: string): Promise<CryptoKey> {
  const raw = randomBytes(32);
  try {
    const header = await wrapDek(raw, passphrase, hint);
    await db.put(HEADER_KEY, header);
    return await importAesKey(raw);
  } finally {
    wipe(raw);
  }
}

async function unwrapRaw(header: VaultHeader, passphrase?: string): Promise<Uint8Array> {
  if (header.mode === 'passphrase') {
    if (!passphrase) throw new Error('Passphrase required');
    const kek = await deriveKey(passphrase, fromB64(header.salt!), header.iter ?? PBKDF2_ITERATIONS);
    try {
      return await decrypt(kek, fromB64(header.wrapped), DEK_AAD);
    } catch {
      throw new Error('Incorrect passphrase');
    }
  }
  const device = await db.get<CryptoKey>(DEVICE_KEY);
  if (!device) throw new Error('Device key missing — this vault cannot be opened on this browser.');
  return decrypt(device, fromB64(header.wrapped), DEK_AAD);
}

export async function unlockVault(passphrase?: string): Promise<CryptoKey> {
  const header = await readHeader();
  if (!header) throw new Error('No vault');
  const raw = await unwrapRaw(header, passphrase);
  try {
    return await importAesKey(raw);
  } finally {
    wipe(raw);
  }
}

/** Set, change or remove the passphrase. Pass `next = null` to switch to device-key mode. */
export async function rekeyVault(current: string | undefined, next: string | null, hint?: string) {
  const header = await readHeader();
  if (!header) throw new Error('No vault');
  const raw = await unwrapRaw(header, current);
  try {
    const nh = await wrapDek(raw, next, hint, header.createdAt);
    await db.put(HEADER_KEY, nh);
    return nh;
  } finally {
    wipe(raw);
  }
}

export async function verifyPassphrase(passphrase: string) {
  const header = await readHeader();
  if (!header || header.mode !== 'passphrase') return true;
  try {
    const raw = await unwrapRaw(header, passphrase);
    wipe(raw);
    return true;
  } catch {
    return false;
  }
}

/* ---------- Brute-force throttling ---------- */
const LOCKOUT_KEY = 'aether.lockout';
interface Lockout { count: number; until: number }

export function getLockout(): Lockout {
  try {
    return JSON.parse(localStorage.getItem(LOCKOUT_KEY) || '') as Lockout;
  } catch {
    return { count: 0, until: 0 };
  }
}
export function registerFailure(): Lockout {
  const l = getLockout();
  const count = l.count + 1;
  const delay = count >= 3 ? Math.min(300_000, 5_000 * 2 ** (count - 3)) : 0;
  const next = { count, until: Date.now() + delay };
  localStorage.setItem(LOCKOUT_KEY, JSON.stringify(next));
  return next;
}
export function clearFailures() {
  localStorage.removeItem(LOCKOUT_KEY);
}

/* ---------- Storage backends ---------- */
export interface StoredIndex {
  v: 2;
  nodes: Record<string, unknown>;
}

export interface Backend {
  kind: 'encrypted' | 'memory';
  loadIndex(): Promise<StoredIndex | null>;
  saveIndex(index: StoredIndex): Promise<void>;
  getBlob(id: string): Promise<Uint8Array | null>;
  putBlob(id: string, data: Uint8Array): Promise<void>;
  delBlobs(ids: string[]): Promise<void>;
  /** Total ciphertext bytes stored (approximate). */
  usage(): Promise<number>;
}

const INDEX_KEY = 'fs:index';
const blobKey = (id: string) => `blob:${id}`;

export function encryptedBackend(dek: CryptoKey): Backend {
  return {
    kind: 'encrypted',
    async loadIndex() {
      const ct = await db.get<Uint8Array>(INDEX_KEY);
      if (!ct) return null;
      return decryptJSON<StoredIndex>(dek, ct, INDEX_KEY);
    },
    async saveIndex(index) {
      await db.put(INDEX_KEY, await encryptJSON(dek, index, INDEX_KEY));
    },
    async getBlob(id) {
      const ct = await db.get<Uint8Array>(blobKey(id));
      if (!ct) return null;
      return decrypt(dek, ct, utf8(blobKey(id)));
    },
    async putBlob(id, data) {
      await db.put(blobKey(id), await encrypt(dek, data, utf8(blobKey(id))));
    },
    async delBlobs(ids) {
      if (ids.length) await db.delMany(ids.map(blobKey));
    },
    async usage() {
      try {
        const est = await navigator.storage?.estimate?.();
        return est?.usage ?? 0;
      } catch {
        return 0;
      }
    },
  };
}

/** Guest sessions: everything lives in RAM and disappears when the tab closes or the session ends. */
export function memoryBackend(): Backend {
  let index: StoredIndex | null = null;
  const blobs = new Map<string, Uint8Array>();
  return {
    kind: 'memory',
    async loadIndex() { return index; },
    async saveIndex(i) { index = i; },
    async getBlob(id) { return blobs.get(id) ?? null; },
    async putBlob(id, data) { blobs.set(id, data); },
    async delBlobs(ids) { ids.forEach((i) => blobs.delete(i)); },
    async usage() { let n = 0; blobs.forEach((b) => (n += b.byteLength)); return n; },
  };
}

export async function destroyEverything() {
  await db.destroy();
  const keep = ['aether.public'];
  Object.keys(localStorage).filter((k) => k.startsWith('aether') && !keep.includes(k)).forEach((k) => localStorage.removeItem(k));
  try {
    const names = await caches.keys();
    await Promise.all(names.map((n) => caches.delete(n)));
  } catch { /* ignore */ }
}
