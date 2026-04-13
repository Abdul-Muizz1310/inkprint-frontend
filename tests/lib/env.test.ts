import { afterEach, describe, expect, it, vi } from "vitest";

describe("env.ts", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("exports valid env when variables are correct", async () => {
    // The module was already loaded by setup.ts with valid env vars
    const mod = await import("@/lib/env");
    expect(mod.env.NEXT_PUBLIC_API_URL).toBe("https://inkprint-backend.onrender.com");
    expect(mod.env.NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
  });

  it("throws when NEXT_PUBLIC_API_URL is missing", async () => {
    // Clear the module cache so env.ts re-evaluates
    vi.resetModules();

    const saved = process.env.NEXT_PUBLIC_API_URL;
    delete process.env.NEXT_PUBLIC_API_URL;

    try {
      await expect(import("@/lib/env")).rejects.toThrow("Invalid environment configuration");
    } finally {
      process.env.NEXT_PUBLIC_API_URL = saved;
    }
  });

  it("throws when NEXT_PUBLIC_SITE_URL is invalid", async () => {
    vi.resetModules();

    const saved = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "not-a-url";

    try {
      await expect(import("@/lib/env")).rejects.toThrow("Invalid environment configuration");
    } finally {
      process.env.NEXT_PUBLIC_SITE_URL = saved;
    }
  });
});
