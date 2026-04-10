"use client";

import { Copy, Download, Share2 } from "lucide-react";
import { useCallback } from "react";
import { getCertificateManifest } from "@/lib/api";
import { env } from "@/lib/env";
import { formatIssuedAt, formatKeyId, truncateMiddle } from "@/lib/format";
import type { CertificateResponse } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { QRDisplay } from "./qr-display";

type CertificateCardProps = {
  cert: CertificateResponse;
  digestPreview: string;
  verifyUrl: string;
  qrUrl: string;
};

function readKeyId(manifest: Record<string, unknown>): string | null {
  // The backend's C2PA manifest stores the key id under `signature.key_id`;
  // we also check `signer.key_id` for compatibility with older payloads.
  for (const parent of ["signature", "signer"] as const) {
    const node = manifest[parent];
    if (node && typeof node === "object") {
      const maybe = (node as Record<string, unknown>).key_id;
      if (typeof maybe === "string") return maybe;
    }
  }
  return null;
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Clipboard can be denied by the browser; silent failure is fine —
    // the user can still select the text manually.
  }
}

export function CertificateCard({ cert, digestPreview, verifyUrl, qrUrl }: CertificateCardProps) {
  const shareUrl = `${env.NEXT_PUBLIC_SITE_URL}/certificates/${cert.id}`;
  const keyId = formatKeyId(readKeyId(cert.manifest));

  const handleCopyHash = useCallback(() => {
    copyToClipboard(cert.content_hash);
  }, [cert.content_hash]);

  const handleShare = useCallback(() => {
    copyToClipboard(shareUrl);
  }, [shareUrl]);

  const handleDownloadManifest = useCallback(async () => {
    try {
      const manifest = await getCertificateManifest(cert.id);
      const blob = new Blob([JSON.stringify(manifest, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `inkprint-${cert.id}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Caller's responsibility to render error state around failures.
    }
  }, [cert.id]);

  return (
    <article className="relative mx-auto max-w-3xl overflow-hidden rounded-2xl border border-[var(--border-bright)] bg-[var(--surface)] p-10 shadow-xl">
      {/* Watermark */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.06]"
      >
        <svg viewBox="0 0 200 200" className="h-[320px] w-[320px]" role="presentation">
          <title>inkprint watermark</title>
          <circle cx="100" cy="100" r="90" fill="none" stroke="currentColor" strokeWidth="4" />
          <text
            x="100"
            y="115"
            textAnchor="middle"
            fontSize="32"
            fontFamily="serif"
            fill="currentColor"
          >
            inkprint
          </text>
        </svg>
      </div>

      <div className="relative">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--fg-muted)]">
              inkprint
            </p>
            <h1
              data-testid="cert-headline"
              className={cn(
                "mt-2 font-serif text-3xl font-bold tracking-tight text-[var(--accent-ink)]",
                "md:text-4xl",
              )}
              style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
            >
              Certificate of Authorship
            </h1>
          </div>
          <div data-testid="cert-qr">
            <QRDisplay value={verifyUrl} src={qrUrl} size={120} alt="Verification QR" />
          </div>
        </div>

        <dl className="mt-10 grid grid-cols-[auto_1fr] gap-x-6 gap-y-4 text-sm">
          <dt className="font-medium text-[var(--fg-muted)]">Author</dt>
          <dd data-testid="cert-author" className="text-[var(--foreground)]">
            {cert.author}
          </dd>

          <dt className="font-medium text-[var(--fg-muted)]">Hash</dt>
          <dd className="font-mono text-[var(--foreground)]">
            <button
              type="button"
              data-testid="cert-hash"
              onClick={handleCopyHash}
              className="cursor-pointer bg-transparent p-0 font-mono text-inherit hover:text-[var(--accent-ink)]"
              title="Click to copy full hash"
            >
              {truncateMiddle(cert.content_hash, 6, 4)}
            </button>
          </dd>

          <dt className="font-medium text-[var(--fg-muted)]">Issued at</dt>
          <dd data-testid="cert-issued-at" className="text-[var(--foreground)]">
            {formatIssuedAt(cert.issued_at)}
          </dd>

          <dt className="font-medium text-[var(--fg-muted)]">Key ID</dt>
          <dd data-testid="cert-key-id" className="font-mono text-[var(--foreground)]">
            {keyId}
          </dd>
        </dl>

        <div className="mt-8">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--fg-muted)]">
            Content digest (first 200 chars)
          </p>
          <pre className="max-h-32 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 text-xs text-[var(--foreground)]">
            {digestPreview}
          </pre>
        </div>

        <p data-testid="cert-verify-footer" className="mt-8 text-xs text-[var(--fg-muted)]">
          Verify at {verifyUrl}
        </p>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            data-testid="cert-download-manifest"
            onClick={handleDownloadManifest}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-bright)] bg-[var(--background)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-hover)]"
          >
            <Download className="h-4 w-4" />
            Download manifest
          </button>
          <button
            type="button"
            data-testid="cert-share"
            onClick={handleShare}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent-ink)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] transition hover:opacity-90"
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>
          <button
            type="button"
            onClick={handleCopyHash}
            aria-label="Copy hash"
            className="inline-flex items-center justify-center rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--fg-muted)] transition hover:text-[var(--foreground)]"
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}
