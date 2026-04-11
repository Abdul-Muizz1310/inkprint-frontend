export function LegalDisclaimer() {
  return (
    <aside
      role="note"
      data-testid="legal-disclaimer"
      className="mx-auto max-w-3xl rounded-xl border border-border bg-surface/50 p-5 font-mono text-[11px] leading-relaxed text-fg-muted"
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="text-accent-ink">{"//"}</span>
        <span className="font-semibold uppercase tracking-[0.2em] text-fg-faint">
          legal.disclaimer
        </span>
      </div>
      <p className="font-semibold text-accent-ink">Not legal advice.</p>
      <p className="mt-2">
        inkprint issues cryptographic provenance records. Its certificates may support
        first-authorship claims under the Berne Convention&apos;s fixation principle and may help
        satisfy the EU AI Act&apos;s Article 50 detectability requirements. The tool assists, it
        does not arbitrate — consult a qualified attorney for any formal use.
      </p>
    </aside>
  );
}
