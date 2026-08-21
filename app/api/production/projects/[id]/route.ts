import { NextResponse } from "next/server";
import { getProductionProject } from "@/lib/production-store";
import { readinessFor, validateProductionProject } from "@/lib/production";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProductionProject(id);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  return NextResponse.json({
    project,
    validation: validateProductionProject(project),
    readiness: {
      proof: readinessFor(project, "proof"),
      thread: readinessFor(project, "thread"),
    },
  });
}

