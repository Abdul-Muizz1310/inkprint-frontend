import type { DiffVerdict } from "@/lib/schemas";
import { cn } from "@/lib/utils";

type VerdictBadgeProps = {
  verdict: DiffVerdict;
  className?: string;
};

const STYLES: Record<DiffVerdict, string> = {
  identical: "border-success/40 bg-success/10 text-success",
  "near-duplicate": "border-accent-ink/40 bg-accent-ink/10 text-accent-ink",
  derivative: "border-warning/40 bg-warning/10 text-warning",
  inspired: "border-accent-violet/40 bg-accent-violet/10 text-accent-violet",
  unrelated: "border-border-bright bg-surface text-fg-muted",
};

export function VerdictBadge({ verdict, className }: VerdictBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.15em]",
        STYLES[verdict],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {verdict}
    </span>
  );
}
