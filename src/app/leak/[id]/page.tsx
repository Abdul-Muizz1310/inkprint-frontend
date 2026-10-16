import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LeakTerminal } from "@/components/leak-terminal";
import { PageFrame } from "@/components/terminal/PageFrame";
import { Prompt } from "@/components/terminal/Prompt";
import { TerminalWindow } from "@/components/terminal/TerminalWindow";
import { isUuid } from "@/lib/ids";

type PageProps = {
  params: Promise<{ id: string }>;
};

// A scan of a user's own text: previewable when shared, never in search results. The title
// comes from the param alone, never from the scan.
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return { title: `leak scan ${id.slice(0, 8)}`, robots: { index: false } };
}

export default async function LeakScanPage({ params }: PageProps) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  return (
    <PageFrame
      active="leak"
      statusLeft={`inkprint.dev ~/leak/${id.slice(0, 8)}`}
      statusRight={
        <>
          <span>
            transport <span className="text-accent-ink">sse</span>
          </span>
        </>
      }
    >
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-col gap-1.5">
          <Prompt kind="comment">training-corpus leak scan</Prompt>
          <Prompt kind="input">inkprint leak-scan --stream</Prompt>
        </div>

        <TerminalWindow title={`scan-${id.slice(0, 8)}.stream`} statusDot="ink" statusLabel="live">
          <LeakTerminal scanId={id} />
        </TerminalWindow>
      </div>
    </PageFrame>
  );
}
