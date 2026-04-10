import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LegalDisclaimer } from "@/components/legal-disclaimer";

describe("LegalDisclaimer", () => {
  it("renders the 'not legal advice' phrase", () => {
    render(<LegalDisclaimer />);
    expect(screen.getByText(/not legal advice/i)).toBeInTheDocument();
  });

  it("mentions the Berne Convention", () => {
    render(<LegalDisclaimer />);
    expect(screen.getByText(/berne/i)).toBeInTheDocument();
  });

  it("mentions the EU AI Act", () => {
    render(<LegalDisclaimer />);
    expect(screen.getByText(/eu ai act/i)).toBeInTheDocument();
  });

  it("has an accessible role", () => {
    render(<LegalDisclaimer />);
    expect(screen.getByRole("note")).toBeInTheDocument();
  });
});
