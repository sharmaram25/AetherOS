/**
 * AetherOS cryptography primitives — thin, audited-by-eye wrappers over WebCrypto.
 *
 *  - Data is encrypted with AES-256-GCM using a random 96-bit IV per record.
 *  - Keys are derived from passphrases with PBKDF2-SHA-256 (600k iterations, OWASP 2023+).
 *  - Nothing in this file ever touches the network or persistent storage.
 */

export const PBKDF2_ITERATIONS = 600_000;
const subtle = globalThis.crypto.subtle;

const enc = new TextEncoder();
const dec = new TextDecoder();

export const utf8 = (s: string) => enc.encode(s);
export const fromUtf8 = (b: ArrayBuffer | Uint8Array) => dec.decode(b);

export function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(n));
  crypto.getRandomValues(out);
  return out;
}

export function randomId(len = 16): string {
  const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
  const bytes = randomBytes(len);
  let s = '';
  for (let i = 0; i < len; i++) s += alphabet[bytes[i] % alphabet.length];
  return s;
}

export function toB64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as unknown as number[]);
  }
  return btoa(bin);
}

export function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Copy into a fresh ArrayBuffer-backed view (WebCrypto wants BufferSource without SharedArrayBuffer). */
function buf(data: Uint8Array): Uint8Array<ArrayBuffer> {
  if (data.buffer instanceof ArrayBuffer && data.byteOffset === 0 && data.byteLength === data.buffer.byteLength) {
    return data as Uint8Array<ArrayBuffer>;
  }
  const copy = new Uint8Array(new ArrayBuffer(data.byteLength));
  copy.set(data);
  return copy;
}

export async function deriveKey(passphrase: string, salt: Uint8Array, iterations = PBKDF2_ITERATIONS): Promise<CryptoKey> {
  const base = await subtle.importKey('raw', buf(utf8(passphrase.normalize('NFKC'))), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'PBKDF2', salt: buf(salt), iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function importAesKey(raw: Uint8Array, extractable = false): Promise<CryptoKey> {
  return subtle.importKey('raw', buf(raw), { name: 'AES-GCM', length: 256 }, extractable, ['encrypt', 'decrypt']);
}

export async function generateDeviceKey(): Promise<CryptoKey> {
  // Non-extractable: the raw key material can never be read by script, only used.
  return subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/** Encrypt → [12-byte IV | ciphertext+tag] */
export async function encrypt(key: CryptoKey, data: Uint8Array, aad?: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  const iv = randomBytes(12);
  const params: AesGcmParams = { name: 'AES-GCM', iv };
  if (aad) params.additionalData = buf(aad);
  const ct = new Uint8Array(await subtle.encrypt(params, key, buf(data)));
  const out = new Uint8Array(new ArrayBuffer(12 + ct.length));
  out.set(iv, 0);
  out.set(ct, 12);
  return out;
}

export async function decrypt(key: CryptoKey, blob: Uint8Array, aad?: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  const b = buf(blob);
  const iv = b.slice(0, 12);
  const ct = b.slice(12);
  const params: AesGcmParams = { name: 'AES-GCM', iv };
  if (aad) params.additionalData = buf(aad);
  return new Uint8Array(await subtle.decrypt(params, key, ct));
}

export async function encryptJSON(key: CryptoKey, value: unknown, aad?: string) {
  return encrypt(key, utf8(JSON.stringify(value)), aad ? utf8(aad) : undefined);
}

export async function decryptJSON<T>(key: CryptoKey, blob: Uint8Array, aad?: string): Promise<T> {
  return JSON.parse(fromUtf8(await decrypt(key, blob, aad ? utf8(aad) : undefined))) as T;
}

export async function sha256(data: Uint8Array | string): Promise<string> {
  const bytes = typeof data === 'string' ? utf8(data) : data;
  return toHex(new Uint8Array(await subtle.digest('SHA-256', buf(bytes))));
}

export async function hmac(alg: 'SHA-1' | 'SHA-256' | 'SHA-512', key: Uint8Array, msg: Uint8Array) {
  const k = await subtle.importKey('raw', buf(key), { name: 'HMAC', hash: alg }, false, ['sign']);
  return new Uint8Array(await subtle.sign('HMAC', k, buf(msg)));
}

/** Constant-time-ish comparison for short secrets. */
export function safeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a[i] ^ b[i];
  return r === 0;
}

/** Best-effort wipe of sensitive buffers we own. */
export function wipe(...arrs: (Uint8Array | undefined | null)[]) {
  for (const a of arrs) if (a) a.fill(0);
}

/** Password-based sealing used for portable encrypted backups and `seal` in the terminal. */
export async function sealWithPassword(password: string, data: Uint8Array) {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt);
  const body = await encrypt(key, data);
  return { v: 1, kdf: 'PBKDF2-SHA256', iter: PBKDF2_ITERATIONS, salt: toB64(salt), data: toB64(body) };
}

export type Sealed = Awaited<ReturnType<typeof sealWithPassword>>;

export async function openWithPassword(password: string, sealed: Sealed) {
  const key = await deriveKey(password, fromB64(sealed.salt), sealed.iter);
  return decrypt(key, fromB64(sealed.data));
}
