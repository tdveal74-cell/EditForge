import { NextResponse } from "next/server";
import {
  SAMPLE_LONGFORM,
  buildStitchCommand,
  longformStrategy,
  totalChapterDuration,
} from "@/lib/longform";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const project = SAMPLE_LONGFORM;
  const total = totalChapterDuration(project.chapters);
  const segmentPaths = project.chapters.map(
    (c, i) => `segments/${project.id}/${String(i + 1).padStart(2, "0")}-${c.id}.mp4`
  );
  const stitch = buildStitchCommand(segmentPaths, body.outputPath || `masters/${project.id}.mp4`);
  const rubricPass = Boolean(body.rubricPass);

  return NextResponse.json({
    project: {
      id: project.id,
      title: project.title,
      targetDurationSec: project.targetDurationSec,
      chapterCount: project.chapters.length,
      assembledDurationSec: total,
    },
    strategy: longformStrategy(total),
    chapters: project.chapters,
    segmentPaths,
    stitch,
    allowed: !stitch.requiresRubricPass || rubricPass,
    note: rubricPass
      ? "Stitch plan ready — run on render worker after human confirm"
      : "Rubric pass required before long-form master stitch",
  });
}
