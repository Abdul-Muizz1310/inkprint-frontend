/**
 * Pure string formatters. No side effects, no DOM, no date libs.
 */

export function truncateMiddle(s: string, first: number, last: number): string {
  if (s.length <= first + last + 1) return s;
  return `${s.slice(0, first)}…${s.slice(s.length - last)}`;
}

const UTC_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "long",
  timeStyle: "medium",
  timeZone: "UTC",
});

export function formatIssuedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${UTC_FORMATTER.format(d)} UTC`;
}

export function formatKeyId(keyId: string | null | undefined): string {
  if (!keyId) return "—";
  return keyId.slice(0, 16);
}
