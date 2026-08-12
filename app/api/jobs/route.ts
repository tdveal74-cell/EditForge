import { NextResponse } from "next/server";
import { createAndQueue, listJobs, submitJob } from "@/lib/jobstore";
import { hasCredentials } from "@/lib/providers";
import type { JobKind } from "@/lib/jobs";

export const dynamic = "force-dynamic";

const MEDIA_KINDS: JobKind[] = ["gen-video", "voice", "avatar"];

export async function GET() {
  const jobs = await listJobs();
  return NextResponse.json({ jobs });
}

/**
 * Create a media job and hand it to its provider in one call.
 *
 * The rubric gate is enforced by `authorizeJob` before anything is persisted,
 * and the idempotency key makes a retried POST return the original job rather
 * than starting a second paid render.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const kind = String(body.kind ?? "") as JobKind;
  if (!MEDIA_KINDS.includes(kind)) {
    return NextResponse.json(
      { error: `kind must be one of ${MEDIA_KINDS.join(", ")}` },
      { status: 400 }
    );
  }

  const prompt = String(body.prompt ?? "").trim();
  if (!prompt) {
    return NextResponse.json({ error: "prompt required" }, { status: 400 });
  }

  const idempotencyKey = String(body.idempotencyKey ?? "").trim();
  if (!idempotencyKey) {
    return NextResponse.json(
      { error: "idempotencyKey required — it is what makes a retry safe" },
      { status: 400 }
    );
  }

  const provider = String(body.provider ?? "mock");

  try {
    const job = await createAndQueue({
      kind,
      label: String(body.label ?? `${kind} render`),
      note: "Queued for provider submit",
      idempotencyKey,
      requiresRubricPass: Boolean(body.requiresRubricPass),
      rubricDecision: body.rubricDecision,
    });

    // Already past queued means this was a retry of a job in flight.
    if (job.status !== "queued") {
      return NextResponse.json({ job, deduped: true });
    }

    const submitted = await submitJob(job.id, {
      provider,
      prompt,
      options: body.options,
    });

    return NextResponse.json(
      { job: submitted ?? job, live: hasCredentials(provider) && provider !== "mock" },
      { status: 201 }
    );
  } catch (err) {
    // authorizeJob throws when the rubric gate is not satisfied.
    return NextResponse.json({ error: (err as Error).message }, { status: 409 });
  }
}
