/**
 * Job event bus — the pipe that lets surfaces stop asking.
 *
 * Every job state change already flows through one place (`jobstore.update`),
 * so the store knows exactly when a job moves. This module is the outbound
 * half: subscribers register, `emitJobEvent` publishes, and an SSE route
 * streams the changes to the browser. The client then replaces its blind
 * re-fetch loops with "tell me when something moved".
 *
 * In-process by design: a Next.js serverless instance holds its own bus, and
 * its own requests land in it. Cross-instance fan-out is not attempted here —
 * a deployment that routes job mutations through one control plane (the
 * compose stack does; a multi-instance Vercel deployment would need a Redis
 * pub/sub hop) still converges because every client re-syncs on connect and
 * on reconnect.
 */

export type JobEvent = {
  /** The job's own id, so a client can patch one row instead of re-listing. */
  jobId: string;
  status: string;
  at: number;
};

type Subscriber = (event: JobEvent) => void;

const subscribers = new Set<Subscriber>();

/** Cap on buffered events while a stream is between writes. */
const MAX_BUFFERED = 64;

export function subscribeToJobEvents(sub: Subscriber): () => void {
  subscribers.add(sub);
  return () => {
    subscribers.delete(sub);
  };
}

/** Publish one state change. Never throws into the caller's write path. */
export function emitJobEvent(event: JobEvent): void {
  for (const sub of subscribers) {
    try {
      sub(event);
    } catch {
      // A dead subscriber must never break the job write that notified it.
      subscribers.delete(sub);
    }
  }
}

/**
 * Encode one event as an SSE frame. Events carry the fields a row needs to
 * re-render; a client that wants the full record re-fetches exactly one job.
 */
export function encodeJobEvent(event: JobEvent): string {
  return `event: job\ndata: ${JSON.stringify(event)}\n\n`;
}

/** Heartbeat so proxies do not idle-close the stream. */
export const SSE_HEARTBEAT_MS = 15_000;

/**
 * A per-connection outbound queue with bounded buffering.
 *
 * The stream writer pulls from this; a slow client cannot grow it past
 * MAX_BUFFERED — beyond that the oldest events drop and the client is told to
 * re-sync, which is strictly better than a queue that eats memory forever.
 */
export function createEventStream() {
  const buffered: JobEvent[] = [];
  let wake: (() => void) | null = null;
  let closed = false;
  let dropped = false;

  const push = (event: JobEvent) => {
    if (closed) return;
    if (buffered.length >= MAX_BUFFERED) {
      buffered.shift();
      dropped = true;
    }
    buffered.push(event);
    const w = wake;
    wake = null;
    w?.();
  };

  const next = (): Promise<JobEvent | null> =>
    closed
      ? Promise.resolve(null)
      : new Promise<JobEvent | null>((resolve) => {
          if (buffered.length > 0) {
            resolve(buffered.shift()!);
            return;
          }
          wake = () => resolve(buffered.shift() ?? null);
        });

  return {
    push,
    next,
    close: () => {
      closed = true;
      const w = wake;
      wake = null;
      w?.();
    },
    /** True when events had to drop — the client should re-list. */
    get dropped() {
      return dropped;
    },
  };
}
