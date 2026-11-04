import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** RFC 6238 TOTP (SHA-1, 6 digits, 30 s), compatible with Google Authenticator, Authy, 1Password and similar apps. */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const STEP_SECONDS = 30;

export function generateSecret(): string {
  return base32Encode(randomBytes(20));
}

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of text.toUpperCase().replace(/=+$/, "")) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw new Error("Invalid base32");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function codeAtStep(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 15;
  const binary = hmac.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 1_000_000).padStart(6, "0");
}

export const currentStep = (nowMs = Date.now()) => Math.floor(nowMs / 1000 / STEP_SECONDS);

/**
 * Returns the accepted step, or null. Accepts one step either side for clock
 * drift, and refuses any step at or before `lastUsedStep` so a code is single-use.
 */
export function verifyCode(
  secret: string,
  code: string,
  lastUsedStep: number | null,
  nowMs = Date.now(),
): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const now = currentStep(nowMs);
  for (const step of [now, now - 1, now + 1]) {
    if (lastUsedStep !== null && step <= lastUsedStep) continue;
    const expected = Buffer.from(codeAtStep(secret, step));
    const given = Buffer.from(code);
    if (expected.length === given.length && timingSafeEqual(expected, given)) return step;
  }
  return null;
}

export const otpauthUri = (secret: string, account: string, issuer: string) =>
  `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${STEP_SECONDS}`;
