"use client";

import { useCallback, useState } from "react";
import { DiffView } from "@/components/diff-view";
import { ApiError, diffText, getCertificateDownload } from "@/lib/api";
import type { DiffResponse } from "@/lib/schemas";
import { cn } from "@/lib/utils";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type CompareState = {
  original: string;
  current: string;
  diff: DiffResponse;
};

export default function ComparePage() {
  const [parentId, setParentId] = useState("");
  const [newText, setNewText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<CompareState | null>(null);

  const validParent = UUID_RE.test(parentId.trim());
  const canSubmit = validParent && newText.trim().length > 0 && !loading;

  const onCompare = useCallback(async () => {
    setError(null);
    setState(null);
    setLoading(true);
    try {
      const trimmed = parentId.trim();
      const [original, diff] = await Promise.all([
        getCertificateDownload(trimmed),
        diffText({ parent_id: trimmed, text: newText }),
      ]);
      setState({ original, current: newText, diff });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.status === 404 ? "Parent certificate not found" : `Request failed (${err.status})`,
        );
      } else {
        setError("Unexpected error. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }, [newText, parentId]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <h1
        className="font-serif text-4xl font-bold tracking-tight text-[var(--accent-ink)]"
        style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
      >
        Compare to a certificate
      </h1>
      <p className="mt-3 text-[var(--fg-muted)]">
        Supply a parent certificate id and the new text. We fetch the original from inkprint and
        produce a derivative-work verdict.
      </p>

      <div className="mt-8 space-y-6">
        <div>
          <label
            htmlFor="compare-parent-id"
            className="mb-2 block text-xs font-medium uppercase tracking-wide text-[var(--fg-muted)]"
          >
            Parent certificate id
          </label>
          <input
            id="compare-parent-id"
            type="text"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            placeholder="550e8400-e29b-41d4-a716-446655440000"
            className="block w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 font-mono text-sm text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
          {parentId.length > 0 && !validParent ? (
            <p className="mt-1 text-xs text-[var(--error)]">Must be a UUID.</p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="compare-new-text"
            className="mb-2 block text-xs font-medium uppercase tracking-wide text-[var(--fg-muted)]"
          >
            New text
          </label>
          <textarea
            id="compare-new-text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            rows={10}
            className="block w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 font-mono text-sm text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>

        <button
          type="button"
          onClick={onCompare}
          disabled={!canSubmit}
          className={cn(
            "inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-semibold transition",
            canSubmit
              ? "bg-[var(--accent-ink)] text-[var(--primary-foreground)] hover:opacity-90"
              : "cursor-not-allowed bg-[var(--muted)] text-[var(--fg-muted)]",
          )}
        >
          {loading ? "Comparing…" : "Compare"}
        </button>

        {error ? (
          <div
            role="alert"
            className="rounded-lg border border-[var(--error)] bg-[var(--background)] p-4 text-sm text-[var(--error)]"
          >
            {error}
          </div>
        ) : null}

        {state ? (
          <DiffView
            original={state.original}
            current={state.current}
            stats={{
              overlap_pct: state.diff.overlap_pct,
              hamming: state.diff.hamming,
              cosine: state.diff.cosine,
            }}
            verdict={state.diff.verdict}
          />
        ) : null}
      </div>
    </main>
  );
}
