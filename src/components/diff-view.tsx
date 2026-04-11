"use client";

import ReactDiffViewer from "react-diff-viewer-continued";
import type { DiffVerdict } from "@/lib/schemas";
import { VerdictBadge } from "./verdict-badge";

type DiffViewProps = {
  original: string;
  current: string;
  stats: { overlap_pct: number; hamming: number; cosine: number };
  verdict: DiffVerdict;
};

export function DiffView({ original, current, stats, verdict }: DiffViewProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-surface/50 px-4 py-3 font-mono text-xs">
        <VerdictBadge verdict={verdict} />
        <div className="flex gap-5 text-fg-muted">
          <span>
            <span className="text-fg-faint">overlap</span>{" "}
            <strong className="tabular-nums text-accent-ink">{stats.overlap_pct}%</strong>
          </span>
          <span>
            <span className="text-fg-faint">hamming</span>{" "}
            <strong className="tabular-nums text-foreground">{stats.hamming}</strong>
          </span>
          <span>
            <span className="text-fg-faint">cosine</span>{" "}
            <strong className="tabular-nums text-foreground">{stats.cosine.toFixed(2)}</strong>
          </span>
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-background">
        <ReactDiffViewer
          oldValue={original}
          newValue={current}
          splitView
          hideLineNumbers={false}
          useDarkTheme
        />
      </div>
    </div>
  );
}
