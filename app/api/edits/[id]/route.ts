import { timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isAuthenticated } from "@/lib/auth";
import { cancelWorker, dispatchToWorker, pollWorker } from "@/lib/edit-worker";
import {
  cancelEditExecution,
  getEditExecution,
  markDispatchFailed,
  markDispatched,
  recordWorkerReceipt,
  type EditReceipt,
} from "@/lib/editstore";

export const dynamic = "force-dynamic";

async function appAuthenticated(req: Request): Promise<boolean> {
  return isAuthenticated({
    authorization: req.headers.get("authorization"),
    sessionCookie: (await cookies()).get(SESSION_COOKIE)?.value,
  });
}

function workerAuthenticated(req: Request): boolean {
  const expected = process.env.EDITFORGE_WORKER_TOKEN?.trim();
  const received = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!expected || !received) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await appAuthenticated(req))) return Response.json({ error: "authentication required" }, { status: 401 });
  const { id } = await ctx.params;
  let execution = await getEditExecution(id);
  if (!execution) return Response.json({ error: "edit execution not found" }, { status: 404 });

  if (new URL(req.url).searchParams.get("poll") === "1" && execution.workerJobId) {
    const receipt = await pollWorker(execution.workerJobId);
    if (receipt) {
      const updated = await recordWorkerReceipt(id, receipt);
      if (updated) execution = updated;
    }
  }
  return Response.json({ execution }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { action?: string; receipt?: EditReceipt };

  if (body.action === "receipt") {
    if (!workerAuthenticated(req)) return Response.json({ error: "worker authentication required" }, { status: 401 });
    if (!body.receipt) return Response.json({ error: "receipt required" }, { status: 400 });
    try {
      const execution = await recordWorkerReceipt(id, body.receipt);
      return execution
        ? Response.json({ execution })
        : Response.json({ error: "edit execution not found" }, { status: 404 });
    } catch (error) {
      return Response.json({ error: (error as Error).message }, { status: 409 });
    }
  }

  if (!(await appAuthenticated(req))) return Response.json({ error: "authentication required" }, { status: 401 });
  const existing = await getEditExecution(id);
  if (!existing) return Response.json({ error: "edit execution not found" }, { status: 404 });

  try {
    if (body.action === "cancel") {
      if (existing.workerJobId) await cancelWorker(existing.workerJobId);
      return Response.json({ execution: await cancelEditExecution(id) });
    }
    if (body.action === "retry") {
      if (existing.status !== "failed") {
        return Response.json({ error: `cannot retry ${existing.status} execution` }, { status: 409 });
      }
      const dispatched = await dispatchToWorker(existing);
      if (!dispatched.ok) {
        return Response.json(
          { error: dispatched.error, execution: await markDispatchFailed(id, dispatched.error) },
          { status: 503 }
        );
      }
      return Response.json({ execution: await markDispatched(id, dispatched.workerJobId), executed: true }, { status: 202 });
    }
    return Response.json({ error: "action must be retry, cancel, or receipt" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 409 });
  }
}
