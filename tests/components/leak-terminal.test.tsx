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
});
