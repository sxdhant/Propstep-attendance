import { hash, verify } from "@node-rs/argon2";

/*
 * Argon2id with the OWASP-recommended minimum cost (19 MiB, 2 passes, 1 lane).
 * Deliberately has no "server-only" import so CLI scripts (seed) can use it,
 * but it must never be imported from client code.
 */

const OPTIONS = { algorithm: 2 /* Argon2id */, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export const hashPassword = (password: string): Promise<string> => hash(password, OPTIONS);

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    return await verify(stored, password);
  } catch {
    return false;
  }
}

let dummy: Promise<string> | null = null;

/** Burns the same CPU time as a real check, so response timing doesn't reveal which emails exist. */
export async function verifyAgainstDummy(password: string): Promise<void> {
  dummy ??= hashPassword("timing-equalizer-not-a-real-password");
  await verifyPassword(password, await dummy);
}

/* ------------------------------ password policy ----------------------------- */

const COMMON = new Set([
  "password", "password1", "password123", "passw0rd", "123456789", "1234567890", "12345678910", "qwertyuiop",
  "qwerty123", "iloveyou12", "welcome123", "letmein123", "admin12345", "administrator", "changeme123",
  "abc123456", "000000000", "111111111", "123123123", "employee123", "admin@123", "employee@123",
]);

/** Returns a user-facing problem with the password, or null when it is acceptable. */
export function checkPasswordPolicy(password: string, context: { email?: string } = {}): string | null {
  if (password.length < 10) return "Use at least 10 characters.";
  if (password.length > 128) return "Use at most 128 characters.";
  const lower = password.toLowerCase();
  if (COMMON.has(lower)) return "That password is too common. Choose something less guessable.";
  if (/^(.)\1+$/.test(password)) return "Don't repeat a single character.";
  const local = context.email?.split("@")[0]?.toLowerCase();
  if (local && local.length >= 4 && lower.includes(local)) return "The password shouldn't contain your email name.";
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  if (classes < 3 && password.length < 16) {
    return "Mix at least three of: lowercase, uppercase, numbers, symbols (or use 16+ characters).";
  }
  return null;
}
