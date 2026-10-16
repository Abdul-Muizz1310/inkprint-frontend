import type { Metadata } from "next";

// The page is a client component, so its metadata lives in this segment layout.
export const metadata: Metadata = { title: "derivative-work detection" };

export default function CompareLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
