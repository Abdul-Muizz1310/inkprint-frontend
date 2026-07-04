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

  it("renders the certificate card on success", async () => {
    getCertificateMock.mockResolvedValueOnce(cert);
    getCertificateDownloadPreviewMock.mockResolvedValueOnce("the full document body ".repeat(50));
    await renderPage(VALID_ID);
    expect(screen.getByRole("heading", { name: /certificate of authorship/i })).toBeInTheDocument();
    expect(screen.getByTestId("cert-author")).toHaveTextContent("alice@example.com");
  });

  it("passes only a 200-char digest preview to the card", async () => {
    getCertificateMock.mockResolvedValueOnce(cert);
    getCertificateDownloadPreviewMock.mockResolvedValueOnce("x".repeat(5000));
    await renderPage(VALID_ID);
    const pre = document.querySelector("pre");
    expect(pre?.textContent?.length).toBe(200);
  });

  it("renders the preview from cert.content_preview and skips ANY download (OPT-2)", async () => {
    getCertificateMock.mockResolvedValueOnce({
      ...cert,
      content_preview: "server-side preview prefix",
    });
    await renderPage(VALID_ID);
    const pre = document.querySelector("pre");
    expect(pre?.textContent).toBe("server-side preview prefix");
    // The whole point: no body transfer at all for a 200-char preview.
    expect(getCertificateDownloadPreviewMock).not.toHaveBeenCalled();
  });

  it("slices a long content_preview to 200 chars without downloading", async () => {
    getCertificateMock.mockResolvedValueOnce({ ...cert, content_preview: "y".repeat(5000) });
    await renderPage(VALID_ID);
    const pre = document.querySelector("pre");
    expect(pre?.textContent?.length).toBe(200);
    expect(getCertificateDownloadPreviewMock).not.toHaveBeenCalled();
  });

  it("falls back to a bounded PREVIEW-only fetch when no content_preview is present (OPT-2)", async () => {
    getCertificateMock.mockResolvedValueOnce(cert);
    getCertificateDownloadPreviewMock.mockResolvedValueOnce("downloaded prefix");
    await renderPage(VALID_ID);
    const pre = document.querySelector("pre");
    expect(pre?.textContent).toBe("downloaded prefix");
    // Fallback must request only the preview prefix (never the full body), and
    // must ask for exactly PREVIEW_CHARS so page + fetch can't drift.
    expect(getCertificateDownloadPreviewMock).toHaveBeenCalledWith(VALID_ID, PREVIEW_CHARS);
  });

  it("notFound()s when the fallback preview fetch 404s", async () => {
    getCertificateMock.mockResolvedValueOnce(cert);
    getCertificateDownloadPreviewMock.mockRejectedValueOnce(
      new MockApiError(404, { detail: "gone" }),
    );
    const err = await catchRender(VALID_ID);
    expect((err as Error)?.message).toBe("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
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
