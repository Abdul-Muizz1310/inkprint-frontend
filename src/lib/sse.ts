import { proxyUrl } from "@/lib/backend-url";
import { type LeakEvent, LeakEvent as LeakEventSchema } from "@/lib/schemas";

export type LeakStreamHandlers = {
  onEvent: (event: LeakEvent) => void;
  onError: (err: Event) => void;
  onOpen?: () => void;
};

/**
 * Open an SSE connection to the leak-scan stream endpoint, through the
 * same-origin signing proxy (spec 04 §3): an `EventSource` cannot send a
 * header, so the proxy adds the platform token and pipes the stream back
 * unbuffered. Returns a `close()` function the caller must invoke on unmount.
 */
export function openLeakScanStream(scanId: string, handlers: LeakStreamHandlers): () => void {
  const url = proxyUrl(`/leak-scan/${encodeURIComponent(scanId)}/stream`);
  const source = new EventSource(url);

  source.onopen = () => handlers.onOpen?.();

  source.onmessage = (ev: MessageEvent) => {
    try {
      const raw = JSON.parse(ev.data);
      const parsed = LeakEventSchema.safeParse(raw);
      if (parsed.success) {
        handlers.onEvent(parsed.data);
      }
      // Unknown / malformed payloads are silently ignored on the happy
      // path; the terminal component decides whether to surface them.
    } catch (err) {
      handlers.onError(new ErrorEvent("error", { error: err }));
    }
  };

  source.onerror = (ev: Event) => handlers.onError(ev);

  return () => source.close();
}
