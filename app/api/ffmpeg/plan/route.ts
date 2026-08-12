import { NextResponse } from "next/server";
import { buildExportCommand, buildProxyCommand, canRun } from "@/lib/ffmpeg";
import { getCut } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Build a transcode plan, and decide whether it may run.
 *
 * The rubric pass is read from the STORE, never from the request. It used to be
 * taken straight off the body, which meant the gate asked the caller whether
 * they had passed — a client could send `rubricPass: true`, and the UI did
 * exactly that from a checkbox the operator ticked themselves. A gate that
 * trusts the caller is not a gate, and this one guards the master export, which
 * is the single thing the product promises to hold.
 *
 * Proxies are ungated by design: a proxy is not a deliverable, and requiring a
 * rubric to make one would push editors to skip the rubric rather than respect
 * it.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const kind = body.kind === "export" ? "export" : "proxy";
  const inputPath = String(body.inputPath || "input.mp4");
  const outputPath = String(body.outputPath || (kind === "export" ? "master.mp4" : "proxy.mp4"));

  const plan =
    kind === "export"
      ? buildExportCommand(inputPath, outputPath)
      : buildProxyCommand(inputPath, outputPath);

  if (kind !== "export") {
    return NextResponse.json({
      plan,
      allowed: true,
      reason: "Proxy — ungated. Run locally or on worker after human confirm",
    });
  }

  const cutId = String(body.cutId || "").trim();
  if (!cutId) {
    return NextResponse.json(
      {
        plan,
        allowed: false,
        reason: "Blocked: export must name the cut whose rubric decision authorises it",
      },
      { status: 400 }
    );
  }

  const cut = await getCut(cutId);
  if (!cut) {
    return NextResponse.json(
      { plan, allowed: false, reason: `Blocked: no cut "${cutId}" in the store` },
      { status: 404 }
    );
  }

  const allowed = canRun(plan, Boolean(cut.rubricPass));
  return NextResponse.json({
    plan,
    allowed,
    cut: { id: cut.id, title: cut.title, rubricPass: Boolean(cut.rubricPass) },
    reason: allowed
      ? `Authorised by the recorded rubric pass on "${cut.title}" — run after human confirm`
      : `Blocked: "${cut.title}" has no recorded rubric pass`,
  });
}
