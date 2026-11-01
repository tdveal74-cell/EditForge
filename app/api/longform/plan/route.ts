import { NextResponse } from "next/server";
import {
  buildStitchCommand,
  longformStrategy,
  parseLongformProject,
  totalChapterDuration,
} from "@/lib/longform";
import { getCut } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Plan a stitch of the chapters the operator edited.
 *
 * The sample is a seed on the page, not the plan. The rubric pass is read from
 * the named cut in the store, never from `body.rubricPass` — a caller ticking
 * their own box is not a ship gate. Same law as `/api/ffmpeg/plan`.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = parseLongformProject((body as { project?: unknown }).project ?? body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.reason }, { status: 400 });
  }
  const project = parsed.project;
  const total = totalChapterDuration(project.chapters);
  const segmentPaths = project.chapters.map(
    (c, i) => `segments/${project.id}/${String(i + 1).padStart(2, "0")}-${c.id}.mp4`
  );
  const stitch = buildStitchCommand(segmentPaths, String((body as { outputPath?: unknown }).outputPath || `masters/${project.id}.mp4`));

  const cutId = String((body as { cutId?: unknown }).cutId || "").trim();
  if (!cutId) {
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
      allowed: false,
      note: "Blocked: stitch must name the cut whose recorded rubric pass authorises it",
    });
  }

  const cut = await getCut(cutId);
  if (!cut) {
    return NextResponse.json(
      {
        error: `no cut "${cutId}" in the store`,
        allowed: false,
      },
      { status: 404 }
    );
  }

  const allowed = Boolean(cut.rubricPass);
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
    allowed,
    cut: { id: cut.id, title: cut.title, rubricPass: Boolean(cut.rubricPass) },
    note: allowed
      ? `Authorised by the recorded rubric pass on "${cut.title}" — run on the render worker after human confirm`
      : `Blocked: "${cut.title}" has no recorded rubric pass`,
  });
}
