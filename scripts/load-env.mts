/** Loads .env.local for CLI scripts (Next.js does this itself for the app). Import it first. */
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local: the scripts fall back to the local development database.
}
