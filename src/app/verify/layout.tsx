import type { Metadata } from "next";

// The page is a client component, so its metadata lives in this segment layout.
export const metadata: Metadata = { title: "verify a c2pa manifest" };

export default function VerifyLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
