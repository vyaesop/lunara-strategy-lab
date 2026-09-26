import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/android/**", "**/ios/**"],
    environment: "node",
    testTimeout: 30_000,
  },
});
