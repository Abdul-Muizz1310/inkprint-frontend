import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Stub the terminal — this test drives the RSC shell's UUID gate, not the SSE.
vi.mock("@/components/leak-terminal", () => ({
  LeakTerminal: ({ scanId }: { scanId: string }) => (
    <div data-testid="leak-terminal-stub">{scanId}</div>
  ),
}));

const notFoundMock = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
vi.mock("next/navigation", () => ({
  notFound: () => notFoundMock(),
}));

import LeakScanPage from "@/app/leak/[id]/page";

const VALID_ID = "550e8400-e29b-41d4-a716-446655440000";

describe("LeakScanPage (RSC shell)", () => {
  it("notFound()s a malformed scan id", async () => {
    notFoundMock.mockClear();
    let threw: unknown = null;
    try {
      await LeakScanPage({ params: Promise.resolve({ id: "bad-id" }) });
    } catch (e) {
      threw = e;
    }
    expect(notFoundMock).toHaveBeenCalled();
    expect((threw as Error)?.message).toBe("NEXT_NOT_FOUND");
  });

  it("mounts the terminal for a valid uuid", async () => {
    notFoundMock.mockClear();
    const jsx = await LeakScanPage({ params: Promise.resolve({ id: VALID_ID }) });
    expect(notFoundMock).not.toHaveBeenCalled();
    const { getByTestId } = render(jsx);
    expect(getByTestId("leak-terminal-stub")).toHaveTextContent(VALID_ID);
  });
});
