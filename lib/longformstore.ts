import { durableCollection } from "./durable";
import { SAMPLE_LONGFORM, parseLongformProject, type LongFormProject } from "./longform";

/**
 * The one stored long-form episode.
 *
 * /longform used to seed SAMPLE_LONGFORM on every mount, so edited chapters
 * died on reload even though /api/longform/plan already planned the posted
 * copy. The project lives here now.
 */

const projects = durableCollection<LongFormProject>({
  key: "editforge:longform",
  file: "longform.json",
  seed: () => [{ ...SAMPLE_LONGFORM, chapters: SAMPLE_LONGFORM.chapters.map((c) => ({ ...c })) }],
});

export async function getLongformProject(): Promise<LongFormProject> {
  const rows = await projects.list();
  return rows[0] ?? SAMPLE_LONGFORM;
}

export async function saveLongformProject(
  raw: unknown
): Promise<{ ok: true; project: LongFormProject } | { ok: false; reason: string }> {
  const parsed = parseLongformProject(raw);
  if (!parsed.ok) return parsed;
  await projects.mutate((items) => {
    items.splice(0, items.length, parsed.project);
  });
  return { ok: true, project: parsed.project };
}
