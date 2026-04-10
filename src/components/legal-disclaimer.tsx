export function LegalDisclaimer() {
  return (
    <aside
      role="note"
      data-testid="legal-disclaimer"
      className="mx-auto max-w-2xl rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--fg-muted)]"
    >
      <p className="font-semibold text-[var(--foreground)]">Not legal advice.</p>
      <p className="mt-2">
        inkprint issues cryptographic provenance records. Its certificates may support
        first-authorship claims under the Berne Convention's fixation principle and may help satisfy
        the EU AI Act's Article 50 detectability requirements. The tool assists, it does not
        arbitrate — consult a qualified attorney for any formal use.
      </p>
    </aside>
  );
}
