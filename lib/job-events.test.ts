import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SSE_HEARTBEAT_MS,
  createEventStream,
  emitJobEvent,
  encodeJobEvent,
  subscribeToJobEvents,
} from "./job-events";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("job event bus", () => {
  it("delivers events to every subscriber and removes on unsubscribe", () => {
    const seen: string[] = [];
    const off = subscribeToJobEvents((e) => seen.push(`${e.jobId}:${e.status}`));
    emitJobEvent({ jobId: "j1", status: "running", at: 1 });
    off();
    emitJobEvent({ jobId: "j2", status: "failed", at: 2 });
    expect(seen).toEqual(["j1:running"]);
  });

  it("a throwing subscriber is dropped, and the write that notified it survives", () => {
    const seen: string[] = [];
    subscribeToJobEvents(() => {
      throw new Error("dead socket");
    });
    const off = subscribeToJobEvents((e) => seen.push(e.jobId));
    expect(() => emitJobEvent({ jobId: "j1", status: "queued", at: 1 })).not.toThrow();
    emitJobEvent({ jobId: "j2", status: "queued", at: 2 });
    expect(seen).toEqual(["j1", "j2"]);
  });

  it("encodes a valid SSE frame", () => {
    expect(encodeJobEvent({ jobId: "j1", status: "validating", at: 3 })).toBe(
      'event: job\ndata: {"jobId":"j1","status":"validating","at":3}\n\n',
    );
    expect(SSE_HEARTBEAT_MS).toBeGreaterThan(0);
  });
});

describe("event stream queue", () => {
  it("preserves order and wakes the reader", async () => {
    const stream = createEventStream();
    stream.push({ jobId: "a", status: "queued", at: 1 });
    stream.push({ jobId: "a", status: "running", at: 2 });
    expect((await stream.next())?.status).toBe("queued");
    expect((await stream.next())?.status).toBe("running");
  });

  it("resolves null after close, even to a parked reader", async () => {
    const stream = createEventStream();
    const parked = stream.next();
    stream.close();
    await expect(parked).resolves.toBeNull();
    stream.push({ jobId: "late", status: "queued", at: 9 });
    await expect(stream.next()).resolves.toBeNull();
  });

  it("drops the oldest past the buffer and reports it", async () => {
    const stream = createEventStream();
    for (let i = 0; i < 70; i++)
      stream.push({ jobId: `j${i}`, status: "queued", at: i });
    expect(stream.dropped).toBe(true);
    // The six oldest were dropped to keep the buffer at 64.
    expect((await stream.next())?.jobId).toBe("j6");
  });
});
