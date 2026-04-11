"use client";

import { AlertTriangle, Check, X } from "lucide-react";
import { useCallback, useState } from "react";
import { LegalDisclaimer } from "@/components/legal-disclaimer";
import { PageFrame } from "@/components/terminal/PageFrame";
import { Prompt } from "@/components/terminal/Prompt";
import { TerminalWindow } from "@/components/terminal/TerminalWindow";
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
        setApiError("certificate not found");
      } else {
        setApiError("failed to load manifest");
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
      setParseError("invalid json");
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
        setApiError(`request failed (${err.status})`);
      } else {
        setApiError("unexpected error. please try again.");
      }
    } finally {
      setLoading(false);
    }
  }, [manifestText, originalText]);

  const canVerify = manifestText.trim().length > 0 && !loading;

  return (
    <PageFrame
      active="verify"
      statusLeft="inkprint.dev ~/verify"
      statusRight={
        <>
          <span>
            mode <span className="text-accent-ink">offline</span>
          </span>
        </>
      }
    >
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-col gap-1.5">
          <Prompt kind="comment">verify a c2pa manifest</Prompt>
          <Prompt kind="input">inkprint verify ./manifest.json</Prompt>
        </div>

        <TerminalWindow title="verify.request" statusDot="ink" statusLabel="ready">
          <div className="flex flex-col gap-6">
            {/* Load from cert id */}
            <div>
              <label
                htmlFor="cert-id-loader"
                className="mb-2 block font-mono text-[10px] uppercase tracking-[0.15em] text-fg-faint"
              >
                load manifest by certificate id
              </label>
              <div className="flex gap-2">
                <input
                  id="cert-id-loader"
                  type="text"
                  value={certIdInput}
                  onChange={(e) => setCertIdInput(e.target.value)}
                  placeholder="550e8400-e29b-41d4-a716-446655440000"
                  className="flex-1 rounded-lg border border-border bg-background/60 px-3 py-2 font-mono text-xs text-foreground caret-accent-ink placeholder:text-fg-faint focus:border-accent-ink/60 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={onLoadFromCertId}
                  disabled={!certIdInput.trim()}
                  className="rounded-lg border border-border-bright bg-background/60 px-4 font-mono text-xs text-foreground transition hover:border-accent-ink/60 hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  load
                </button>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label
                  htmlFor="manifest-input"
                  className="mb-2 block font-mono text-[10px] uppercase tracking-[0.15em] text-fg-faint"
                >
                  manifest.json
                </label>
                <textarea
                  id="manifest-input"
                  value={manifestText}
                  onChange={(e) => setManifestText(e.target.value)}
                  placeholder='{"@context": "https://c2pa.org/...", ...}'
                  rows={16}
                  className="block w-full rounded-lg border border-border bg-background/60 p-4 font-mono text-[11px] leading-relaxed text-foreground caret-accent-ink placeholder:text-fg-faint focus:border-accent-ink/60 focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="original-text-input"
                  className="mb-2 block font-mono text-[10px] uppercase tracking-[0.15em] text-fg-faint"
                >
                  original.txt <span className="text-fg-faint">{"// optional"}</span>
                </label>
                <textarea
                  id="original-text-input"
                  value={originalText}
                  onChange={(e) => setOriginalText(e.target.value)}
                  rows={16}
                  placeholder="paste the original text to enable hash check"
                  className="block w-full rounded-lg border border-border bg-background/60 p-4 font-mono text-[11px] leading-relaxed text-foreground caret-accent-ink placeholder:text-fg-faint focus:border-accent-ink/60 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="font-mono text-[11px] text-fg-faint">
                checks: signature · hash · timestamp
              </div>
              <button
                type="button"
                onClick={onVerify}
                disabled={!canVerify}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-5 py-2 font-mono text-sm font-semibold transition-all",
                  canVerify
                    ? "bg-gradient-to-r from-accent-ink to-accent-violet text-background shadow-[0_0_30px_rgb(224_181_94_/_0.25)] hover:shadow-[0_0_40px_rgb(224_181_94_/_0.45)]"
                    : "cursor-not-allowed bg-surface text-fg-faint",
                )}
              >
                <span className="text-background/70">$</span>
                <span>{loading ? "verifying…" : "verify"}</span>
              </button>
            </div>

            {parseError ? (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-lg border border-error/30 bg-error/5 px-3 py-2 font-mono text-xs text-error"
              >
                <span>⨯</span>
                <span>{parseError}</span>
              </div>
            ) : null}

            {apiError ? (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-lg border border-error/30 bg-error/5 px-3 py-2 font-mono text-xs text-error"
              >
                <span>⨯</span>
                <span>{apiError}</span>
              </div>
            ) : null}
          </div>
        </TerminalWindow>

        {result ? (
          <div className="mt-6">
            <TerminalWindow
              title="verify.result"
              statusDot={result.valid ? "green" : "red"}
              statusLabel={result.valid ? "valid" : "invalid"}
            >
              <div className="flex flex-col gap-4 font-mono text-sm">
                <div
                  className={cn(
                    "flex items-center gap-3",
                    result.valid ? "text-success" : "text-error",
                  )}
                >
                  {result.valid ? (
                    <Check className="h-5 w-5" aria-label="Valid" />
                  ) : (
                    <X className="h-5 w-5" aria-label="Invalid" />
                  )}
                  <span className="text-base font-semibold">
                    {result.valid ? "valid certificate" : "invalid certificate"}
                  </span>
                </div>

                <ul className="space-y-2">
                  {Object.entries(result.checks).map(([name, passed]) => (
                    <li key={name} className="flex items-center gap-3 text-xs">
                      {passed ? (
                        <Check className="h-4 w-4 text-success" />
                      ) : (
                        <X className="h-4 w-4 text-error" />
                      )}
                      <span className="text-fg-muted">{name}</span>
                      <span className="ml-auto tabular-nums text-fg-faint">
                        {passed ? "ok" : "fail"}
                      </span>
                    </li>
                  ))}
                </ul>

                {result.warnings.length > 0 ? (
                  <ul className="mt-2 space-y-2 rounded-lg border border-warning/30 bg-warning/5 p-3">
                    {result.warnings.map((w) => (
                      <li key={w} className="flex items-center gap-2 text-xs text-warning">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </TerminalWindow>
          </div>
        ) : null}

        <div className="mt-10">
          <LegalDisclaimer />
        </div>
      </div>
    </PageFrame>
  );
}
