import { notFound } from "next/navigation";
import { CertificateCard } from "@/components/certificate-card";
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

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <CertificateCard
        cert={cert}
        digestPreview={digestPreview}
        verifyUrl={verifyUrl}
        qrUrl={qrUrl}
      />
      <div className="mt-8 text-center">
        <a href="/" className="text-sm text-[var(--fg-muted)] hover:text-[var(--accent-ink)]">
          ← Issue another certificate
        </a>
      </div>
    </main>
  );
}
