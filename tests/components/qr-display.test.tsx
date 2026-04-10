import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QRDisplay } from "@/components/qr-display";

describe("QRDisplay", () => {
  it("renders an SVG when no src is provided", () => {
    const { container } = render(<QRDisplay value="https://example.com" alt="Verification QR" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders an <img> when src is provided", () => {
    render(
      <QRDisplay
        value="https://example.com"
        src="https://inkprint-backend.onrender.com/certificates/abc/qr"
        alt="Verification QR"
      />,
    );
    const img = screen.getByRole("img", { name: /verification qr/i });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://inkprint-backend.onrender.com/certificates/abc/qr");
  });

  it("respects the size prop", () => {
    const { container } = render(<QRDisplay value="https://example.com" size={200} />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toHaveStyle({ width: "200px", height: "200px" });
  });
});
