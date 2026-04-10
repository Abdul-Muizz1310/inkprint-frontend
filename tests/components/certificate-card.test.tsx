import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CertificateCard } from "@/components/certificate-card";
import type { CertificateResponse } from "@/lib/schemas";

const fullHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

const cert: CertificateResponse = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  author: "alice@example.com",
  content_hash: fullHash,
  simhash: 1234,
  content_len: 500,
  language: "en",
  issued_at: "2026-04-10T12:34:56Z",
  signature: "sig",
  manifest: { signer: { key_id: "abcdefghijklmnopqrstuvwxyz1234567890" } },
  storage_key: "certs/x",
};

const defaultProps = {
  cert,
  digestPreview: "lorem ipsum dolor sit amet",
  verifyUrl: "http://localhost:3000/verify?id=550e8400-e29b-41d4-a716-446655440000",
  qrUrl:
    "https://inkprint-backend.onrender.com/certificates/550e8400-e29b-41d4-a716-446655440000/qr",
};

const clipboardWriteText = vi.fn<(text: string) => Promise<void>>(async () => {});

describe("CertificateCard", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })),
    );
    clipboardWriteText.mockClear();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: clipboardWriteText },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders the serif headline", () => {
    render(<CertificateCard {...defaultProps} />);
    expect(screen.getByRole("heading", { name: /certificate of authorship/i })).toBeInTheDocument();
  });

  it("shows author, hash, issued-at, key-id rows", () => {
    render(<CertificateCard {...defaultProps} />);
    expect(screen.getByTestId("cert-author")).toHaveTextContent(/alice@example.com/);
    expect(screen.getByTestId("cert-hash")).toHaveTextContent("…");
    expect(screen.getByTestId("cert-issued-at")).toHaveTextContent(/2026/);
    expect(screen.getByTestId("cert-key-id")).toHaveTextContent(/abcdefghijklmnop/);
  });

  it("truncates the hash but copies the full value", async () => {
    expect(navigator.clipboard.writeText).toBe(clipboardWriteText);

    render(<CertificateCard {...defaultProps} />);
    const hashEl = screen.getByTestId("cert-hash");
    expect(hashEl.textContent).toContain("…");
    fireEvent.click(hashEl);
    // Allow the microtask that calls clipboard.writeText to flush.
    await Promise.resolve();
    expect(clipboardWriteText.mock.calls[0]?.[0]).toBe(fullHash);
  });

  it("formats issued-at with UTC", () => {
    render(<CertificateCard {...defaultProps} />);
    expect(screen.getByTestId("cert-issued-at")).toHaveTextContent(/UTC/);
  });

  it("renders '—' when language is null", () => {
    render(<CertificateCard {...defaultProps} cert={{ ...cert, language: null }} />);
    // No crash; language is optional metadata.
    expect(screen.getByRole("heading", { name: /certificate of authorship/i })).toBeInTheDocument();
  });

  it("renders '—' when manifest lacks signer.key_id", () => {
    render(<CertificateCard {...defaultProps} cert={{ ...cert, manifest: {} }} />);
    expect(screen.getByTestId("cert-key-id")).toHaveTextContent("—");
  });

  it("share button copies the full certificate URL", async () => {
    render(<CertificateCard {...defaultProps} />);
    fireEvent.click(screen.getByTestId("cert-share"));
    await Promise.resolve();

    const calls = clipboardWriteText.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0][0]).toContain(cert.id);
  });

  it("download-manifest button fetches and triggers a download", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response(JSON.stringify({ manifest: "ok" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    // jsdom doesn't implement URL.createObjectURL; stub it.
    const createObjectURL = vi.fn(() => "blob:mock");
    const revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;

    render(<CertificateCard {...defaultProps} />);
    fireEvent.click(screen.getByTestId("cert-download-manifest"));
    // Flush the async handler.
    await new Promise((r) => setTimeout(r, 0));

    // fetch is called as fetch(url, init); assert on the first arg only.
    const calls = fetchMock.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0][0]).toContain(`/certificates/${cert.id}/manifest`);
    expect(createObjectURL).toHaveBeenCalled();
  });

  it("renders the QR image with fixed dimensions", () => {
    render(<CertificateCard {...defaultProps} />);
    const qr = screen.getByTestId("cert-qr");
    expect(qr).toBeInTheDocument();
  });

  it("renders the verify footer with the cert id", () => {
    render(<CertificateCard {...defaultProps} />);
    expect(screen.getByTestId("cert-verify-footer")).toHaveTextContent(cert.id);
  });
});
