import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the api layer so we can drive the RSC's compose logic without a backend.
// `vi.hoisted` because the class is referenced inside the hoisted vi.mock factory.
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

const getCertificateMock = vi.fn();
// Only the PK-bytes case wires this: the page must never call it.
const getCertificateDownloadPreviewMock = vi.fn();
const getCertificateManifestMock = vi.fn((_id: string) => Promise.resolve({}));

vi.mock("@/lib/api", () => ({
  ApiError: MockApiError,
  getCertificate: (id: string) => getCertificateMock(id),
  getCertificateDownloadPreview: (id: string, maxChars?: number) =>
    getCertificateDownloadPreviewMock(id, maxChars),
  getCertificateManifest: (id: string) => getCertificateManifestMock(id),
}));

const notFoundMock = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
vi.mock("next/navigation", () => ({
  notFound: () => notFoundMock(),
}));

import CertificatePage from "@/app/certificates/[id]/page";
import { PREVIEW_CHARS } from "@/lib/constants";

const VALID_ID = "550e8400-e29b-41d4-a716-446655440000";

const cert = {
  id: VALID_ID,
  author: "alice@example.com",
  content_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  simhash: 1,
  content_len: 10,
  language: "en",
  issued_at: "2026-04-10T12:34:56Z",
  signature: "sig",
  manifest: {},
  storage_key: "certs/x",
  text: "the full document body ".repeat(50),
};

async function renderPage(id: string) {
  const jsx = await CertificatePage({ params: Promise.resolve({ id }) });
  return render(jsx);
}

// RSCs signal 404 / errors by throwing; capture rather than use `.rejects`,
// which mis-attributes an async-component throw as an unhandled rejection.
async function catchRender(id: string): Promise<unknown> {
  try {
    await renderPage(id);
    return null;
  } catch (e) {
    return e;
  }
}

describe("CertificatePage (RSC)", () => {
  beforeEach(() => {
    getCertificateMock.mockReset();
    getCertificateDownloadPreviewMock.mockReset();
    notFoundMock.mockClear();
  });

  afterEach(() => vi.clearAllMocks());

  it("notFound()s a malformed id before any backend call (UUID gate)", async () => {
    const err = await catchRender("not-a-uuid");
    expect((err as Error)?.message).toBe("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
    // Never round-tripped to the backend.
    expect(getCertificateMock).not.toHaveBeenCalled();
    expect(getCertificateDownloadPreviewMock).not.toHaveBeenCalled();
  });

  it("passes only a 200-char digest of the certificate's text to the card", async () => {
    getCertificateMock.mockResolvedValueOnce({ ...cert, text: "x".repeat(5000) });
    await renderPage(VALID_ID);
    const pre = document.querySelector("pre");
    expect(pre?.textContent).toBe("x".repeat(PREVIEW_CHARS));
  });

  it("makes no second backend call for the digest", async () => {
    getCertificateMock.mockResolvedValueOnce(cert);
    await renderPage(VALID_ID);
    expect(getCertificateMock).toHaveBeenCalledTimes(1);
    expect(getCertificateDownloadPreviewMock).not.toHaveBeenCalled();
  });

  it("shows the certificate's own words in the digest, never the /download zip's bytes", async () => {
    // What the real backend answers on /download: a zip archive. Read as text
    // it renders as "PK\u0003\u0004…" — the bug this case pins down.
    getCertificateMock.mockResolvedValueOnce({ ...cert, text: "the original words" });
    getCertificateDownloadPreviewMock.mockResolvedValueOnce(
      "PK\u0003\u0004\u0014\u0000manifest.json",
    );
    await renderPage(VALID_ID);
    const pre = document.querySelector("pre");
    expect(pre?.textContent).toBe("the original words");
    expect(pre?.textContent).not.toContain("PK");
  });

  it("renders the certificate card on success", async () => {
    getCertificateMock.mockResolvedValueOnce(cert);
    await renderPage(VALID_ID);
    expect(screen.getByRole("heading", { name: /certificate of authorship/i })).toBeInTheDocument();
    expect(screen.getByTestId("cert-author")).toHaveTextContent("alice@example.com");
  });

  it("builds the verify footer as /verify?id=<cert.id>", async () => {
    getCertificateMock.mockResolvedValueOnce(cert);
    getCertificateDownloadPreviewMock.mockResolvedValueOnce("body");
    await renderPage(VALID_ID);
    expect(screen.getByTestId("cert-verify-footer")).toHaveTextContent(`/verify?id=${VALID_ID}`);
  });

  it("notFound()s when the backend 404s", async () => {
    getCertificateMock.mockRejectedValueOnce(new MockApiError(404, { detail: "gone" }));
    getCertificateDownloadPreviewMock.mockResolvedValueOnce("body");
    const err = await catchRender(VALID_ID);
    expect((err as Error)?.message).toBe("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("rethrows non-404 errors to the error boundary", async () => {
    getCertificateMock.mockRejectedValueOnce(new MockApiError(500, { detail: "boom" }));
    getCertificateDownloadPreviewMock.mockResolvedValueOnce("body");
    const err = await catchRender(VALID_ID);
    expect(err).toMatchObject({ status: 500 });
    expect(notFoundMock).not.toHaveBeenCalled();
  });
});
