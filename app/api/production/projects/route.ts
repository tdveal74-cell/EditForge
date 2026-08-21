import { NextResponse } from "next/server";
import { ensureAscensionThreadOne, ensureTswsMicrodrama, listProductionProjects } from "@/lib/production-store";
import { readinessFor, validateProductionProject } from "@/lib/production";

export const dynamic = "force-dynamic";

export async function GET() {
  await Promise.all([ensureAscensionThreadOne(), ensureTswsMicrodrama()]);
  const projects = await listProductionProjects();
  return NextResponse.json({
    projects: projects.map((project) => ({
      project,
      validation: validateProductionProject(project),
      readiness: {
        proof: readinessFor(project, "proof"),
        thread: readinessFor(project, "thread"),
      },
    })),
  });
}
