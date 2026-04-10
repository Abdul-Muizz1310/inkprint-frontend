export default function NotFound() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24 text-center">
      <h1 className="font-serif text-3xl font-bold text-[var(--accent-ink)]">
        Certificate not found
      </h1>
      <p className="mt-4 text-[var(--fg-muted)]">We couldn't find a certificate with that id.</p>
      <a href="/" className="mt-8 inline-block text-sm text-[var(--accent-ink)] hover:underline">
        ← Back to editor
      </a>
    </main>
  );
}
