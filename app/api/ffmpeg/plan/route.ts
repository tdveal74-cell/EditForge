import { NextResponse } from "next/server";
import { buildExportCommand, buildProxyCommand, canRun } from "@/lib/ffmpeg";

export async function POST(req: Request) {
  const body = await req.json();
  const kind = body.kind === "export" ? "export" : "proxy";
  const inputPath = String(body.inputPath || "input.mp4");
  const outputPath = String(body.outputPath || (kind === "export" ? "master.mp4" : "proxy.mp4"));
  const rubricPass = Boolean(body.rubricPass);

  const plan =
    kind === "export"
      ? buildExportCommand(inputPath, outputPath)
      : buildProxyCommand(inputPath, outputPath);

  const allowed = canRun(plan, rubricPass);
  return NextResponse.json({
    plan,
    allowed,
    reason: allowed
      ? "Command ready — run locally or on worker after human confirm"
      : "Blocked: rubric pass required before export",
  });
}
