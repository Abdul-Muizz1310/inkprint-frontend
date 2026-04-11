import { notFound } from "next/navigation";
import { LeakTerminal } from "@/components/leak-terminal";
import { PageFrame } from "@/components/terminal/PageFrame";
import { Prompt } from "@/components/terminal/Prompt";
import { TerminalWindow } from "@/components/terminal/TerminalWindow";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function LeakScanPage({ params }: PageProps) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

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
