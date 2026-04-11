"use client";

import { useCallback, useState } from "react";
import { DiffView } from "@/components/diff-view";
import { PageFrame } from "@/components/terminal/PageFrame";
import { Prompt } from "@/components/terminal/Prompt";
import { TerminalWindow } from "@/components/terminal/TerminalWindow";
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
          err.status === 404 ? "parent certificate not found" : `request failed (${err.status})`,
        );
      } else {
        setError("unexpected error. please try again.");
      }
    } finally {
      setLoading(false);
    }
  }, [newText, parentId]);

  return (
    <PageFrame
      active="compare"
      statusLeft="inkprint.dev ~/compare"
      statusRight={
        <>
          <span>
            algo <span className="text-accent-ink">simhash + cosine</span>
          </span>
        </>
      }
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-1.5">
          <Prompt kind="comment">derivative-work detection</Prompt>
          <Prompt kind="input">
            inkprint diff --parent {"<uuid>"} --text {"<file>"}
          </Prompt>
        </div>

        <TerminalWindow title="diff.request" statusDot="ink" statusLabel="ready">
          <div className="flex flex-col gap-5">
            <div>
              <label
                htmlFor="compare-parent-id"
                className="mb-2 block font-mono text-[10px] uppercase tracking-[0.15em] text-fg-faint"
              >
                parent_id
              </label>
              <input
                id="compare-parent-id"
                type="text"
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                placeholder="550e8400-e29b-41d4-a716-446655440000"
                className="block w-full rounded-lg border border-border bg-background/60 px-3 py-2 font-mono text-xs text-foreground caret-accent-ink placeholder:text-fg-faint focus:border-accent-ink/60 focus:outline-none"
              />
              {parentId.length > 0 && !validParent ? (
                <p className="mt-1 font-mono text-[11px] text-error">⨯ must be a uuid</p>
              ) : null}
            </div>

            <div>
              <label
                htmlFor="compare-new-text"
                className="mb-2 block font-mono text-[10px] uppercase tracking-[0.15em] text-fg-faint"
              >
                new.txt
              </label>
              <textarea
                id="compare-new-text"
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                rows={10}
                placeholder="paste the text you want to compare against the parent"
                className="block w-full rounded-lg border border-border bg-background/60 p-4 font-mono text-[11px] leading-relaxed text-foreground caret-accent-ink placeholder:text-fg-faint focus:border-accent-ink/60 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="font-mono text-[11px] text-fg-faint">
                verdict: identical · near-duplicate · derivative · inspired · unrelated
              </div>
              <button
                type="button"
                onClick={onCompare}
                disabled={!canSubmit}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-5 py-2 font-mono text-sm font-semibold transition-all",
                  canSubmit
                    ? "bg-gradient-to-r from-accent-ink to-accent-violet text-background shadow-[0_0_30px_rgb(224_181_94_/_0.25)] hover:shadow-[0_0_40px_rgb(224_181_94_/_0.45)]"
                    : "cursor-not-allowed bg-surface text-fg-faint",
                )}
              >
                <span className="text-background/70">$</span>
                <span>{loading ? "comparing…" : "compare"}</span>
              </button>
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
          </div>
        </TerminalWindow>

        {state ? (
          <div className="mt-6">
            <TerminalWindow title="diff.result" statusDot="ink" statusLabel={state.diff.verdict}>
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
            </TerminalWindow>
          </div>
        ) : null}
      </div>
    </PageFrame>
  );
}
