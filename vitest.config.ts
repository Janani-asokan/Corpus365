import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const src = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": src("./src"),
      "server-only": src("./tests/support/server-only.ts"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    globalSetup: ["./tests/support/global-setup.ts"],
    setupFiles: ["./tests/support/env.ts"],
    // Database tests share one database; run files one at a time.
    fileParallelism: false,
  },
});
