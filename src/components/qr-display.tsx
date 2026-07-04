"use client";

import { QRCodeSVG } from "qrcode.react";

type QRDisplayProps = {
  /** The URL the QR encodes. This is the single source of truth — it is the
   * same `/verify?id=<uuid>` link printed in the certificate footer, which
   * the verify page auto-loads on arrival. */
  value: string;
  size?: number;
  title?: string;
};

export function QRDisplay({ value, size = 120, title = "Verification QR" }: QRDisplayProps) {
  return (
    <div style={{ width: `${size}px`, height: `${size}px` }}>
      <QRCodeSVG value={value} size={size} level="M" title={title} />
    </div>
  );
}
