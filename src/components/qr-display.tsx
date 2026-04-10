"use client";

import { QRCodeSVG } from "qrcode.react";

type QRDisplayProps = {
  value: string;
  size?: number;
  src?: string;
  alt?: string;
};

export function QRDisplay({ value, size = 120, src, alt = "QR code" }: QRDisplayProps) {
  if (src) {
    return (
      <div style={{ width: `${size}px`, height: `${size}px` }}>
        {/* biome-ignore lint/performance/noImgElement: backend-rendered QR PNG */}
        <img src={src} alt={alt} width={size} height={size} />
      </div>
    );
  }

  return (
    <div style={{ width: `${size}px`, height: `${size}px` }}>
      <QRCodeSVG value={value} size={size} level="M" />
    </div>
  );
}
