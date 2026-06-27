import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BackendStatus } from "@/components/backend-status";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("BackendStatus", () => {
  it("shows a checking pill before the health probe resolves", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})), // never resolves
    );
    render(<BackendStatus />);
    expect(screen.getByText(/pinging backend/i)).toBeInTheDocument();
  });

  it("shows backend OK with latency when /health responds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200 }) as Response),
    );
    render(<BackendStatus />);
    expect(await screen.findByText("OK")).toBeInTheDocument();
    expect(screen.getByText(/ms$/)).toBeInTheDocument();
  });

  it("shows unreachable when the request rejects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network");
      }),
    );
    render(<BackendStatus />);
    expect(await screen.findByText(/backend unreachable/i)).toBeInTheDocument();
  });

  it("shows unreachable on a non-ok status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 503 }) as Response),
    );
    render(<BackendStatus />);
    expect(await screen.findByText(/backend unreachable/i)).toBeInTheDocument();
  });

  it("warns about a cold start when the probe is slow", () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})), // pending past the cold threshold
    );
    render(<BackendStatus />);
    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(screen.getByText(/backend waking up/i)).toBeInTheDocument();
  });
});
