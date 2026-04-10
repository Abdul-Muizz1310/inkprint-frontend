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
      <div className="flex items-center gap-4">
        <VerdictBadge verdict={verdict} />
        <div className="flex gap-4 text-sm text-[var(--fg-muted)]">
          <span>
            overlap <strong className="text-[var(--foreground)]">{stats.overlap_pct}%</strong>
          </span>
          <span>
            hamming <strong className="text-[var(--foreground)]">{stats.hamming}</strong>
          </span>
          <span>
            cosine <strong className="text-[var(--foreground)]">{stats.cosine.toFixed(2)}</strong>
          </span>
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-[var(--border)]">
        <ReactDiffViewer
          oldValue={original}
          newValue={current}
          splitView
          hideLineNumbers={false}
          compareMethod={undefined}
          useDarkTheme={false}
        />
      </div>
    </div>
  );
}
