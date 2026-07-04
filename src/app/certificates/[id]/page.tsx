import Link from "next/link";
import { notFound } from "next/navigation";
import { CertificateCard } from "@/components/certificate-card";
import { PageFrame } from "@/components/terminal/PageFrame";
import { TerminalWindow } from "@/components/terminal/TerminalWindow";
import { ApiError, getCertificate, getCertificateDownloadPreview } from "@/lib/api";
import { PREVIEW_CHARS } from "@/lib/constants";
import { env } from "@/lib/env";
import { isUuid } from "@/lib/ids";

type PageProps = {
  params: Promise<{ id: string }>;
};

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

  // The card shows only the first PREVIEW_CHARS of the body (OPT-2). Never pull
  // the whole (up to ~1 MiB) document just to slice a short preview:
  //   - if the backend supplies `content_preview`, use it and make zero extra
  //     round-trips;
  //   - otherwise fetch only the leading prefix (Range + streamed early-cancel),
  //     which transfers kilobytes rather than the full body.
  let previewSource: string;
  if (typeof cert.content_preview === "string") {
    previewSource = cert.content_preview;
  } else {
    try {
      previewSource = await getCertificateDownloadPreview(id, PREVIEW_CHARS);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        notFound();
      }
      throw err;
    }
  }

  const digestPreview = previewSource.slice(0, PREVIEW_CHARS);
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
