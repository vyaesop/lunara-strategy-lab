import { defineConfig } from "@playwright/test";

/**
 * E2E against real servers: the API on an in-memory PGlite with the mock AI
 * provider, and the Vite dev server. No credentials or network required.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "pnpm --filter @lunara/api exec tsx src/index.ts",
      url: "http://localhost:8787/health",
      reuseExistingServer: !process.env.CI,
      env: { NODE_ENV: "test", PORT: "8787", PGLITE_DATA_DIR: "memory://", AI_PROVIDER_DEFAULT: "mock" },
      timeout: 60_000,
    },
    {
      command: "pnpm exec vite --port 5173 --strictPort",
      url: "http://localhost:5173",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
