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
  // also check `signer.key_id` for compatibility with older payloads.
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
    // Clipboard can be denied; silent failure is fine — the text is
    // still selectable in the DOM.
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
    <article className="relative overflow-hidden rounded-xl border border-border-bright bg-gradient-to-br from-surface to-background p-8 shadow-[0_0_60px_rgb(224_181_94_/_0.08)] md:p-12">
      {/* Watermark — serif inkprint mark */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.04]"
      >
        <svg
          viewBox="0 0 200 200"
          className="h-[420px] w-[420px] text-accent-ink"
          role="presentation"
        >
          <title>inkprint watermark</title>
          <circle cx="100" cy="100" r="92" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="100" cy="100" r="82" fill="none" stroke="currentColor" strokeWidth="1" />
          <text
            x="100"
            y="110"
            textAnchor="middle"
            fontSize="28"
            fontFamily="var(--font-serif)"
            fontStyle="italic"
            fill="currentColor"
          >
            inkprint
          </text>
        </svg>
      </div>

      <div className="relative">
        {/* Header row: serif headline + QR */}
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-fg-faint">
              <span className="text-accent-ink">{"//"}</span>
              <span>c2pa v2.2 · ed25519</span>
            </div>
            <h1
              data-testid="cert-headline"
              className="font-serif-display text-3xl font-bold leading-tight text-accent-ink md:text-[2.75rem]"
            >
              Certificate of Authorship
            </h1>
            <p className="mt-2 font-mono text-xs text-fg-muted">
              issued <span className="text-accent-ink">{formatIssuedAt(cert.issued_at)}</span>
            </p>
          </div>

          <div
            data-testid="cert-qr"
            className="shrink-0 rounded-lg border border-border bg-background/60 p-2"
          >
            <QRDisplay value={verifyUrl} src={qrUrl} size={112} alt="Verification QR" />
          </div>
        </div>

        {/* Dashed separator */}
        <div className="my-8 border-t border-dashed border-border-bright" />

        {/* Metadata grid */}
        <dl className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <MetadataRow label="author" testid="cert-author">
            <span className="text-foreground">{cert.author}</span>
          </MetadataRow>

          <MetadataRow label="issued_at" testid="cert-issued-at">
            <span className="text-foreground">{formatIssuedAt(cert.issued_at)}</span>
          </MetadataRow>

          <MetadataRow label="content_hash">
            <button
              type="button"
              data-testid="cert-hash"
              onClick={handleCopyHash}
              title="click to copy full hash"
              className="cursor-pointer bg-transparent p-0 font-mono text-sm text-foreground transition-colors hover:text-accent-ink"
            >
              {truncateMiddle(cert.content_hash, 8, 6)}
              <Copy className="ml-2 inline-block h-3 w-3 text-fg-faint" />
            </button>
          </MetadataRow>

          <MetadataRow label="key_id" testid="cert-key-id">
            <span className="text-foreground">{keyId}</span>
          </MetadataRow>
        </dl>

        {/* Digest preview */}
        <div className="mt-8">
          <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-fg-faint">
            <span className="text-accent-ink">{"//"}</span>
            <span>content digest · first 200 chars</span>
          </div>
          <pre className="max-h-40 overflow-y-auto rounded-lg border border-border bg-background/60 p-4 font-mono text-[11px] leading-relaxed text-foreground">
            {digestPreview}
          </pre>
        </div>

        {/* Verify footer */}
        <p data-testid="cert-verify-footer" className="mt-6 font-mono text-[11px] text-fg-muted">
          <span className="text-fg-faint">verify at </span>
          <span className="text-accent-ink">{verifyUrl}</span>
        </p>

        {/* Actions */}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            data-testid="cert-download-manifest"
            onClick={handleDownloadManifest}
            className="inline-flex items-center gap-2 rounded-lg border border-border-bright bg-background/60 px-4 py-2 font-mono text-xs font-medium text-foreground transition hover:border-accent-ink/60 hover:bg-surface-hover"
          >
            <Download className="h-3.5 w-3.5 text-accent-ink" />
            <span>download.manifest</span>
          </button>
          <button
            type="button"
            data-testid="cert-share"
            onClick={handleShare}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-2 font-mono text-xs font-semibold",
              "bg-gradient-to-r from-accent-ink to-accent-violet text-background",
              "shadow-[0_0_20px_rgb(224_181_94_/_0.2)] transition-all hover:shadow-[0_0_30px_rgb(224_181_94_/_0.4)]",
            )}
          >
            <Share2 className="h-3.5 w-3.5" />
            <span>share.link</span>
          </button>
        </div>
      </div>
    </article>
  );
}

function MetadataRow({
  label,
  testid,
  children,
}: {
  label: string;
  testid?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-fg-faint">{label}</dt>
      <dd data-testid={testid} className="font-mono text-sm">
        {children}
      </dd>
    </div>
  );
}
