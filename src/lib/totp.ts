import { hmac } from '../kernel/crypto';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Decode(input: string): Uint8Array {
  const s = input.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const c of s) {
    value = (value << 5) | B32.indexOf(c);
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return new Uint8Array(out);
}

export function validSecret(s: string) {
  const clean = s.toUpperCase().replace(/[\s-]/g, '');
  return clean.length >= 16 && /^[A-Z2-7]+=*$/.test(clean);
}

/** RFC 6238 TOTP (SHA-1, 6 digits, 30 s) — compatible with Google Authenticator & co. */
export async function totp(secret: string, period = 30, digits = 6, t = Date.now()): Promise<string> {
  const key = base32Decode(secret);
  const counter = Math.floor(t / 1000 / period);
  const msg = new Uint8Array(8);
  new DataView(msg.buffer).setUint32(4, counter);
  new DataView(msg.buffer).setUint32(0, Math.floor(counter / 2 ** 32));
  const h = await hmac('SHA-1', key, msg);
  const o = h[h.length - 1] & 15;
  const code = (((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 10 ** digits;
  return String(code).padStart(digits, '0');
}

/** Parse otpauth://totp/Label?secret=...&issuer=... URIs. */
export function parseOtpauth(uri: string): { secret: string; issuer?: string; account?: string } | null {
  try {
    const u = new URL(uri);
    if (u.protocol !== 'otpauth:') return null;
    const secret = u.searchParams.get('secret');
    if (!secret) return null;
    const label = decodeURIComponent(u.pathname.replace(/^\/+totp\//i, '').replace(/^\/+/, ''));
    const [a, b] = label.split(':');
    return { secret, issuer: u.searchParams.get('issuer') ?? (b ? a : undefined), account: b ?? a };
  } catch {
    return null;
  }
}
