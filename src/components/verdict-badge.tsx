import type { DiffVerdict } from "@/lib/schemas";
import { cn } from "@/lib/utils";

type VerdictBadgeProps = {
  verdict: DiffVerdict;
  className?: string;
};

const STYLES: Record<DiffVerdict, string> = {
  identical: "bg-emerald-100 text-emerald-800 border-emerald-200",
  "near-duplicate": "bg-sky-100 text-sky-800 border-sky-200",
  derivative: "bg-amber-100 text-amber-800 border-amber-200",
  inspired: "bg-violet-100 text-violet-800 border-violet-200",
  unrelated: "bg-stone-100 text-stone-800 border-stone-200",
};

export function VerdictBadge({ verdict, className }: VerdictBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wide",
        STYLES[verdict],
        className,
      )}
    >
      {verdict}
    </span>
  );
}
