import { BackendStatus } from "@/components/backend-status";
import { Editor } from "@/components/editor";
import { LegalDisclaimer } from "@/components/legal-disclaimer";
import { PageFrame } from "@/components/terminal/PageFrame";
import { Prompt } from "@/components/terminal/Prompt";
import { TerminalWindow } from "@/components/terminal/TerminalWindow";

export default function HomePage() {
  return (
    <PageFrame
      active="home"
      statusLeft="inkprint.dev ~/"
      statusRight={
        <>
          <span>UTF-8</span>
          <span className="text-fg-faint">·</span>
          <span>
            c2pa <span className="text-accent-ink">v2.2</span>
          </span>
          <span className="text-fg-faint">·</span>
          <span>
            sig <span className="text-accent-ink">ed25519</span>
          </span>
        </>
      }
    >
      <div className="flex flex-col gap-14 pt-6 md:pt-10">
        {/* Hero */}
        <section className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="flex flex-col gap-7">
            <div className="flex flex-col gap-1.5">
              <Prompt kind="comment">welcome to inkprint</Prompt>
              <Prompt kind="input">whoami</Prompt>
              <Prompt kind="output">a cryptographic provenance ledger for text</Prompt>
              <Prompt kind="input">describe</Prompt>
              <Prompt kind="output">every document gets a signed c2pa certificate</Prompt>
              <Prompt kind="input" cursor>
                text
              </Prompt>
            </div>

            <h1 className="font-mono text-4xl font-semibold leading-[1.05] tracking-tight text-foreground md:text-5xl lg:text-[3.25rem]">
              prove who wrote it{" "}
              <span className="relative text-accent-ink">
                first
                <span className="absolute -bottom-1 left-0 h-[3px] w-full bg-accent-ink/60 shadow-[0_0_12px_rgb(224_181_94_/_0.8)]" />
              </span>
              .
            </h1>
            <p className="max-w-xl font-mono text-sm leading-relaxed text-fg-muted md:text-base">
              inkprint is a provenance compiler. Text goes in, out comes a C2PA-aligned manifest
              signed with Ed25519 — a certificate anyone can verify offline and scan against public
              AI training corpora.
            </p>

            <Editor />
            <BackendStatus />
          </div>

          <div className="lg:mt-6">
            <TerminalWindow
              title="sample.certificate.json"
              statusDot="ink"
              statusLabel="preview"
              strong
            >
              <div className="flex flex-col gap-4 font-mono text-xs">
                <div className="flex items-center gap-2 text-fg-faint">
                  <span className="text-accent-ink">$</span>
                  <span className="text-foreground">
                    inkprint fingerprint &ldquo;the quick brown fox…&rdquo;
                  </span>
                </div>

                <div className="rounded-lg border border-border bg-background/40 p-4">
                  <div className="mb-3 flex items-center justify-between text-[9px] uppercase tracking-[0.15em] text-fg-faint">
                    <span>certificate.v1</span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
                      issued
                    </span>
                  </div>
                  <div className="space-y-2 text-[11px]">
                    <div className="flex items-baseline gap-2">
                      <span className="w-20 shrink-0 text-fg-faint">author</span>
                      <span className="text-foreground">alice@example.com</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="w-20 shrink-0 text-fg-faint">hash</span>
                      <span className="text-foreground">e3b0c4…b855</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="w-20 shrink-0 text-fg-faint">sig.alg</span>
                      <span className="text-accent-ink">Ed25519</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="w-20 shrink-0 text-fg-faint">key_id</span>
                      <span className="text-foreground">inkprint-ed25519-2026-04</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="w-20 shrink-0 text-fg-faint">schema</span>
                      <span className="text-foreground">c2pa.org/v2.2</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-accent-ink/30 bg-accent-ink/5 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[9px] uppercase tracking-[0.15em] text-fg-faint">
                      verify.result
                    </span>
                    <span className="text-xs font-bold tracking-[0.1em] text-accent-ink">
                      VALID
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 text-[10px] text-fg-muted">
                    <div className="flex justify-between">
                      <span>signature</span>
                      <span className="text-success">✓</span>
                    </div>
                    <div className="flex justify-between">
                      <span>hash</span>
                      <span className="text-success">✓</span>
                    </div>
                    <div className="flex justify-between">
                      <span>timestamp</span>
                      <span className="text-success">✓</span>
                    </div>
                  </div>
                </div>
              </div>
            </TerminalWindow>
          </div>
        </section>

        {/* Feature strip */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            {
              kw: "sign",
              title: "durable fingerprint",
              body: "SHA-256 + Ed25519 over canonicalised UTF-8, plus a SimHash and a 768d embedding — exact bytes and semantic shape, both.",
            },
            {
              kw: "verify",
              title: "c2pa manifest",
              body: "every certificate is a content credential matching the schema the EU AI Act Article 50 will cite. verifies offline against the published public key.",
            },
            {
              kw: "scan",
              title: "training-corpus probe",
              body: "query common crawl, huggingface datasets, the stack v2 for near-duplicate hits. streams hits live as the scan runs.",
            },
          ].map((f) => (
            <div
              key={f.kw}
              className="rounded-xl border border-border bg-surface/50 p-5 transition-colors hover:border-border-bright hover:bg-surface"
            >
              <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-accent-ink">
                <span>{"//"}</span>
                <span>{f.kw}</span>
              </div>
              <div className="mb-1.5 font-mono text-base font-semibold text-foreground">
                {f.title}
              </div>
              <p className="text-sm leading-relaxed text-fg-muted">{f.body}</p>
            </div>
          ))}
        </section>

        {/* Legal */}
        <LegalDisclaimer />
      </div>
    </PageFrame>
  );
}
