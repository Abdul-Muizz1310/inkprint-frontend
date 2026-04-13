import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openLeakScanStream } from "@/lib/sse";

// Minimal mock EventSource.
class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  emit(data: unknown) {
    this.onmessage?.(new MessageEvent("message", { data: JSON.stringify(data) }));
  }

  emitRaw(data: string) {
    this.onmessage?.(new MessageEvent("message", { data }));
  }

  open() {
    this.onopen?.(new Event("open"));
  }

  error() {
    this.onerror?.(new Event("error"));
  }

  close() {
    this.closed = true;
  }
}

describe("openLeakScanStream", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = "https://inkprint-backend.onrender.com";
    MockEventSource.instances = [];
    vi.stubGlobal("EventSource", MockEventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("dispatches parsed LeakEvents via onEvent", () => {
    const onEvent = vi.fn();
    const onError = vi.fn();

    openLeakScanStream("scan-1", { onEvent, onError });

    const src = MockEventSource.instances[0];
    expect(src).toBeDefined();
    src.emit({ type: "started" });
    src.emit({ type: "hit", corpus: "cc", url: "https://x", excerpt: "x", score: 0.9 });
    src.emit({ type: "done" });

    expect(onEvent).toHaveBeenCalledTimes(3);
    expect(onEvent).toHaveBeenNthCalledWith(1, { type: "started" });
  });

  it("calls onError on malformed JSON without crashing", () => {
    const onEvent = vi.fn();
    const onError = vi.fn();

    openLeakScanStream("scan-1", { onEvent, onError });
    const src = MockEventSource.instances[0];
    src.emitRaw("{not json");

    expect(onError).toHaveBeenCalled();
    expect(onEvent).not.toHaveBeenCalled();
  });

  it("close() closes the underlying EventSource", () => {
    const close = openLeakScanStream("scan-1", { onEvent: vi.fn(), onError: vi.fn() });
    const src = MockEventSource.instances[0];

    close();
    expect(src.closed).toBe(true);
  });

  it("invokes onOpen when the source opens", () => {
    const onOpen = vi.fn();
    openLeakScanStream("scan-1", { onEvent: vi.fn(), onError: vi.fn(), onOpen });
    MockEventSource.instances[0].open();
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("silently ignores events that fail Zod validation", () => {
    const onEvent = vi.fn();
    const onError = vi.fn();

    openLeakScanStream("scan-1", { onEvent, onError });
    const src = MockEventSource.instances[0];
    // Valid JSON but not a valid LeakEvent (unknown type)
    src.emit({ type: "unknown_event_type", extra: true });

    expect(onEvent).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("forwards native EventSource errors via onerror", () => {
    const onEvent = vi.fn();
    const onError = vi.fn();

    openLeakScanStream("scan-1", { onEvent, onError });
    const src = MockEventSource.instances[0];
    src.error();

    expect(onError).toHaveBeenCalledOnce();
  });
});
