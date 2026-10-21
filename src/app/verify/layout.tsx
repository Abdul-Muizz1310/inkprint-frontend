import type { Metadata } from "next";
import { SITE } from "@/lib/site/config";
import { pageMetadata } from "@/lib/site/metadata";

// The page is a client component, so its metadata lives in this segment layout.
export const metadata: Metadata = pageMetadata(SITE, "/verify", {
  title: "verify a c2pa manifest",
  description:
    "Paste a C2PA manifest or load one by certificate id, then check its Ed25519 signature, content hash and timestamp, with the original text if you have it.",
});

export default function VerifyLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
