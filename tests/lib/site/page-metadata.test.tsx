import { render, screen } from "@testing-library/react";
import type { Metadata } from "next";
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";
import { generateMetadata as certificateMetadata } from "@/app/certificates/[id]/page";
import CompareLayout, { metadata as compareMetadata } from "@/app/compare/layout";
import { generateMetadata as leakMetadata } from "@/app/leak/[id]/page";
import { metadata as homeMetadata } from "@/app/page";
import VerifyLayout, { metadata as verifyMetadata } from "@/app/verify/layout";

const VALID_ID = "550e8400-e29b-41d4-a716-446655440000";
const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe("page titles (T-FE-09)", () => {
  let fetchSpy: MockInstance<typeof fetch>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("no fetch in metadata"));
  });
  afterEach(() => fetchSpy.mockRestore());

  it("keeps the default title on the home page and makes it the canonical", () => {
    expect(homeMetadata).toEqual({ alternates: { canonical: "/" } });
  });

  it("titles /verify and /compare from the comment line that heads each page", () => {
    expect(verifyMetadata).toEqual({ title: "verify a c2pa manifest" });
    expect(compareMetadata).toEqual({ title: "derivative-work detection" });
  });

  it("renders the client page inside each metadata layout", () => {
    render(
      <>
        <VerifyLayout>
          <p>verify page</p>
        </VerifyLayout>
        <CompareLayout>
          <p>compare page</p>
        </CompareLayout>
      </>,
    );
    expect(screen.getByText("verify page")).toBeInTheDocument();
    expect(screen.getByText("compare page")).toBeInTheDocument();
  });

  it("titles a certificate by its short id and keeps it out of search", async () => {
    expect(await certificateMetadata(params(VALID_ID))).toEqual({
      title: "certificate 550e8400",
      robots: { index: false },
    });
  });

  it("titles a leak scan by its short id and keeps it out of search", async () => {
    expect(await leakMetadata(params(VALID_ID))).toEqual({
      title: "leak scan 550e8400",
      robots: { index: false },
    });
  });

  it("never fetches the record to title it", async () => {
    await certificateMetadata(params(VALID_ID));
    await leakMetadata(params(VALID_ID));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("bounds the title of an id that is not a uuid, and still keeps it out of search", async () => {
    const id = "x".repeat(500);
    expect(await certificateMetadata(params(id))).toEqual({
      title: "certificate xxxxxxxx",
      robots: { index: false },
    });
    expect(await leakMetadata(params(id))).toEqual({
      title: "leak scan xxxxxxxx",
      robots: { index: false },
    });
  });

  it("sets no openGraph or twitter on any page, and a canonical only on the home page", async () => {
    const pages: Metadata[] = [
      verifyMetadata,
      compareMetadata,
      await certificateMetadata(params(VALID_ID)),
      await leakMetadata(params(VALID_ID)),
    ];
    for (const page of pages) {
      expect(page).not.toHaveProperty("openGraph");
      expect(page).not.toHaveProperty("twitter");
      expect(page).not.toHaveProperty("alternates");
    }
    expect(homeMetadata).not.toHaveProperty("openGraph");
    expect(homeMetadata).not.toHaveProperty("twitter");
  });
});
