import { cookies } from "next/headers";
import { SESSION_COOKIE, isAuthenticated } from "@/lib/auth";
import { dispatchToWorker } from "@/lib/edit-worker";
import {
  acceptEditCommand,
  listEditExecutions,
  markDispatchFailed,
  markDispatched,
} from "@/lib/editstore";
import { commandNeedsRubric, validateEditCommand, type EditCommand } from "@/lib/editing";
import { getCut } from "@/lib/store";

export const dynamic = "force-dynamic";

async function authenticated(req: Request): Promise<boolean> {
  return isAuthenticated({
    authorization: req.headers.get("authorization"),
    sessionCookie: (await cookies()).get(SESSION_COOKIE)?.value,
  });
}

export async function GET(req: Request) {
  if (!(await authenticated(req))) return Response.json({ error: "authentication required" }, { status: 401 });
  return Response.json({ executions: await listEditExecutions() }, { headers: { "Cache-Control": "no-store" } });
}

/** Accept one authorized DEVON edit command and dispatch it exactly once. */
export async function POST(req: Request) {
  if (!(await authenticated(req))) return Response.json({ error: "authentication required" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const issues = validateEditCommand(body);
  if (issues.some((issue) => issue.severity === "error")) {
    return Response.json({ error: "invalid edit command", issues, executed: false }, { status: 422 });
  }
  const command = body as EditCommand;

  if (commandNeedsRubric(command)) {
    const cut = await getCut(command.cutId);
    if (!cut?.rubricPass) {
      return Response.json(
        { error: `master render blocked: cut ${command.cutId} has no recorded rubric pass`, executed: false },
        { status: 409 }
      );
    }
  }

  try {
    const accepted = await acceptEditCommand(command);
    if (accepted.deduped) {
      return Response.json({ execution: accepted.execution, deduped: true, executed: false });
    }

    const dispatched = await dispatchToWorker(accepted.execution);
    if (!dispatched.ok) {
      const execution = await markDispatchFailed(command.commandId, dispatched.error);
      return Response.json(
        { error: dispatched.error, execution, deduped: false, executed: false },
        { status: 503 }
      );
    }
    const execution = await markDispatched(command.commandId, dispatched.workerJobId);
    return Response.json({ execution, deduped: false, executed: true }, { status: 202 });
  } catch (error) {
    return Response.json({ error: (error as Error).message, executed: false }, { status: 409 });
  }
}
