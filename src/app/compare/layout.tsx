import type { Metadata } from "next";
import { SITE } from "@/lib/site/config";
import { pageMetadata } from "@/lib/site/metadata";

// The page is a client component, so its metadata lives in this segment layout.
export const metadata: Metadata = pageMetadata(SITE, "/compare", {
  title: "derivative-work detection",
  description:
    "Diff a new text against a certified parent with SimHash and embedding cosine: identical, near-duplicate, derivative, inspired or unrelated.",
});

export default function CompareLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
