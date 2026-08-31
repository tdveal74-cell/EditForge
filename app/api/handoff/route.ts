import { buildCatalogExport, buildEDL, buildMixSession, buildNodeGraph, buildPathContract, buildRenderPlan, buildShotPackage, buildStemSheet, LOUDNESS_TARGETS, slug, TIMEBASES, type Timebase } from "@/lib/handoff";
import { getCut } from "@/lib/store";
import { listAssets } from "@/lib/catalog";
import { shotsForCut } from "@/lib/vfxboard";
import { SAMPLE_TIMELINE } from "@/lib/timeline";
import type { VfxShot } from "@/lib/vfxShot";

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

const KINDS = ["edl", "stems", "shots", "paths", "plan", "session", "catalog", "graph"] as const;
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

  // Catalog export is the MAM index — it is not a cut artifact.
  if (kind === "catalog") {
    const assets = await listAssets();
    const body = buildCatalogExport({ assets, title: "Asset catalog" });
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="editforge-catalog.json"',
        "Cache-Control": "no-store",
      },
    });
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

  // Only the shot package consults the board; reading it for an EDL would be a
  // store round-trip that changes nothing in the file.
  const board = kind === "shots" || kind === "graph" ? await shotsForCut(cut.id) : undefined;
  const index = kind === "paths" ? await listAssets() : undefined;

  const built = build(kind, {
    cut,
    clips,
    fps,
    name,
    assemblySource,
    board,
    index: index?.map((a) => ({ name: a.name, type: a.type, location: a.location })),
    targetId: url.searchParams.get("target"),
    jobKind: url.searchParams.get("jobKind"),
  });
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
  kind: Exclude<Kind, "catalog">,
  ctx: {
    cut: { id: string; title: string; rubricPass?: boolean };
    clips: typeof SAMPLE_TIMELINE;
    fps: Timebase;
    name: string;
    assemblySource: string;
    board?: VfxShot[];
    index?: { name: string; type: string; location?: string }[];
    targetId: string | null;
    jobKind?: string | null;
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
        body: buildShotPackage({ title: cut.title, clips, fps, colorSpace: "ACEScct", board: ctx.board }),
        contentType: "application/json; charset=utf-8",
        filename: `${name}_shots.json`,
      };

    case "paths":
      return {
        body: buildPathContract({ cutId: cut.id, title: cut.title, index: ctx.index }),
        contentType: "application/json; charset=utf-8",
        filename: `${name}_paths.json`,
      };

    case "session": {
      const target = LOUDNESS_TARGETS.find((t) => t.id === (ctx.targetId || "shortform"));
      if (!target) {
        return { error: `target must be one of ${LOUDNESS_TARGETS.map((t) => t.id).join(", ")}` };
      }
      return {
        body: buildMixSession({ title: cut.title, clips, target }),
        contentType: "application/json; charset=utf-8",
        filename: `${name}_mix_session.json`,
      };
    }

    case "graph":
      return {
        body: buildNodeGraph({ title: cut.title, clips, fps, board: ctx.board }),
        contentType: "application/json; charset=utf-8",
        filename: `${name}_nodes.json`,
      };

    case "plan": {
      const jobKind = ctx.jobKind === "export" ? "export" : "proxy";
      return {
        body: buildRenderPlan({
          cutId: cut.id,
          title: cut.title,
          kind: jobKind,
          rubricPass: Boolean(ctx.cut.rubricPass),
          assemblySource,
        }),
        contentType: "application/json; charset=utf-8",
        filename: `${name}_ffmpeg_${jobKind}.json`,
      };
    }
  }
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
