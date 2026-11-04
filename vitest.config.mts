import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Integration tests must hit the same database as the server, so read the same .env.local.
try {
  process.loadEnvFile(".env.local");
} catch {
  // none
}

export default defineConfig({
  // Next.js compiles JSX itself (tsconfig says "preserve"); tests need the automatic runtime.
  esbuild: { jsx: "automatic" },
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    // Integration tests share one database and one login rate limit, so run files one after another.
    fileParallelism: false,
    // Remote databases (Neon) add network latency to every request.
    testTimeout: 180_000,
  },
});
