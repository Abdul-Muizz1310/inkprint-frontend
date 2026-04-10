"use client";

type ErrorPageProps = {
  error: Error;
  reset: () => void;
};

export default function CertificateError({ error: _error, reset }: ErrorPageProps) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24 text-center">
      <h1 className="font-serif text-3xl font-bold text-[var(--accent-ink)]">
        Could not load certificate
      </h1>
      <p className="mt-4 text-[var(--fg-muted)]">
        Something went wrong while fetching this certificate.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-8 inline-flex items-center rounded-lg bg-[var(--accent-ink)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
      >
        Try again
      </button>
    </main>
  );
}
