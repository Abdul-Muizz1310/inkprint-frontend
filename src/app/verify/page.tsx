"use client";

import { AlertTriangle, Check, X } from "lucide-react";
import { useCallback, useState } from "react";
import { LegalDisclaimer } from "@/components/legal-disclaimer";
import { ApiError, getCertificateManifest, verifyManifest } from "@/lib/api";
import type { VerifyResponse } from "@/lib/schemas";
import { cn } from "@/lib/utils";

export default function VerifyPage() {
  const [manifestText, setManifestText] = useState("");
  const [originalText, setOriginalText] = useState("");
  const [certIdInput, setCertIdInput] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResponse | null>(null);

  const onLoadFromCertId = useCallback(async () => {
    setApiError(null);
    setParseError(null);
    try {
      const manifest = await getCertificateManifest(certIdInput.trim());
      setManifestText(JSON.stringify(manifest, null, 2));
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setApiError("Certificate not found");
      } else {
        setApiError("Failed to load manifest");
      }
    }
  }, [certIdInput]);

  const onVerify = useCallback(async () => {
    setParseError(null);
    setApiError(null);
    setResult(null);

    let manifest: Record<string, unknown>;
    try {
      manifest = JSON.parse(manifestText) as Record<string, unknown>;
    } catch {
      setParseError("Invalid JSON");
      return;
    }

    setLoading(true);
    try {
      const response = await verifyManifest({
        manifest,
        text: originalText || undefined,
      });
      setResult(response);
    } catch (err) {
      if (err instanceof ApiError) {
        setApiError(`Request failed (${err.status})`);
      } else {
        setApiError("Unexpected error. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }, [manifestText, originalText]);

  const canVerify = manifestText.trim().length > 0 && !loading;

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1
        className="font-serif text-4xl font-bold tracking-tight text-[var(--accent-ink)]"
        style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
      >
        Verify a certificate
      </h1>
      <p className="mt-3 text-[var(--fg-muted)]">
        Paste a C2PA-style manifest and (optionally) the original text. We check the signature,
        hash, and timestamp against the published public key.
      </p>

      <div className="mt-8 space-y-6">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <label
              htmlFor="cert-id-loader"
              className="text-xs font-medium uppercase tracking-wide text-[var(--fg-muted)]"
            >
              Load manifest by certificate id
            </label>
          </div>
          <div className="flex gap-2">
            <input
              id="cert-id-loader"
              type="text"
              value={certIdInput}
              onChange={(e) => setCertIdInput(e.target.value)}
              placeholder="550e8400-e29b-41d4-a716-446655440000"
              className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 font-mono text-sm text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
            <button
              type="button"
              onClick={onLoadFromCertId}
              disabled={!certIdInput.trim()}
              className="rounded-lg border border-[var(--border-bright)] bg-[var(--background)] px-4 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Load
            </button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label
              htmlFor="manifest-input"
              className="mb-2 block text-xs font-medium uppercase tracking-wide text-[var(--fg-muted)]"
            >
              Manifest JSON
            </label>
            <textarea
              id="manifest-input"
              value={manifestText}
              onChange={(e) => setManifestText(e.target.value)}
              placeholder='{"@context": "c2pa", ...}'
              rows={16}
              className="block w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 font-mono text-xs text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>
          <div>
            <label
              htmlFor="original-text-input"
              className="mb-2 block text-xs font-medium uppercase tracking-wide text-[var(--fg-muted)]"
            >
              Original text <span className="normal-case">(optional, enables hash check)</span>
            </label>
            <textarea
              id="original-text-input"
              value={originalText}
              onChange={(e) => setOriginalText(e.target.value)}
              rows={16}
              className="block w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 font-mono text-xs text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={onVerify}
          disabled={!canVerify}
          className={cn(
            "inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-semibold transition",
            canVerify
              ? "bg-[var(--accent-ink)] text-[var(--primary-foreground)] hover:opacity-90"
              : "cursor-not-allowed bg-[var(--muted)] text-[var(--fg-muted)]",
          )}
        >
          {loading ? "Verifying…" : "Verify"}
        </button>

        {parseError ? (
          <div
            role="alert"
            className="rounded-lg border border-[var(--error)] bg-[var(--background)] p-4 text-sm text-[var(--error)]"
          >
            {parseError}
          </div>
        ) : null}

        {apiError ? (
          <div
            role="alert"
            className="rounded-lg border border-[var(--error)] bg-[var(--background)] p-4 text-sm text-[var(--error)]"
          >
            {apiError}
          </div>
        ) : null}

        {result ? (
          <div
            className={cn(
              "rounded-xl border p-6",
              result.valid ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50",
            )}
          >
            <div className="flex items-center gap-3">
              {result.valid ? (
                <Check className="h-6 w-6 text-emerald-600" aria-label="Valid" />
              ) : (
                <X className="h-6 w-6 text-rose-600" aria-label="Invalid" />
              )}
              <h2 className="text-lg font-semibold">
                {result.valid ? "Valid certificate" : "Invalid certificate"}
              </h2>
            </div>
            <ul className="mt-4 space-y-2">
              {Object.entries(result.checks).map(([name, passed]) => (
                <li key={name} className="flex items-center gap-3 font-mono text-sm">
                  {passed ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <X className="h-4 w-4 text-rose-600" />
                  )}
                  <span>{name}</span>
                </li>
              ))}
            </ul>
            {result.warnings.length > 0 ? (
              <ul className="mt-4 space-y-2">
                {result.warnings.map((w) => (
                  <li key={w} className="flex items-center gap-3 text-sm text-amber-700">
                    <AlertTriangle className="h-4 w-4" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <LegalDisclaimer />
      </div>
    </main>
  );
}
