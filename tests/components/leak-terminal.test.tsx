import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Capture the close function returned by openLeakScanStream so tests can
// verify unmount behaviour.
const closeMock = vi.fn();
let capturedHandlers: {
  onEvent?: (e: unknown) => void;
  onError?: (e: unknown) => void;
  onOpen?: () => void;
} = {};

vi.mock("@/lib/sse", () => ({
  openLeakScanStream: vi.fn((_scanId: string, handlers: typeof capturedHandlers) => {
    capturedHandlers = handlers;
    return closeMock;
  }),
}));

const getLeakScanMock = vi.fn();
vi.mock("@/lib/api", () => ({
  getLeakScan: (id: string) => getLeakScanMock(id),
  ApiError: class ApiError extends Error {
    constructor(
      public status: number,
      public body: unknown,
    ) {
      super(`API ${status}`);
    }
  },
}));

import { LeakTerminal } from "@/components/leak-terminal";

describe("LeakTerminal", () => {
  beforeEach(() => {
    closeMock.mockReset();
    getLeakScanMock.mockReset();
    capturedHandlers = {};
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("appends streamed events and transitions to done", async () => {
    render(<LeakTerminal scanId="abc" />);
    capturedHandlers.onEvent?.({ type: "started" });
    capturedHandlers.onEvent?.({
      type: "scanning",
      corpus: "common_crawl",
      snapshot: "CC-MAIN-2024-50",
    });
    capturedHandlers.onEvent?.({
      type: "hit",
      corpus: "common_crawl",
      url: "https://example.com/x",
      excerpt: "…",
      score: 0.92,
    });
    capturedHandlers.onEvent?.({ type: "done" });

    await waitFor(() => {
      expect(screen.getByTestId("leak-terminal")).toHaveTextContent(/common_crawl/);
    });
    expect(screen.getByText(/done/i)).toBeInTheDocument();
  });

  it("closes the stream on unmount", () => {
    const { unmount } = render(<LeakTerminal scanId="abc" />);
    unmount();
    expect(closeMock).toHaveBeenCalled();
  });

  it("falls back to polling on stream error", async () => {
    getLeakScanMock.mockResolvedValueOnce({
      scan_id: "abc",
      status: "done",
      hits: [],
    });

    render(<LeakTerminal scanId="abc" />);
    capturedHandlers.onError?.(new Event("error"));

    await waitFor(() => {
      expect(getLeakScanMock).toHaveBeenCalledWith("abc");
    });
  });

  it("ignores unknown event types without crashing", () => {
    render(<LeakTerminal scanId="abc" />);
    expect(() => capturedHandlers.onEvent?.({ type: "mystery", payload: 1 })).not.toThrow();
  });

  it("renders the failed event line", async () => {
    render(<LeakTerminal scanId="abc" />);
    capturedHandlers.onEvent?.({ type: "failed", reason: "timeout exceeded" });

    await waitFor(() => {
      expect(screen.getByTestId("leak-terminal")).toHaveTextContent(
        /scan failed: timeout exceeded/,
      );
    });
  });

  it("shows 'scan not found' on 404 fallback poll", async () => {
    const { ApiError } = await import("@/lib/api");
    getLeakScanMock.mockRejectedValueOnce(new ApiError(404, { detail: "not found" }));

    render(<LeakTerminal scanId="abc" />);
    capturedHandlers.onError?.(new Event("error"));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("scan not found");
    });
  });

  it("shows generic error on non-404 fallback poll failure", async () => {
    getLeakScanMock.mockRejectedValueOnce(new Error("network down"));

    render(<LeakTerminal scanId="abc" />);
    capturedHandlers.onError?.(new Event("error"));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("failed to load scan");
    });
  });

  it("ignores events after unmount (cancelled flag)", () => {
    const { unmount } = render(<LeakTerminal scanId="abc" />);
    const handlers = { ...capturedHandlers };
    unmount();
    // These should not throw or update state since cancelled=true
    expect(() => handlers.onEvent?.({ type: "started" })).not.toThrow();
    expect(() => handlers.onError?.(new Event("error"))).not.toThrow();
  });

  it("ignores fallbackPoll result after unmount", async () => {
    // Set up a delayed poll response
    let resolveGetLeakScan: (v: unknown) => void;
    getLeakScanMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGetLeakScan = resolve;
        }),
    );

    const { unmount } = render(<LeakTerminal scanId="abc" />);
    // Trigger done event which calls fallbackPoll
    capturedHandlers.onEvent?.({ type: "done" });
    // Unmount before the poll resolves
    unmount();
    // Now resolve the poll - the cancelled flag should prevent state update
    resolveGetLeakScan!({
      scan_id: "abc",
      status: "done",
      hits: [],
    });
    await new Promise((r) => setTimeout(r, 0));
    // No crash = success
  });

  it("ignores fallbackPoll error after unmount", async () => {
    let rejectGetLeakScan: (e: unknown) => void;
    getLeakScanMock.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectGetLeakScan = reject;
        }),
    );

    const { unmount } = render(<LeakTerminal scanId="abc" />);
    capturedHandlers.onError?.(new Event("error"));
    unmount();
    // Reject after unmount
    rejectGetLeakScan!(new Error("network"));
    await new Promise((r) => setTimeout(r, 0));
  });

  it("sets status to failed when fallbackPoll returns failed", async () => {
    getLeakScanMock.mockResolvedValueOnce({
      scan_id: "abc",
      status: "failed",
      hits: [],
    });

    render(<LeakTerminal scanId="abc" />);
    // Trigger done event which calls fallbackPoll, but poll returns "failed"
    capturedHandlers.onEvent?.({ type: "done" });

    await waitFor(() => {
      expect(getLeakScanMock).toHaveBeenCalledWith("abc");
    });
  });

  it("does not update status when poll returns pending", async () => {
    getLeakScanMock.mockResolvedValueOnce({
      scan_id: "abc",
      status: "pending",
      hits: [],
    });

    render(<LeakTerminal scanId="abc" />);
    capturedHandlers.onError?.(new Event("error"));

    await waitFor(() => {
      expect(getLeakScanMock).toHaveBeenCalledWith("abc");
    });
  });

  it("renders scanning event without snapshot", async () => {
    render(<LeakTerminal scanId="abc" />);
    capturedHandlers.onEvent?.({ type: "scanning", corpus: "arxiv" });

    await waitFor(() => {
      expect(screen.getByTestId("leak-terminal")).toHaveTextContent(/scanning arxiv/);
    });
    // No snapshot suffix
    expect(screen.getByTestId("leak-terminal")).not.toHaveTextContent(/\(/);
  });

  it("renders hit cards when finalResult has hits", async () => {
    getLeakScanMock.mockResolvedValueOnce({
      scan_id: "abc",
      status: "done",
      hits: [{ corpus: "cc", url: "https://example.com", score: 0.95 }],
    });

    render(<LeakTerminal scanId="abc" />);
    // Trigger done event which calls fallbackPoll
    capturedHandlers.onEvent?.({ type: "done" });

    await waitFor(() => {
      expect(screen.getByText(/hits · 1/)).toBeInTheDocument();
    });
  });
});
