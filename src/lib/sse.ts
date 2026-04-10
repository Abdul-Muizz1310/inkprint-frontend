import { env } from "@/lib/env";
import { type LeakEvent, LeakEvent as LeakEventSchema } from "@/lib/schemas";

export type LeakStreamHandlers = {
  onEvent: (event: LeakEvent) => void;
  onError: (err: Event) => void;
  onOpen?: () => void;
};

/**
 * Open an SSE connection to the leak-scan stream endpoint.
 * Returns a `close()` function the caller must invoke on unmount.
 */
export function openLeakScanStream(scanId: string, handlers: LeakStreamHandlers): () => void {
  const url = `${env.NEXT_PUBLIC_API_URL}/leak-scan/${scanId}/stream`;
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
