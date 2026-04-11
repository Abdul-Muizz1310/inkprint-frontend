import Link from "next/link";
import { PageFrame } from "@/components/terminal/PageFrame";
import { TerminalWindow } from "@/components/terminal/TerminalWindow";

export default function NotFound() {
  return (
    <PageFrame statusLeft="inkprint.dev ~/certificates/404">
      <div className="mx-auto max-w-2xl pt-16">
        <TerminalWindow title="error.log" statusDot="red" statusLabel="404">
          <div className="space-y-4 font-mono text-sm">
            <div className="flex items-center gap-2 text-fg-faint">
              <span className="text-error">$</span>
              <span>inkprint certificate show ./unknown</span>
            </div>
            <div className="text-error">⨯ certificate not found</div>
            <p className="text-fg-muted">
              we couldn&apos;t find a certificate with that id. it may have been deleted, or the id
              may be a typo.
            </p>
            <div className="pt-2">
              <Link href="/" className="text-accent-ink hover:underline">
                ← back to editor
              </Link>
            </div>
          </div>
        </TerminalWindow>
      </div>
    </PageFrame>
  );
}
