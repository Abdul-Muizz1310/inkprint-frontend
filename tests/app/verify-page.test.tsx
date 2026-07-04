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

const getCertificateManifestMock = vi.fn();
const verifyManifestMock = vi.fn();

vi.mock("@/lib/api", () => ({
  ApiError: MockApiError,
  isTimeoutError: (e: unknown) =>
    e instanceof MockApiError && e.status === 0 && e.body === "timeout",
  getCertificateManifest: (id: string) => getCertificateManifestMock(id),
  verifyManifest: (input: unknown) => verifyManifestMock(input),
}));

// useSearchParams is controlled per-test via `searchParamsValue`.
let searchParamsValue = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParamsValue,
}));

import VerifyPage from "@/app/verify/page";

const VALID_ID = "550e8400-e29b-41d4-a716-446655440000";

const certIdInput = () => screen.getByLabelText(/load manifest by certificate id/i);
const manifestInput = () => screen.getByLabelText(/manifest\.json/i) as HTMLTextAreaElement;

describe("VerifyPage", () => {
  beforeEach(() => {
    searchParamsValue = new URLSearchParams();
    getCertificateManifestMock.mockReset();
    verifyManifestMock.mockReset();
  });
  afterEach(() => vi.clearAllMocks());

  // ---- COR-1: the /verify?id=<uuid> deep-link / QR target auto-loads ----
  it("auto-loads the manifest when a valid ?id= is present (deep-link)", async () => {
    searchParamsValue = new URLSearchParams(`id=${VALID_ID}`);
    getCertificateManifestMock.mockResolvedValueOnce({ "@context": "c2pa", claim: 1 });

    render(<VerifyPage />);

    await waitFor(() => {
      expect(getCertificateManifestMock).toHaveBeenCalledWith(VALID_ID);
    });
    // The input is seeded and the manifest textarea is populated on arrival.
    expect(certIdInput()).toHaveValue(VALID_ID);
    await waitFor(() => expect(manifestInput().value).toContain("@context"));
  });

  it("ignores a non-uuid ?id= (no backend call, empty form)", async () => {
    searchParamsValue = new URLSearchParams("id=garbage");
    render(<VerifyPage />);
    await Promise.resolve();
    expect(getCertificateManifestMock).not.toHaveBeenCalled();
    expect(manifestInput().value).toBe("");
  });

  // ---- Manual load-by-id ----
  it("loads a manifest for a valid id typed into the loader", async () => {
    getCertificateManifestMock.mockResolvedValueOnce({ foo: "bar" });
    render(<VerifyPage />);
    fireEvent.change(certIdInput(), { target: { value: VALID_ID } });
    fireEvent.click(screen.getByRole("button", { name: /^load/i }));
    await waitFor(() => expect(getCertificateManifestMock).toHaveBeenCalledWith(VALID_ID));
    await waitFor(() => expect(manifestInput().value).toContain("foo"));
  });

  it("rejects a malformed id without hitting the backend", async () => {
    render(<VerifyPage />);
    fireEvent.change(certIdInput(), { target: { value: "not-a-uuid" } });
    fireEvent.click(screen.getByRole("button", { name: /^load/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/valid certificate id/i);
    });
    expect(getCertificateManifestMock).not.toHaveBeenCalled();
  });

  it("shows 'certificate not found' on a 404 load", async () => {
    getCertificateManifestMock.mockRejectedValueOnce(new MockApiError(404, { detail: "x" }));
    render(<VerifyPage />);
    fireEvent.change(certIdInput(), { target: { value: VALID_ID } });
    fireEvent.click(screen.getByRole("button", { name: /^load/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/certificate not found/i);
    });
  });

  it("shows a waking-up message when the load times out", async () => {
    getCertificateManifestMock.mockRejectedValueOnce(new MockApiError(0, "timeout"));
    render(<VerifyPage />);
    fireEvent.change(certIdInput(), { target: { value: VALID_ID } });
    fireEvent.click(screen.getByRole("button", { name: /^load/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/waking up/i);
    });
  });

  // ---- Verify flow ----
  it("rejects invalid JSON before calling the backend", async () => {
    render(<VerifyPage />);
    fireEvent.change(manifestInput(), { target: { value: "{not json" } });
    fireEvent.click(screen.getByRole("button", { name: /verify/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/invalid json/i);
    });
    expect(verifyManifestMock).not.toHaveBeenCalled();
  });

  it("verifies a pasted manifest and renders the itemised verdict", async () => {
    verifyManifestMock.mockResolvedValueOnce({
      valid: true,
      checks: { signature: true, hash: true, timestamp: true },
      warnings: [],
    });
    render(<VerifyPage />);
    fireEvent.change(manifestInput(), { target: { value: '{"a":1}' } });
    fireEvent.click(screen.getByRole("button", { name: /verify/i }));

    await waitFor(() => {
      expect(verifyManifestMock).toHaveBeenCalledWith({ manifest: { a: 1 }, text: undefined });
    });
    await waitFor(() => {
      expect(screen.getByText(/valid certificate/i)).toBeInTheDocument();
    });
  });

  it("shows a waking-up message when verify times out", async () => {
    verifyManifestMock.mockRejectedValueOnce(new MockApiError(0, "timeout"));
    render(<VerifyPage />);
    fireEvent.change(manifestInput(), { target: { value: '{"a":1}' } });
    fireEvent.click(screen.getByRole("button", { name: /verify/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/waking up/i);
    });
  });
});
