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

function eventLine(event: LeakEvent): string {
  switch (event.type) {
    case "started":
      return "▶ scan started";
    case "scanning":
      return `⋯ scanning ${event.corpus}${event.snapshot ? ` (${event.snapshot})` : ""}`;
    case "hit":
      return `✴ hit in ${event.corpus}: ${event.url} (score ${event.score.toFixed(2)})`;
    case "done":
      return "✓ scan complete";
    case "failed":
      return `✗ scan failed: ${event.reason}`;
  }
}

export function LeakTerminal({ scanId }: LeakTerminalProps) {
  const [lines, setLines] = useState<string[]>([]);
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
          setError("Scan not found");
        } else {
          setError("Failed to load scan");
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
        <h2 className="font-mono text-sm text-[var(--fg-muted)]">Leak scan {scanId}</h2>
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wide",
            status === "pending" && "border-stone-200 bg-stone-100 text-stone-800",
            status === "running" && "border-sky-200 bg-sky-100 text-sky-800",
            status === "done" && "border-emerald-200 bg-emerald-100 text-emerald-800",
            status === "failed" && "border-rose-200 bg-rose-100 text-rose-800",
          )}
        >
          {status}
        </span>
      </div>

      <pre
        data-testid="leak-terminal"
        className="min-h-[240px] overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 font-mono text-xs text-[var(--foreground)]"
      >
        {lines.length === 0 ? (
          <span className="text-[var(--fg-muted)]">waiting for events…</span>
        ) : (
          lines.map((line, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: append-only log list
            <div key={i}>{line}</div>
          ))
        )}
      </pre>

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-[var(--error)] bg-[var(--background)] p-4 text-sm text-[var(--error)]"
        >
          {error}
        </div>
      ) : null}

      {finalResult && Array.isArray(finalResult.hits) && finalResult.hits.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Hits</h3>
          {finalResult.hits.map((hit, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: server-ordered hit list
              key={i}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-sm"
            >
              <pre className="whitespace-pre-wrap text-xs text-[var(--fg-muted)]">
                {JSON.stringify(hit, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
