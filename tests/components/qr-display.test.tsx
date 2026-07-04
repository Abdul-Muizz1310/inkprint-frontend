import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QRDisplay } from "@/components/qr-display";

describe("QRDisplay", () => {
  it("renders a client-side SVG QR encoding the given value", () => {
    const { container } = render(<QRDisplay value="https://example.com/verify?id=abc" />);
    // Single source of truth: qrcode.react's QRCodeSVG — never a backend <img>.
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(container.querySelector("img")).not.toBeInTheDocument();
  });

  it("respects the size prop", () => {
    const { container } = render(<QRDisplay value="https://example.com" size={200} />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toHaveStyle({ width: "200px", height: "200px" });
  });
});
