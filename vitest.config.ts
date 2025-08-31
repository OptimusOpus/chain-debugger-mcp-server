import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["tests/setup.ts"],
    coverage: {
      reporter: ["text", "html", "json-summary"],
    },
  },
});
