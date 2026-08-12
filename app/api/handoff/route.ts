import { buildEDL, buildPathContract, buildShotPackage, buildStemSheet, LOUDNESS_TARGETS, slug, TIMEBASES, type Timebase } from "@/lib/handoff";
import { getCut } from "@/lib/store";
import { SAMPLE_TIMELINE } from "@/lib/timeline";

export const dynamic = "force-dynamic";

/**
 * Serve the artifact that crosses a bridge.
 *
 * GET rather than POST because this is a download: the browser navigates, the
 * file lands, and the link can be handed to an assistant who is not looking at
 * the app. Nothing here spends money or mutates state, so there is no
 * idempotency key and no billing gate — only the app's access gate, which
 * middleware applies to this path like any other.
 */

const KINDS = ["edl", "stems", "shots", "paths"] as const;
type Kind = (typeof KINDS)[number];

function isKind(v: string): v is Kind {
  return (KINDS as readonly string[]).includes(v);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const kind = String(url.searchParams.get("kind") || "");
  const cutId = String(url.searchParams.get("cutId") || "").trim();

  if (!isKind(kind)) {
    return json({ error: `kind must be one of ${KINDS.join(", ")}` }, 400);
  }
  if (!cutId) {
    return json({ error: "cutId required — an artifact belongs to a cut" }, 400);
  }

  const cut = await getCut(cutId);
  if (!cut) return json({ error: `no cut "${cutId}" in the store` }, 404);

  // A timebase the caller invented would produce timecode we do not compute
  // correctly, so an unknown one is refused rather than quietly coerced.
  const fpsParam = url.searchParams.get("fps");
  let fps: Timebase = 25;
  if (fpsParam !== null) {
    const n = Number(fpsParam);
    if (!TIMEBASES.includes(n as Timebase)) {
      return json({ error: `fps must be one of ${TIMEBASES.join(", ")}` }, 400);
    }
    fps = n as Timebase;
  }

  // Until an assembly editor writes per-cut clips, the sample assembly stands in
  // — and the artifact says so in its own header rather than passing itself off
  // as a conform of media nobody has cut yet.
  const clips = cut.clips ?? SAMPLE_TIMELINE;
  const assemblySource = cut.clips ? "cut assembly" : "sample assembly";
  const name = slug(cut.title) || cut.id;

  const built = build(kind, { cut, clips, fps, name, assemblySource, targetId: url.searchParams.get("target") });
  if ("error" in built) return json({ error: built.error }, 400);

  return new Response(built.body, {
    status: 200,
    headers: {
      "Content-Type": built.contentType,
      "Content-Disposition": `attachment; filename="${built.filename}"`,
      // These are generated per request from live store state; a cached copy
      // would hand an assistant last week's cut.
      "Cache-Control": "no-store",
    },
  });
}

function build(
  kind: Kind,
  ctx: {
    cut: { id: string; title: string };
    clips: typeof SAMPLE_TIMELINE;
    fps: Timebase;
    name: string;
    assemblySource: string;
    targetId: string | null;
  }
): { body: string; contentType: string; filename: string } | { error: string } {
  const { cut, clips, fps, name, assemblySource } = ctx;
  const note = `# ASSEMBLY SOURCE: ${assemblySource}`;

  switch (kind) {
    case "edl":
      return {
        body: buildEDL({ title: `${cut.title} (${assemblySource})`, clips, fps }),
        contentType: "text/plain; charset=utf-8",
        filename: `${name}_${fps}fps.edl`,
      };

    case "stems": {
      const target = LOUDNESS_TARGETS.find((t) => t.id === (ctx.targetId || "shortform"));
      if (!target) {
        return { error: `target must be one of ${LOUDNESS_TARGETS.map((t) => t.id).join(", ")}` };
      }
      return {
        body: `${note}\n` + buildStemSheet({ title: cut.title, clips, target }),
        contentType: "text/csv; charset=utf-8",
        filename: `${name}_stems_${target.id}.csv`,
      };
    }

    case "shots":
      return {
        body: buildShotPackage({ title: cut.title, clips, fps, colorSpace: "ACEScct" }),
        contentType: "application/json; charset=utf-8",
        filename: `${name}_shots.json`,
      };

    case "paths":
      return {
        body: buildPathContract({ cutId: cut.id, title: cut.title }),
        contentType: "application/json; charset=utf-8",
        filename: `${name}_paths.json`,
      };
  }
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
