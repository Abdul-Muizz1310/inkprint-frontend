import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppNav } from "@/components/terminal/AppNav";
import { PageFrame } from "@/components/terminal/PageFrame";
import { Prompt } from "@/components/terminal/Prompt";
import { StatusBar } from "@/components/terminal/StatusBar";
import { TerminalWindow } from "@/components/terminal/TerminalWindow";

describe("AppNav", () => {
  it("renders brand and primary nav links", () => {
    render(<AppNav />);
    expect(screen.getByText("inkprint")).toBeInTheDocument();
    expect(screen.getByText("home")).toBeInTheDocument();
    expect(screen.getByText("verify")).toBeInTheDocument();
    expect(screen.getByText("compare")).toBeInTheDocument();
    expect(screen.getByText("github")).toBeInTheDocument();
    expect(screen.getByText("api")).toBeInTheDocument();
  });

  it.each([
    "home",
    "verify",
    "compare",
  ] as const)("marks the %s link active with an underline accent", (active) => {
    render(<AppNav active={active} />);
    const link = screen.getByText(active);
    expect(link.className).toMatch(/after:/);
  });

  it("marks no link active when active is undefined", () => {
    render(<AppNav />);
    for (const label of ["home", "verify", "compare"]) {
      expect(screen.getByText(label).className).not.toMatch(/after:/);
    }
  });

  it("opens external links in a new tab safely", () => {
    render(<AppNav />);
    const github = screen.getByText("github").closest("a");
    expect(github).toHaveAttribute("target", "_blank");
    expect(github).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });
});

describe("Prompt", () => {
  it.each([
    ["input", "$"],
    ["output", ">"],
    ["comment", "//"],
  ] as const)("renders the %s marker", (kind, marker) => {
    render(<Prompt kind={kind}>hello</Prompt>);
    expect(screen.getByText(marker)).toBeInTheDocument();
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  it("defaults to the input marker", () => {
    render(<Prompt>cmd</Prompt>);
    expect(screen.getByText("$")).toBeInTheDocument();
  });

  it("renders a blinking cursor only when requested", () => {
    const { container, rerender } = render(<Prompt cursor>x</Prompt>);
    expect(container.querySelector(".cursor-blink")).not.toBeNull();
    rerender(<Prompt>x</Prompt>);
    expect(container.querySelector(".cursor-blink")).toBeNull();
  });
});

describe("TerminalWindow", () => {
  it("renders its title and children", () => {
    render(
      <TerminalWindow title="manifest.json">
        <p>body content</p>
      </TerminalWindow>,
    );
    expect(screen.getByText("manifest.json")).toBeInTheDocument();
    expect(screen.getByText("body content")).toBeInTheDocument();
  });

  it.each([
    "red",
    "yellow",
    "green",
    "ink",
  ] as const)("renders a %s status dot with a label", (statusDot) => {
    const { container } = render(
      <TerminalWindow title="t" statusDot={statusDot} statusLabel="live">
        x
      </TerminalWindow>,
    );
    expect(screen.getByText("live")).toBeInTheDocument();
    // One of the three mac dots plus the status dot — at least 4 dots total.
    expect(container.querySelectorAll("span.rounded-full").length).toBeGreaterThanOrEqual(4);
  });

  it("adds a pulse ring for the ink status", () => {
    const { container } = render(
      <TerminalWindow title="t" statusDot="ink" statusLabel="scanning">
        x
      </TerminalWindow>,
    );
    expect(container.querySelector(".pulse-ring")).not.toBeNull();
  });

  it("renders no status dot when statusDot is off", () => {
    const { container } = render(
      <TerminalWindow title="t" statusDot="off" statusLabel="idle">
        x
      </TerminalWindow>,
    );
    // Only the three mac window dots, no extra status dot.
    expect(container.querySelectorAll("span.rounded-full").length).toBe(3);
  });

  it("applies the strong glow variant", () => {
    const { container } = render(
      <TerminalWindow title="t" strong>
        x
      </TerminalWindow>,
    );
    expect(container.querySelector(".terminal-glow-strong")).not.toBeNull();
  });

  it("uses the standard glow by default", () => {
    const { container } = render(<TerminalWindow title="t">x</TerminalWindow>);
    expect(container.querySelector(".terminal-glow")).not.toBeNull();
  });
});

describe("StatusBar", () => {
  it("renders left and right slots", () => {
    render(<StatusBar left={<span>ready</span>} right={<span>v0.1.0</span>} />);
    expect(screen.getByText("ready")).toBeInTheDocument();
    expect(screen.getByText("v0.1.0")).toBeInTheDocument();
  });
});

describe("PageFrame", () => {
  it("wraps children with nav and status bar", () => {
    render(
      <PageFrame active="verify" statusLeft="connected" statusRight="42ms">
        <p>page body</p>
      </PageFrame>,
    );
    // Nav (brand) + content + status bar slots all present.
    expect(screen.getByText("inkprint")).toBeInTheDocument();
    expect(screen.getByText("page body")).toBeInTheDocument();
    expect(screen.getByText("connected")).toBeInTheDocument();
    expect(screen.getByText("42ms")).toBeInTheDocument();
    // The active nav link is highlighted.
    expect(screen.getByText("verify").className).toMatch(/after:/);
  });

  it("accepts a custom max width", () => {
    const { container } = render(
      <PageFrame maxWidth="max-w-3xl">
        <p>narrow</p>
      </PageFrame>,
    );
    expect(container.querySelector("main")?.className).toContain("max-w-3xl");
  });
});
