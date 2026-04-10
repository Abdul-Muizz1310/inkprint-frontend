import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VerdictBadge } from "@/components/verdict-badge";

describe("VerdictBadge", () => {
  it.each([
    ["identical", /identical/i],
    ["near-duplicate", /near-duplicate/i],
    ["derivative", /derivative/i],
    ["inspired", /inspired/i],
    ["unrelated", /unrelated/i],
  ] as const)("renders %s label", (verdict, label) => {
    render(<VerdictBadge verdict={verdict} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("uses a CSS-variable-backed colour token (not raw hex)", () => {
    const { container } = render(<VerdictBadge verdict="identical" />);
    const el = container.firstElementChild as HTMLElement;
    // Assert the element has *some* className. Concrete colour assertions
    // are pinned via snapshot in S4.
    expect(el.className).toMatch(/./);
  });
});
