import { NextResponse } from "next/server";
import { cancelJob, completeJob, getJob, pollJob, retryJob } from "@/lib/jobstore";

export const dynamic = "force-dynamic";

/** Read a job. Pass ?poll=1 to advance it against the provider first. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const poll = new URL(req.url).searchParams.get("poll");

  const job = poll ? await pollJob(id) : await getJob(id);
  if (!job) return NextResponse.json({ error: "job not found" }, { status: 404 });
  return NextResponse.json({ job });
}

const ACTIONS = {
  poll: pollJob,
  complete: completeJob,
  retry: retryJob,
  cancel: cancelJob,
} as const;

type Action = keyof typeof ACTIONS;

/** Drive a job: poll · complete · retry · cancel. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "") as Action;

  if (!(action in ACTIONS)) {
    return NextResponse.json(
      { error: `action must be one of ${Object.keys(ACTIONS).join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const job = await ACTIONS[action](id);
    if (!job) return NextResponse.json({ error: "job not found" }, { status: 404 });
    return NextResponse.json({ job });
  } catch (err) {
    // Illegal transitions surface as a conflict, not a 500 — the caller asked
    // for something the state machine forbids.
    return NextResponse.json({ error: (err as Error).message }, { status: 409 });
  }
}
