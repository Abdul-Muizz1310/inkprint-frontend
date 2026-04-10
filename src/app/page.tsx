import { Editor } from "@/components/editor";

export default function Home() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <header className="mb-12 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--fg-muted)]">
          inkprint
        </p>
        <h1
          className="mt-3 font-serif text-4xl font-bold tracking-tight text-[var(--accent-ink)] md:text-5xl"
          style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
        >
          Content provenance, sealed.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-[var(--fg-muted)]">
          Paste any text, receive a cryptographically signed certificate of authorship with a
          durable fingerprint. Verifiable offline. Checkable against public training corpora.
        </p>
      </header>

      <Editor />
    </main>
  );
}
