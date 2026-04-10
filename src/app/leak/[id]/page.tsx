import { notFound } from "next/navigation";
import { LeakTerminal } from "@/components/leak-terminal";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function LeakScanPage({ params }: PageProps) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1
        className="font-serif text-4xl font-bold tracking-tight text-[var(--accent-ink)]"
        style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
      >
        Training-corpus leak scan
      </h1>
      <p className="mt-3 text-[var(--fg-muted)]">
        Streaming events from the backend. The terminal fills in as the scan progresses across
        public corpora.
      </p>
      <div className="mt-8">
        <LeakTerminal scanId={id} />
      </div>
    </main>
  );
}
