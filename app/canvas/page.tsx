import type { Metadata } from "next";
import { newProject } from "@/modules/canvas/model";
import { CanvasWorkspace } from "@/modules/canvas/CanvasWorkspace";
import "@/modules/canvas/canvas.css";
export const metadata: Metadata = {
  title: "Canvas · Production workspace",
  description:
    "Build the brief, direct the graph, render real work and review every output.",
};
export const dynamic = "force-dynamic";
export default async function CanvasPage({
  searchParams,
}: {
  searchParams: Promise<{
    workflow?: string;
    project?: string;
    panel?: string;
  }>;
}) {
  const query = await searchParams;
  const initialPanel =
    query.panel === "outputs" || query.panel === "sequence"
      ? query.panel
      : "agent";
  return (
    <CanvasWorkspace
      initial={newProject(query.workflow || "micro-drama")}
      savedId={query.project}
      initialPanel={initialPanel}
    />
  );
}
