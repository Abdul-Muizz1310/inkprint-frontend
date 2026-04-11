"use client";

import { PageFrame } from "@/components/terminal/PageFrame";
import { TerminalWindow } from "@/components/terminal/TerminalWindow";

type ErrorPageProps = {
  error: Error;
  reset: () => void;
};

export default function CertificateError({ error: _error, reset }: ErrorPageProps) {
  return (
    <PageFrame statusLeft="inkprint.dev ~/certificates/error">
      <div className="mx-auto max-w-2xl pt-16">
        <TerminalWindow title="error.log" statusDot="red" statusLabel="5xx">
          <div className="space-y-4 font-mono text-sm">
            <div className="flex items-center gap-2 text-fg-faint">
              <span className="text-error">$</span>
              <span>inkprint certificate fetch</span>
            </div>
            <div className="text-error">⨯ could not load certificate</div>
            <p className="text-fg-muted">
              something went wrong while fetching this certificate. the backend may be warming up.
            </p>
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-accent-ink to-accent-violet px-5 py-2 text-sm font-semibold text-background shadow-[0_0_20px_rgb(224_181_94_/_0.2)] transition hover:shadow-[0_0_30px_rgb(224_181_94_/_0.4)]"
            >
              <span className="text-background/70">$</span>
              <span>retry</span>
            </button>
          </div>
        </TerminalWindow>
      </div>
    </PageFrame>
  );
}
