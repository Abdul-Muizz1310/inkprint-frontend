"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { ApiError, createCertificate } from "@/lib/api";
import { cn } from "@/lib/utils";
import { LegalDisclaimer } from "./legal-disclaimer";

const DEFAULT_MAX_BYTES = 1_048_576; // 1 MiB

type EditorProps = {
  maxBytes?: number;
};

function byteLength(s: string): number {
  return new Blob([s]).size;
}

export function Editor({ maxBytes = DEFAULT_MAX_BYTES }: EditorProps) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [author, setAuthor] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bytes = useMemo(() => byteLength(text), [text]);
  const overLimit = bytes > maxBytes;

  const disabled = !text.trim() || !author.trim() || submitting || overLimit;

  const onSubmit = useCallback(async () => {
    if (disabled) return;
    setError(null);
    setSubmitting(true);
    try {
      const cert = await createCertificate({ text, author });
      router.push(`/certificates/${cert.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        const body = err.body as { detail?: unknown };
        const detail = body?.detail;
        if (typeof detail === "string") {
          setError(detail);
        } else if (Array.isArray(detail) && detail[0] && typeof detail[0] === "object") {
          const first = detail[0] as { msg?: string };
          setError(first.msg ?? `Request failed (${err.status})`);
        } else {
          setError(`Request failed (${err.status})`);
        }
      } else {
        setError("Unexpected error. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }, [author, disabled, router, text]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <label
          htmlFor="editor-root"
          className="mb-2 block text-xs font-medium uppercase tracking-wide text-[var(--fg-muted)]"
        >
          Text
        </label>
        <textarea
          id="editor-root"
          data-testid="editor-root"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste or type your text…"
          rows={12}
          className="block w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 font-mono text-sm text-[var(--foreground)] shadow-sm focus:border-[var(--ring)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
        <div className="mt-2 flex justify-between text-xs text-[var(--fg-muted)]">
          <span>
            {text.length.toLocaleString()} chars · {bytes.toLocaleString()} bytes
          </span>
          {overLimit ? (
            <span className="text-[var(--error)]">
              Text too large (max {maxBytes.toLocaleString()} bytes)
            </span>
          ) : null}
        </div>
      </div>

      <div>
        <label
          htmlFor="editor-author-input"
          className="mb-2 block text-xs font-medium uppercase tracking-wide text-[var(--fg-muted)]"
        >
          Author
        </label>
        <input
          id="editor-author-input"
          data-testid="editor-author-input"
          type="text"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="you@example.com or did:key:..."
          className="block w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm text-[var(--foreground)] shadow-sm focus:border-[var(--ring)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
      </div>

      <div>
        <button
          type="button"
          data-testid="editor-fingerprint-button"
          disabled={disabled}
          onClick={onSubmit}
          className={cn(
            "inline-flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold transition",
            disabled
              ? "cursor-not-allowed bg-[var(--muted)] text-[var(--fg-muted)]"
              : "bg-[var(--accent-ink)] text-[var(--primary-foreground)] hover:opacity-90",
          )}
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Fingerprinting…
            </>
          ) : (
            "Fingerprint"
          )}
        </button>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-[var(--error)] bg-[var(--background)] p-4 text-sm text-[var(--error)]"
        >
          {error}
        </div>
      ) : null}

      <LegalDisclaimer />
    </div>
  );
}
