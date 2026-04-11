import Link from "next/link";
import { notFound } from "next/navigation";
import { CertificateCard } from "@/components/certificate-card";
import { PageFrame } from "@/components/terminal/PageFrame";
import { TerminalWindow } from "@/components/terminal/TerminalWindow";
import { ApiError, getCertificate, getCertificateDownload, getCertificateQrUrl } from "@/lib/api";
import { env } from "@/lib/env";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function CertificatePage({ params }: PageProps) {
  const { id } = await params;

  let cert: Awaited<ReturnType<typeof getCertificate>>;
  let text: string;
  try {
    [cert, text] = await Promise.all([getCertificate(id), getCertificateDownload(id)]);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }

  const digestPreview = text.slice(0, 200);
  const verifyUrl = `${env.NEXT_PUBLIC_SITE_URL}/verify?id=${cert.id}`;
  const qrUrl = getCertificateQrUrl(cert.id);
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
          <CertificateCard
            cert={cert}
            digestPreview={digestPreview}
            verifyUrl={verifyUrl}
            qrUrl={qrUrl}
          />
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
