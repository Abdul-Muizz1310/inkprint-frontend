export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <h1 className="font-serif text-4xl font-bold tracking-tight text-[var(--accent-ink)]">
        inkprint
      </h1>
      <p className="mt-4 max-w-md text-center text-lg text-[var(--fg-muted)]">
        Content provenance &amp; AI-training-data detection.
      </p>
    </main>
  );
}
