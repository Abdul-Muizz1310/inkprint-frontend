import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { MockApiError } = vi.hoisted(() => {
  class MockApiError extends Error {
    constructor(
      public status: number,
      public body: unknown,
    ) {
      super(`API ${status}`);
      this.name = "ApiError";
    }
  }
  return { MockApiError };
});

const diffTextMock = vi.fn();
const getCertificateDownloadMock = vi.fn();

vi.mock("@/lib/api", () => ({
  ApiError: MockApiError,
  isTimeoutError: (e: unknown) =>
    e instanceof MockApiError && e.status === 0 && e.body === "timeout",
  diffText: (input: unknown) => diffTextMock(input),
  getCertificateDownload: (id: string) => getCertificateDownloadMock(id),
}));

import ComparePage from "@/app/compare/page";

const VALID_ID = "550e8400-e29b-41d4-a716-446655440000";

function typeParent(id: string) {
  fireEvent.change(screen.getByLabelText(/parent_id/i), { target: { value: id } });
}
function typeText(text: string) {
  fireEvent.change(screen.getByLabelText(/new\.txt/i), { target: { value: text } });
}

describe("ComparePage", () => {
  beforeEach(() => {
    diffTextMock.mockReset();
    getCertificateDownloadMock.mockReset();
  });
  afterEach(() => vi.clearAllMocks());

  it("shows a uuid hint and keeps compare disabled for a malformed parent id", () => {
    render(<ComparePage />);
    typeParent("not-a-uuid");
    typeText("some new text");
    expect(screen.getByText(/must be a uuid/i)).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: /compare/i });
    expect(btn).toBeDisabled();
  });

  it("does not call the backend when the parent id is invalid", () => {
    render(<ComparePage />);
    typeParent("xyz");
    typeText("text");
    fireEvent.click(screen.getByRole("button", { name: /compare/i }));
    expect(getCertificateDownloadMock).not.toHaveBeenCalled();
    expect(diffTextMock).not.toHaveBeenCalled();
  });

  it("fetches parent + diff and renders the verdict on success", async () => {
    getCertificateDownloadMock.mockResolvedValueOnce("original body");
    diffTextMock.mockResolvedValueOnce({
      hamming: 4,
      cosine: 0.9,
      verdict: "near-duplicate",
      overlap_pct: 88,
      changed_spans: [],
    });

    render(<ComparePage />);
    typeParent(VALID_ID);
    typeText("new body");
    fireEvent.click(screen.getByRole("button", { name: /compare/i }));

    await waitFor(() => {
      expect(getCertificateDownloadMock).toHaveBeenCalledWith(VALID_ID);
      expect(diffTextMock).toHaveBeenCalledWith({ parent_id: VALID_ID, text: "new body" });
    });
  });

  it("shows 'parent certificate not found' on a 404", async () => {
    getCertificateDownloadMock.mockRejectedValueOnce(new MockApiError(404, { detail: "x" }));
    diffTextMock.mockRejectedValueOnce(new MockApiError(404, { detail: "x" }));

    render(<ComparePage />);
    typeParent(VALID_ID);
    typeText("new body");
    fireEvent.click(screen.getByRole("button", { name: /compare/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/parent certificate not found/i);
    });
  });

  it("shows a waking-up message on a timeout", async () => {
    getCertificateDownloadMock.mockRejectedValueOnce(new MockApiError(0, "timeout"));
    diffTextMock.mockRejectedValueOnce(new MockApiError(0, "timeout"));

    render(<ComparePage />);
    typeParent(VALID_ID);
    typeText("new body");
    fireEvent.click(screen.getByRole("button", { name: /compare/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/waking up/i);
    });
  });
});
