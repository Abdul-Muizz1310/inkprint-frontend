import { env } from "@/lib/env";
import { CertificateResponse, DiffResponse, LeakScanResponse, VerifyResponse } from "@/lib/schemas";

/**
 * Typed HTTP client for the inkprint backend.
 *
 * Every call parses its response through a Zod schema. Non-2xx responses
 * become `ApiError`. Network failures also become `ApiError` (status=0) so
 * callers have a single error type to render.
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`API ${status}`);
    this.name = "ApiError";
  }
}

function apiUrl(path: string): string {
  return `${env.NEXT_PUBLIC_API_URL}${path}`;
}

async function parseErrorBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(apiUrl(path), init);
  } catch (err) {
    throw new ApiError(0, err instanceof Error ? err.message : "network error");
  }
  if (!response.ok) {
    throw new ApiError(response.status, await parseErrorBody(response));
  }
  return response;
}

async function postJson(path: string, body: unknown): Promise<Response> {
  return request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function createCertificate(input: {
  text: string;
  author: string;
}): Promise<CertificateResponse> {
  const response = await postJson("/certificates", input);
  return CertificateResponse.parse(await response.json());
}

export async function getCertificate(id: string): Promise<CertificateResponse> {
  const response = await request(`/certificates/${id}`);
  return CertificateResponse.parse(await response.json());
}

export async function getCertificateDownload(id: string): Promise<string> {
  const response = await request(`/certificates/${id}/download`);
  return response.text();
}

export async function getCertificateManifest(id: string): Promise<Record<string, unknown>> {
  const response = await request(`/certificates/${id}/manifest`);
  return (await response.json()) as Record<string, unknown>;
}

/** Returns the backend QR image URL. Not a fetch — meant for `<img src>`. */
export function getCertificateQrUrl(id: string): string {
  return apiUrl(`/certificates/${id}/qr`);
}

export async function verifyManifest(input: {
  manifest: Record<string, unknown>;
  text?: string;
}): Promise<VerifyResponse> {
  const response = await postJson("/verify", input);
  return VerifyResponse.parse(await response.json());
}

export async function diffText(input: { parent_id: string; text: string }): Promise<DiffResponse> {
  const response = await postJson("/diff", input);
  return DiffResponse.parse(await response.json());
}

export async function createLeakScan(input: {
  certificate_id: string;
  corpora?: string[];
}): Promise<LeakScanResponse> {
  const response = await postJson("/leak-scan", input);
  return LeakScanResponse.parse(await response.json());
}

export type LeakScanResult = {
  scan_id: string;
  status: "pending" | "running" | "done" | "failed";
  hits?: unknown[];
  [k: string]: unknown;
};

export async function getLeakScan(scan_id: string): Promise<LeakScanResult> {
  const response = await request(`/leak-scan/${scan_id}`);
  return (await response.json()) as LeakScanResult;
}
