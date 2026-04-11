"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, getLeakScan, type LeakScanResult } from "@/lib/api";
import type { LeakEvent } from "@/lib/schemas";
import { openLeakScanStream } from "@/lib/sse";
import { cn } from "@/lib/utils";

type LeakTerminalProps = {
  scanId: string;
};

type Status = "pending" | "running" | "done" | "failed";

function eventLine(event: LeakEvent): {
  marker: string;
  text: string;
  tone: "faint" | "ink" | "success" | "error";
} {
  switch (event.type) {
    case "started":
      return { marker: "▶", text: "scan started", tone: "faint" };
    case "scanning":
      return {
        marker: "⋯",
        text: `scanning ${event.corpus}${event.snapshot ? ` (${event.snapshot})` : ""}`,
        tone: "ink",
      };
    case "hit":
      return {
        marker: "✴",
        text: `hit in ${event.corpus}: ${event.url} (score ${event.score.toFixed(2)})`,
        tone: "ink",
      };
    case "done":
      return { marker: "✓", text: "scan complete", tone: "success" };
    case "failed":
      return { marker: "✗", text: `scan failed: ${event.reason}`, tone: "error" };
  }
}

const TONE_CLASS: Record<"faint" | "ink" | "success" | "error", string> = {
  faint: "text-fg-muted",
  ink: "text-accent-ink",
  success: "text-success",
  error: "text-error",
};

const STATUS_CLASS: Record<Status, string> = {
  pending: "border-border-bright bg-surface text-fg-muted",
  running: "border-accent-ink/40 bg-accent-ink/10 text-accent-ink",
  done: "border-success/40 bg-success/10 text-success",
  failed: "border-error/40 bg-error/10 text-error",
};

export function LeakTerminal({ scanId }: LeakTerminalProps) {
  const [lines, setLines] = useState<ReturnType<typeof eventLine>[]>([]);
  const [status, setStatus] = useState<Status>("pending");
  const [finalResult, setFinalResult] = useState<LeakScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fallbackPoll() {
      try {
        const result = await getLeakScan(scanId);
        if (cancelled) return;
        setFinalResult(result);
        if (result.status === "done" || result.status === "failed") {
          setStatus(result.status);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setError("scan not found");
        } else {
          setError("failed to load scan");
        }
      }
    }

    const close = openLeakScanStream(scanId, {
      onEvent: (event) => {
        if (cancelled) return;
        setLines((prev) => [...prev, eventLine(event)]);
        if (event.type === "scanning") setStatus("running");
        if (event.type === "done") {
          setStatus("done");
          fallbackPoll();
        }
        if (event.type === "failed") setStatus("failed");
      },
      onError: () => {
        if (cancelled) return;
        fallbackPoll();
      },
    });

    closeRef.current = close;
    return () => {
      cancelled = true;
      close();
    };
  }, [scanId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 font-mono text-xs">
          <span className="text-fg-faint">scan_id</span>
          <span className="text-foreground">{scanId}</span>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.15em]",
            STATUS_CLASS[status],
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full bg-current",
              status === "running" && "pulse-ring",
            )}
          />
          {status}
        </span>
      </div>

      <pre
        data-testid="leak-terminal"
        className="min-h-[280px] overflow-x-auto rounded-lg border border-border bg-background p-4 font-mono text-[11px] leading-relaxed"
      >
        <div className="mb-2 flex items-center gap-2 text-fg-faint">
          <span className="text-accent-ink">$</span>
          <span>inkprint leak-scan --stream</span>
        </div>
        {lines.length === 0 ? (
          <span className="text-fg-faint">
            waiting for events
            <span className="ml-0.5 inline-block h-3 w-1.5 bg-accent-ink cursor-blink align-middle" />
          </span>
        ) : (
          lines.map((line, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: append-only log list
            <div key={i} className="flex items-start gap-2">
              <span className={cn("shrink-0", TONE_CLASS[line.tone])}>{line.marker}</span>
              <span className={cn("min-w-0", TONE_CLASS[line.tone])}>{line.text}</span>
            </div>
          ))
        )}
      </pre>

      {error ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-error/30 bg-error/5 px-3 py-2 font-mono text-xs text-error"
        >
          <span>⨯</span>
          <span>{error}</span>
        </div>
      ) : null}

      {finalResult && Array.isArray(finalResult.hits) && finalResult.hits.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-fg-faint">
            <span className="text-accent-ink">{"//"}</span>
            <span>hits · {finalResult.hits.length}</span>
          </div>
          {finalResult.hits.map((hit, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: server-ordered hit list
              key={i}
              className="rounded-lg border border-border bg-surface/50 p-4 font-mono text-[11px]"
            >
              <pre className="whitespace-pre-wrap text-fg-muted">
                {JSON.stringify(hit, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
