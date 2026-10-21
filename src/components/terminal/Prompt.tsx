import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Kind = "input" | "output" | "comment";

export type PromptProps = {
  kind?: Kind;
  children: ReactNode;
  className?: string;
  cursor?: boolean;
  /** `h1` when the line is the page's title (spec 03): same look, and the page's one heading. */
  as?: "div" | "h1";
};

/**
 * One line of a fake terminal. `$` for input, `>` for output,
 * `//` for comments.
 */
export function Prompt({
  kind = "input",
  children,
  className,
  cursor = false,
  as: Line = "div",
}: PromptProps) {
  const marker = kind === "input" ? "$" : kind === "output" ? ">" : "//";
  const markerClass =
    kind === "input"
      ? "text-fg-faint"
      : kind === "output"
        ? "text-accent-ink"
        : "text-fg-faint italic";
  const textClass =
    kind === "output"
      ? "text-foreground font-semibold"
      : kind === "comment"
        ? "text-fg-muted italic"
        : "text-fg-muted";

  return (
    <Line className={cn("flex items-baseline gap-2.5 font-mono text-sm", className)}>
      <span aria-hidden="true" className={cn("select-none", markerClass)}>
        {marker}
      </span>
      <span className={textClass}>{children}</span>
      {cursor && <span className="ml-0.5 inline-block h-3.5 w-1.5 bg-accent-ink cursor-blink" />}
    </Line>
  );
}
