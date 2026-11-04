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

/**
 * Deliberately relaxed (owner's decision): any password of 6 to 128 characters is accepted.
 * Login throttling, Argon2id hashing and optional 2FA remain the protection against guessing.
 */
export function checkPasswordPolicy(password: string, _context: { email?: string } = {}): string | null {
  if (password.length < 6) return "Use at least 6 characters.";
  if (password.length > 128) return "Use at most 128 characters.";
  return null;
}
