import { NextResponse } from "next/server";
import { createAndQueue, listJobs, submitJob } from "@/lib/jobstore";
import { findProvider, hasCredentials, isBillableProvider, isLiveWired } from "@/lib/providers";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isAuthenticated } from "@/lib/auth";
import type { JobKind } from "@/lib/jobs";

export const dynamic = "force-dynamic";

const MEDIA_KINDS: JobKind[] = [
  "gen-video",
  "voice",
  "avatar",
  "proof-shot",
  "episode-generate",
  "episode-master",
  "thread-master",
];

/** Would a submit to this provider reach a real, paid service? */
function willBill(provider: string): boolean {
  const spec = findProvider(provider);
  if (!spec || spec.id === "mock") return false;
  return isBillableProvider(spec.id) && hasCredentials(spec.id) && isLiveWired(spec.id);
}

/** Any real execution path consumes a protected identity or compute resource. */
function requiresAuthentication(provider: string): boolean {
  const spec = findProvider(provider);
  if (!spec || spec.id === "mock") return false;
  return hasCredentials(spec.id) && isLiveWired(spec.id);
}

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

  // Spending money requires credentials, independently of the access gate.
  // Without this, live keys on a deployment that is reachable by anyone would
  // be spendable by anyone; with it, an unauthenticated caller can only ever
  // reach the offline path. Fails closed: when nothing is configured to
  // authenticate against, no billable provider can be reached at all.
  const authed = await isAuthenticated({
    authorization: req.headers.get("authorization"),
    sessionCookie: (await cookies()).get(SESSION_COOKIE)?.value,
  });
  if (requiresAuthentication(provider) && !authed) {
    return NextResponse.json(
      {
        error: willBill(provider)
          ? "This provider bills real work, so it requires authentication. Sign in, or send the MCP bearer token. Provider 'mock' is always available."
          : "This provider executes real media and protected identity assets, so it requires authentication. Sign in, or send the MCP bearer token.",
      },
      { status: 401 }
    );
  }

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
      {
        job: submitted ?? job,
        live: submitted?.mode === "live" && submitted.status !== "failed",
      },
      { status: 201 }
    );
  } catch (err) {
    // authorizeJob throws when the rubric gate is not satisfied.
    return NextResponse.json({ error: (err as Error).message }, { status: 409 });
  }
}
