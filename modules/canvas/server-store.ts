import { durableCollection } from "@/lib/durable";
import { getJob } from "@/lib/jobstore";
import { parseProject } from "./model";
import type { Project } from "./types";

const projects = durableCollection<Project>({
  key: "editforge:canvas",
  file: "canvas.json",
  seed: () => [],
});
export const listProjects = () => projects.list();
export const getProject = (id: string) => projects.get(id);

export async function saveProject(input: Project): Promise<Project> {
  const clean = parseProject(input);
  let saved = clean;
  await projects.mutate((all) => {
    const index = all.findIndex((p) => p.id === clean.id);
    const current = index < 0 ? undefined : all[index];
    if ((current?.revision ?? 0) !== (clean.revision ?? 0))
      throw new Error(
        "Project changed in another tab. Reload the saved project before saving again.",
      );
    if (index < 0 && all.length >= 200)
      throw new Error(
        "Project limit reached. Export an existing project first.",
      );
    saved = {
      ...clean,
      revision: (clean.revision ?? 0) + 1,
      updatedAt: Date.now(),
    };
    if (index < 0) all.unshift(saved);
    else all[index] = saved;
  });
  return saved;
}

export async function projectWithJobs(id: string) {
  const p = await getProject(id);
  if (!p) return null;
  const jobs = await Promise.all(
    p.nodes.filter((n) => n.jobId).map((n) => getJob(n.jobId!)),
  );
  return { project: p, jobs: jobs.filter((j) => j !== null) };
}
