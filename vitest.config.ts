import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      // `include` already forces every src file into the denominator (vitest 4
      // makes the old `all: true` the default; the explicit key no longer
      // typechecks), so uncovered files still count toward the honest total.
      include: ["src/**"],
      thresholds: { lines: 68, statements: 68, functions: 73, branches: 65 },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
