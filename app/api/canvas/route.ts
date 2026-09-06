import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isAuthenticated, SESSION_COOKIE } from "@/lib/auth";
import { completeJob, cancelJob } from "@/lib/jobstore";
import { getCut, upsertCut } from "@/lib/store";
import {
  getProject,
  listProjects,
  saveProject,
} from "@/modules/canvas/server-store";
import { parseProject, studioTimeline } from "@/modules/canvas/model";
import { renderNode, renderPlan, syncJobs } from "@/modules/canvas/render";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (id) {
      const project = await getProject(id);
      return NextResponse.json(
        project ? { project } : { error: "Project not found." },
        { status: project ? 200 : 404 },
      );
    }
    const projects = (await listProjects()).map(
      ({ id, name, templateId, updatedAt, revision }) => ({
        id,
        name,
        templateId,
        updatedAt,
        revision,
      }),
    );
    return NextResponse.json({
      projects,
      agentConfigured: Boolean(process.env.XAI_API_KEY?.trim()),
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "The project store is unavailable. Your open graph is still in this tab.",
      },
      { status: 503 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const raw = await req.text();
    if (raw.length > 600_000)
      return NextResponse.json(
        { error: "Project request exceeds 600 KB." },
        { status: 413 },
      );
    const body = JSON.parse(raw);
    if (body.action === "save")
      return NextResponse.json({
        project: await saveProject(parseProject(body.project)),
      });
    const p = await getProject(String(body.projectId ?? ""));
    if (!p)
      return NextResponse.json(
        { error: "Save the project first." },
        { status: 404 },
      );
    if (body.action === "prepare")
      return NextResponse.json({ plan: renderPlan(p, body.nodeIds) });
    if (body.action === "render") {
      const authed = await isAuthenticated({
        authorization: req.headers.get("authorization"),
        sessionCookie: (await cookies()).get(SESSION_COOKIE)?.value,
      });
      if (!authed)
        return NextResponse.json(
          { error: "Sign in to authorize paid generation." },
          { status: 401 },
        );
      return NextResponse.json({
        project: await renderNode(
          p.id,
          body.nodeIds,
          String(body.confirmation ?? ""),
          body.voiceConsent === true,
        ),
      });
    }
    if (body.action === "poll")
      return NextResponse.json({ project: await syncJobs(p.id, true) });
    if (body.action === "accept" || body.action === "cancel") {
      const n = p.nodes.find((n) => n.id === body.nodeId);
      if (!n?.jobId) throw new Error("No job is attached to this node.");
      if (body.action === "accept") await completeJob(n.jobId);
      else await cancelJob(n.jobId);
      return NextResponse.json({ project: await syncJobs(p.id, false) });
    }
    if (body.action === "handoff") {
      if (!p.clips.length)
        throw new Error("Add outputs to the cut sequence first.");
      const id = `canvas-${p.id}-r${p.revision}`;
      const existing = await getCut(id);
      const now = new Date().toISOString();
      const cut =
        existing ??
        (await upsertCut({
          id,
          title: p.name,
          status: "ingest",
          rubricPass: false,
          clips: studioTimeline(p),
          notes: `Canvas revision ${p.revision}. Review required.\n${JSON.stringify({ projectId: p.id, assets: p.assets, sequence: p.clips }, null, 2)}`,
          createdAt: now,
          updatedAt: now,
        }));
      return NextResponse.json({
        cut,
        href: `/projects?cut=${encodeURIComponent(cut.id)}`,
      });
    }
    return NextResponse.json(
      { error: "Unknown Canvas action." },
      { status: 400 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Canvas operation failed." },
      { status: 409 },
    );
  }
}
