export type Chapter = {
  id: string;
  title: string;
  startSec: number;
  targetDurationSec: number;
  script: string;
  segmentSource: "gen" | "nle" | "stock" | "avatar" | "vo-bed";
};

export type LongFormProject = {
  id: string;
  title: string;
  targetDurationSec: number;
  chapters: Chapter[];
  status: "draft" | "rendering" | "stitching" | "review" | "master-ready";
};

export type StitchPlan = {
  concatList: string[];
  command: string;
  requiresRubricPass: boolean;
  estimatedMinutes: number;
};

export const LONGFORM_TIERS = [
  { id: "short-doc", label: "Short doc", maxMin: 8, notes: "YouTube short-form long" },
  { id: "episode", label: "Episode", maxMin: 25, notes: "TSWS episode band" },
  { id: "featurette", label: "Featurette", maxMin: 45, notes: "Extended essay / special" },
  { id: "feature", label: "Feature", maxMin: 120, notes: "Requires NLE + farm; gen only for inserts" },
] as const;

export const SAMPLE_LONGFORM: LongFormProject = {
  id: "lf-tsws-e01",
  title: "TSWS E01 — long-form assembly",
  targetDurationSec: 18 * 60,
  status: "draft",
  chapters: [
    { id: "ch-1", title: "Cold open", startSec: 0, targetDurationSec: 90, script: "Environment establishes. Question lands.", segmentSource: "nle" },
    { id: "ch-2", title: "Inquiry", startSec: 90, targetDurationSec: 360, script: "Auren VO + locked plates.", segmentSource: "vo-bed" },
    { id: "ch-3", title: "Atmosphere inserts", startSec: 450, targetDurationSec: 120, script: "Gen B-roll only — no faces.", segmentSource: "gen" },
    { id: "ch-4", title: "Turn", startSec: 570, targetDurationSec: 300, script: "Still holds. Silence allowed.", segmentSource: "nle" },
    { id: "ch-5", title: "Close", startSec: 870, targetDurationSec: 90, script: "Intentional ending.", segmentSource: "nle" },
  ],
};

export function totalChapterDuration(chapters: Chapter[]): number {
  return chapters.reduce((s, c) => s + c.targetDurationSec, 0);
}

export function buildStitchCommand(segmentPaths: string[], outputPath: string): StitchPlan {
  const list = segmentPaths.map((p) => `file '${p.replace(/'/g, `'\\''`)}'`);
  const listFile = "segments.txt";
  const command = [
    `# write ${listFile}:`,
    ...list.map((l) => `# ${l}`),
    `ffmpeg -y -f concat -safe 0 -i ${listFile} -c copy '${outputPath}'`,
    `ffmpeg -y -f concat -safe 0 -i ${listFile} -c:v libx264 -crf 18 -c:a aac -b:a 192k '${outputPath}'`,
  ].join("\n");
  return {
    concatList: segmentPaths,
    command,
    requiresRubricPass: true,
    estimatedMinutes: Math.max(1, Math.ceil(segmentPaths.length * 0.5)),
  };
}

export function longformStrategy(totalSec: number): string {
  const min = totalSec / 60;
  if (min <= 3) return "Single-timeline or few gen clips; still stitch-aware.";
  if (min <= 25) return "Chapter pipeline: NLE spine + gen inserts + VO beds + stitch.";
  return "Feature length: NLE is primary; gen only for controlled inserts; farm encode required.";
}

/** Sample stitch plan as a file. Not a running episode renderer. */
export function buildLongformBoard(project: LongFormProject = SAMPLE_LONGFORM): string {
  return (
    JSON.stringify(
      {
        kind: "longform-stitch-plan",
        notice:
          "Sample stitch plan as a file. Not a running episode renderer. The page checkbox is a brief, not a recorded ship gate.",
        id: project.id,
        title: project.title,
        targetDurationSec: project.targetDurationSec,
        assembledSec: totalChapterDuration(project.chapters),
        chapters: project.chapters,
      },
      null,
      2,
    ) + "\n"
  );
}
