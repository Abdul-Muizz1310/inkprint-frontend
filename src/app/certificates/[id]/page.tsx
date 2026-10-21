import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CertificateCard } from "@/components/certificate-card";
import { PageFrame } from "@/components/terminal/PageFrame";
import { TerminalWindow } from "@/components/terminal/TerminalWindow";
import { ApiError } from "@/lib/api-client";
import { PREVIEW_CHARS } from "@/lib/constants";
import { env } from "@/lib/env";
import { isUuid } from "@/lib/ids";
import { getCertificate } from "@/lib/server/backend-api";

type PageProps = {
  params: Promise<{ id: string }>;
};

// A user's own certificate: previewable when shared, never in search results. The title
// comes from the param alone; fetching here would add a round-trip to a cold backend.
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return { title: `certificate ${id.slice(0, 8)}`, robots: { index: false } };
}

export default async function CertificatePage({ params }: PageProps) {
  const { id } = await params;

  // Negative-space: reject malformed ids before any backend round-trip,
  // matching the /compare and /leak/[id] gates.
  if (!isUuid(id)) notFound();

  let cert: Awaited<ReturnType<typeof getCertificate>>;
  try {
    cert = await getCertificate(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }

  // The digest shows the certificate's own words, which GET /certificates/{id}
  // returns; /download is a zip archive and must never be read as text.
  const digestPreview = cert.text.slice(0, PREVIEW_CHARS);
  const verifyUrl = `${env.NEXT_PUBLIC_SITE_URL}/verify?id=${cert.id}`;
  const shortId = cert.id.slice(0, 8);

  return (
    <PageFrame
      statusLeft={`inkprint.dev ~/certificates/${shortId}`}
      statusRight={
        <>
          <span>
            status <span className="text-success">signed</span>
          </span>
          <span className="text-fg-faint">·</span>
          <span>
            alg <span className="text-accent-ink">ed25519</span>
          </span>
        </>
      }
    >
      <div className="mx-auto max-w-4xl">
        <TerminalWindow
          title={`certificate-${shortId}.json`}
          statusDot="ink"
          statusLabel="sealed"
          strong
          bodyClassName="p-0"
        >
          <CertificateCard cert={cert} digestPreview={digestPreview} verifyUrl={verifyUrl} />
        </TerminalWindow>

        <div className="mt-6 text-center font-mono text-xs text-fg-muted">
          <Link href="/" className="hover:text-accent-ink">
            ← issue another certificate
          </Link>
        </div>
      </div>
    </PageFrame>
  );
}
