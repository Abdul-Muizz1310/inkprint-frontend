import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DiffView } from "@/components/diff-view";

const stats = { overlap_pct: 72, hamming: 8, cosine: 0.88 };

describe("DiffView", () => {
  it("renders the stats row", () => {
    render(
      <DiffView
        original="the quick brown fox"
        current="the slow brown fox"
        stats={stats}
        verdict="derivative"
      />,
    );
    expect(screen.getByText(/72/)).toBeInTheDocument();
    expect(screen.getByText(/derivative/i)).toBeInTheDocument();
  });

  it("mounts the underlying diff table for changed input", () => {
    const { container } = render(
      <DiffView
        original="the quick brown fox"
        current="the slow brown fox"
        stats={stats}
        verdict="derivative"
      />,
    );
    // The library uses a <table> to render diffs. jsdom does not run the
    // library's text-measurement code, so we assert only that the mount
    // point (and our wrapper chrome) rendered without crashing.
    expect(container.querySelector("table")).toBeInTheDocument();
    expect(screen.getByText(/72%/)).toBeInTheDocument();
  });

  it("renders identical input without crashing", () => {
    render(
      <DiffView
        original="same"
        current="same"
        stats={{ overlap_pct: 100, hamming: 0, cosine: 1 }}
        verdict="identical"
      />,
    );
    expect(screen.getByText(/identical/i)).toBeInTheDocument();
  });

  it("renders empty strings without crashing", () => {
    render(
      <DiffView
        original=""
        current=""
        stats={{ overlap_pct: 0, hamming: 0, cosine: 0 }}
        verdict="unrelated"
      />,
    );
    expect(screen.getByText(/unrelated/i)).toBeInTheDocument();
  });
});
