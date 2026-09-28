import { isAuthenticated, SESSION_COOKIE } from "@/lib/auth";
import { cookies } from "next/headers";
import {
  SSE_HEARTBEAT_MS,
  createEventStream,
  encodeJobEvent,
  subscribeToJobEvents,
} from "@/lib/job-events";
import { listJobs } from "@/lib/jobstore";

export const dynamic = "force-dynamic";

async function appAuthenticated(req: Request): Promise<boolean> {
  return isAuthenticated({
    authorization: req.headers.get("authorization"),
    sessionCookie: (await cookies()).get(SESSION_COOKIE)?.value,
  });
}

/**
 * Server-sent events for job state changes.
 *
 * A browser opens this once and stops re-fetching to discover movement. The
 * first frame is a full snapshot (event: sync), so a client is correct
 * immediately and needs no follow-up fetch. After that only changes arrive.
 *
 * Every event is `no-store` by SSE nature; the heartbeat keeps intermediaries
 * from idle-closing the connection, and any close is healed by the browser's
 * own EventSource reconnect, which re-sends the snapshot frame. Clients that
 * were dropped for buffer overflow receive `event: resync` and re-fetch.
 */
export async function GET(req: Request) {
  if (!(await appAuthenticated(req))) {
    return Response.json({ error: "authentication required" }, { status: 401 });
  }

  const stream = createEventStream();
  const unsubscribe = subscribeToJobEvents(stream.push);

  // Closed by the client (or its proxy). Stop the bus subscription and the
  // heartbeat, or the route leaks a subscriber per abandoned tab.
  req.signal.addEventListener("abort", () => {
    unsubscribe();
    stream.close();
  });

  const body = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let open = true;
      const send = (chunk: string) => {
        if (!open) return false;
        try {
          controller.enqueue(encoder.encode(chunk));
          return true;
        } catch {
          open = false;
          return false;
        }
      };

      // Snapshot first: the subscriber may register events the client has not
      // seen yet, so the ordering is snapshot, then live frames from here.
      try {
        const jobs = await listJobs();
        send(
          `event: sync\ndata: ${JSON.stringify({
            jobs: jobs.map((j) => ({
              id: j.id,
              status: j.status,
              updatedAt: j.updatedAt,
            })),
          })}\n\n`,
        );
      } catch {
        send(`event: sync\ndata: {"jobs":[],"error":"store unreachable"}\n\n`);
      }

      const heartbeat = setInterval(() => {
        if (!send(`: keep-alive\n\n`)) clearInterval(heartbeat);
      }, SSE_HEARTBEAT_MS);

      // Drain the queue for as long as the connection lives.
      void (async () => {
        for (;;) {
          const event = await stream.next();
          if (!event || !open) break;
          if (!send(encodeJobEvent(event))) break;
          if (stream.dropped) {
            send(`event: resync\ndata: {}\n\n`);
            break;
          }
        }
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed by the abort path.
        }
      })();
    },
    cancel() {
      unsubscribe();
      stream.close();
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      // One intermediary hop (the studio is commonly fronted by one) must not
      // buffer the stream into oblivion.
      "X-Accel-Buffering": "no",
    },
  });
}

