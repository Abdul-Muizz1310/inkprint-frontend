import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  // Backend on Render free can take ~20-30s for the first request of a session
  // (cold pgvector connection, embedding model load). Give the cert-flow test
  // enough headroom to make two sequential POSTs.
  timeout: 120_000,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_API_URL: "https://inkprint-backend.onrender.com",
      NEXT_PUBLIC_SITE_URL: baseURL,
    },
  },
});
