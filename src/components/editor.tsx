"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { ApiError, createCertificate } from "@/lib/api";
import { cn } from "@/lib/utils";

const DEFAULT_MAX_BYTES = 1_048_576; // 1 MiB

type EditorProps = {
  maxBytes?: number;
};

function byteLength(s: string): number {
  return new Blob([s]).size;
}

function extractErrorMessage(body: unknown, status: number): string {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail[0] && typeof detail[0] === "object") {
      const first = detail[0] as { msg?: string };
      if (first.msg) return first.msg;
    }
  }
  return `request failed (${status})`;
}

/**
 * Code-editor block: mac window chrome, line number gutter, monospaced
 * textarea, `$ fingerprint` gradient submit pill.
 */
export function Editor({ maxBytes = DEFAULT_MAX_BYTES }: EditorProps) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [author, setAuthor] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bytes = useMemo(() => byteLength(text), [text]);
  const overLimit = bytes > maxBytes;

  const disabled = !text.trim() || !author.trim() || submitting || overLimit;

  const lineCount = Math.max(8, text.split("\n").length);
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

  const onSubmit = useCallback(async () => {
    if (disabled) return;
    setError(null);
    setSubmitting(true);
    try {
      const cert = await createCertificate({ text, author });
      router.push(`/certificates/${cert.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(extractErrorMessage(err.body, err.status));
      } else {
        setError("unexpected error. please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }, [author, disabled, router, text]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex w-full flex-col gap-4"
    >
      {/* Editor code block */}
      <div className="group relative overflow-hidden rounded-xl border border-border bg-background/60 transition-colors focus-within:border-accent-ink/60 focus-within:shadow-[0_0_0_1px_rgb(224_181_94_/_0.3),0_0_30px_rgb(224_181_94_/_0.15)]">
        <div className="flex items-center gap-2 border-b border-border bg-surface/50 px-3 py-2 font-mono text-[11px] text-fg-faint">
          <span className="inline-block h-2 w-2 rounded-full bg-mac-red/80" />
          <span className="inline-block h-2 w-2 rounded-full bg-mac-yellow/80" />
          <span className="inline-block h-2 w-2 rounded-full bg-mac-green/80" />
          <span className="ml-2 text-accent-ink">manifest.txt</span>
          <span className="ml-auto tabular-nums">
            {text.length.toLocaleString()} chars · {bytes.toLocaleString()} bytes
          </span>
        </div>
        <div className="flex">
          {/* Line number gutter */}
          <div
            aria-hidden
            className="select-none border-r border-border bg-background/40 px-3 py-4 text-right font-mono text-xs leading-6 text-fg-faint"
          >
            {lineNumbers.map((n) => (
              <div key={n} className="tabular-nums">
                {String(n).padStart(2, "0")}
              </div>
            ))}
          </div>
          <textarea
            id="editor-root"
            data-testid="editor-root"
            aria-label="text to fingerprint"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={submitting}
            rows={8}
            placeholder="// paste or type any text. every byte is canonicalised, hashed, and sealed."
            className="flex-1 resize-y bg-transparent px-4 py-4 font-mono text-sm leading-6 text-foreground caret-accent-ink placeholder:text-fg-faint focus:outline-none disabled:opacity-60"
          />
        </div>
        {overLimit ? (
          <div className="border-t border-border bg-error/5 px-4 py-1.5 font-mono text-[11px] text-error">
            ⨯ text too large (max {maxBytes.toLocaleString()} bytes)
          </div>
        ) : null}
      </div>

      {/* Author input — separate smaller block */}
      <div className="flex items-center gap-3 rounded-lg border border-border bg-background/60 px-4 py-3 font-mono text-sm transition-colors focus-within:border-accent-ink/60">
        <span className="select-none text-fg-faint">$</span>
        <label htmlFor="editor-author-input" className="sr-only">
          author
        </label>
        <span className="text-fg-faint">author=</span>
        <input
          id="editor-author-input"
          data-testid="editor-author-input"
          type="text"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          disabled={submitting}
          placeholder="you@example.com"
          className="flex-1 bg-transparent text-foreground caret-accent-ink placeholder:text-fg-faint focus:outline-none disabled:opacity-60"
        />
      </div>

      {error ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-error/30 bg-error/5 px-3 py-2 font-mono text-xs text-error"
        >
          <span>⨯</span>
          <span>{error}</span>
        </div>
      ) : null}

      {/* Submit row */}
      <div className="flex items-center justify-between gap-4">
        <div className="font-mono text-xs text-fg-faint">
          <span>alg:</span> <span className="text-fg-muted">ed25519</span>
          <span className="mx-2 text-fg-faint">·</span>
          <span>hash:</span> <span className="text-accent-ink">sha-256</span>
        </div>
        <button
          type="submit"
          data-testid="editor-fingerprint-button"
          disabled={disabled}
          className={cn(
            "group relative inline-flex h-10 items-center gap-2 overflow-hidden rounded-full px-5 font-mono text-sm font-semibold transition-all",
            disabled
              ? "cursor-not-allowed bg-surface text-fg-faint"
              : "bg-gradient-to-r from-accent-ink to-accent-violet text-background shadow-[0_0_30px_rgb(224_181_94_/_0.25)] hover:shadow-[0_0_40px_rgb(224_181_94_/_0.45)]",
          )}
        >
          <span className="text-background/70">$</span>
          {submitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>fingerprinting…</span>
            </>
          ) : (
            <>
              <span>fingerprint</span>
              <ArrowRight className="h-3.5 w-3.5 text-background/70 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
