import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LANDING_CAPABILITIES } from "./landing";
import { BOARD_MODULE_IDS, MODULE_STATUS_LABEL, STUDIO_MODULES, workingSurfaces } from "./studio";
import { isLiveWired, liveSubmitBlocked, PROVIDERS } from "./provider-registry";
import { GEN_PROVIDERS } from "./genvideo";
import { SAMPLE_AVATARS } from "./avatar";
import { formatSrt, formatVtt, SAMPLE_CUES } from "./captions";
import { SAMPLE_TITLE_CARDS } from "./titles";
import { buildTitleSpec } from "./titles";
import { buildPresetPack } from "./presets";
import { buildAudioLaw } from "./audio";
import { buildScriptBoard } from "./script-board";
import { buildArchiveChecklist } from "./archive";
import { buildExportMatrix, buildPipelineMap } from "./pipeline";
import { buildAssetIndex } from "./asset";
import { buildCatalogExport, buildMixSession, buildNodeGraph, LOUDNESS_TARGETS } from "./handoff";
import { SAMPLE_TIMELINE } from "./timeline";

function src(rel: string): string {
  return readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("honesty: operational is never Live", () => {
  it("maps operational to Ready, never Live", () => {
    expect(MODULE_STATUS_LABEL.operational).toBe("Ready");
    expect(MODULE_STATUS_LABEL.planner).toBe("Board");
    expect(MODULE_STATUS_LABEL.bridge).toBe("Bridge");
    expect(MODULE_STATUS_LABEL["ai-media"]).toBe("AI media");
    expect(Object.values(MODULE_STATUS_LABEL).join(" ")).not.toMatch(/\bLive\b/i);
  });

  it("studio hub source does not print Live for modules", () => {
    const page = src("app/studio/page.tsx");
    expect(page).not.toMatch(/operational:\s*"Live"/);
    expect(page).not.toMatch(/modules live/);
    expect(page).toMatch(/Ready is never Live/);
  });

  it("captions, titles, presets, audio, script, pipeline, archive, vfx are boards", () => {
    for (const id of BOARD_MODULE_IDS) {
      expect(STUDIO_MODULES.find((m) => m.id === id)?.status, id).toBe("planner");
    }
  });

  it("stock is a working index, not a bridge caption", () => {
    expect(STUDIO_MODULES.find((m) => m.id === "stock")?.status).toBe("operational");
  });
});

describe("honesty: Ready does not mean a page exists", () => {
  it("thin sample surfaces are not counted as Ready / Working", () => {
    for (const id of ["script", "pipeline", "archive", "timeline", "collab", "hardware", "longform", "assets", "export"]) {
      expect(STUDIO_MODULES.find((m) => m.id === id)?.status, id).toBe("planner");
    }
    const ids = workingSurfaces().map((m) => m.id);
    for (const id of ["script", "pipeline", "archive", "timeline", "collab", "hardware", "longform", "assets", "export"]) {
      expect(ids, id).not.toContain(id);
    }
  });

  it("landing no longer labels the operational count as Ready modules", () => {
    const page = src("app/page.tsx");
    expect(page).not.toMatch(/Ready modules/);
    expect(page).toMatch(/Working surfaces/);
    expect(page).toMatch(/workingSurfaces/);
  });

  it("landing does not sell Flagship Studio OS", () => {
    const page = src("app/page.tsx");
    expect(page).not.toMatch(/Flagship Studio OS/);
    expect(page).not.toMatch(/Post-production OS/);
    expect(page).not.toMatch(/one operating surface/);
    expect(page).toMatch(/control plane/);
  });
});

describe("honesty: board pages self-label and do not speak as product engines", () => {
  it("board pages self-label Board, including timeline, collab, and hardware", () => {
    for (const page of [
      "captions",
      "titles",
      "presets",
      "audio",
      "script",
      "pipeline",
      "archive",
      "timeline",
      "collab",
      "hardware",
      "vfx",
      "longform",
      "assets",
      "export",
    ]) {
      const body = src(`app/${page}/page.tsx`);
      expect(body, page).toMatch(/eyebrow="Board"/);
    }
  });

  it("captions does not claim CapCut", () => {
    expect(src("app/captions/page.tsx")).not.toMatch(/CapCut \/ Descript-inspired/);
    expect(src("app/captions/page.tsx")).toMatch(/Not a live captioner/);
  });

  it("audio does not claim Fairlight as this product", () => {
    expect(src("app/audio/page.tsx")).not.toMatch(/Fairlight \/ Essential Sound discipline/);
    expect(src("app/audio/page.tsx")).toMatch(/Not a mixer, not Fairlight/);
  });

  it("pipeline does not claim to be a hybrid of CapCut", () => {
    expect(src("app/pipeline/page.tsx")).not.toMatch(/Hybrid of Resolve, Premiere, CapCut/);
    expect(src("app/pipeline/page.tsx")).toMatch(/Not a running pipeline/);
  });

  it("archive does not print decorative completed checkmarks", () => {
    const body = src("app/archive/page.tsx");
    expect(body).not.toMatch(/>✓</);
    expect(body).toMatch(/Boxes start empty/);
  });

  it("timeline, collab, and hardware name themselves as sketch / agreement / reference", () => {
    expect(src("app/timeline/page.tsx")).toMatch(/Not an NLE/);
    expect(src("app/collab/page.tsx")).toMatch(/Per-role access is not enforced/);
    expect(src("app/hardware/page.tsx")).toMatch(/not a live inventory/);
  });
});

describe("honesty: board artifacts are real files", () => {
  it("emits SRT and VTT from the same cues", () => {
    const srt = formatSrt(SAMPLE_CUES);
    const vtt = formatVtt(SAMPLE_CUES);
    expect(srt).toMatch(/Where are we today\?/);
    expect(vtt).toMatch(/^WEBVTT/);
    expect(vtt).toMatch(/00:00:00\.000 --> 00:00:02\.500/);
    expect(srt).toMatch(/00:00:00,000 --> 00:00:02,500/);
  });

  it("title / preset / audio / script / archive builders declare they are samples", () => {
    expect(buildTitleSpec()).toMatch(/Not a live compositor/);
    expect(buildPresetPack()).toMatch(/not a live look engine/);
    expect(buildAudioLaw()).toMatch(/Not a mixer, not Fairlight/);
    expect(buildScriptBoard()).toMatch(/Not a screenplay tool/);
    expect(buildArchiveChecklist()).toMatch(/- \[ \]/);
    expect(buildArchiveChecklist()).toMatch(/not a live archive/i);
    expect(buildPipelineMap()).toMatch(/Not a running pipeline/);
  });

  it("pipeline page actually emits the map file", () => {
    expect(src("app/pipeline/page.tsx")).toMatch(/Download map/);
    expect(src("app/pipeline/page.tsx")).toMatch(/buildPipelineMap/);
  });
});

describe("honesty: landing does not name unwired providers as output", () => {
  it("capability copy never names a provider whose live path is unimplemented", () => {
    const text = LANDING_CAPABILITIES.map((c) => `${c.title} ${c.body}`).join("\n").toLowerCase();
    for (const p of PROVIDERS) {
      if (p.id === "mock") continue;
      if (isLiveWired(p.id)) continue;
      expect(text).not.toContain(p.id.toLowerCase());
      expect(text).not.toContain(p.label.toLowerCase());
    }
  });

  it("landing page does not advertise Kling/Veo/Seedream as output", () => {
    const page = src("app/page.tsx");
    expect(page).not.toMatch(/Seedream-class output/);
    expect(page).not.toMatch(/Kling · Veo · Runway/);
  });
});

describe("honesty: NLE is EDL, not AAF/XML", () => {
  it("NLE page does not claim AAF or XML", () => {
    const page = src("app/nle/page.tsx");
    expect(page).not.toMatch(/\bAAF\b/);
    expect(page).not.toMatch(/\bXML\b/);
    expect(page).toMatch(/CMX3600 EDL/);
  });
});

describe("honesty: every bridge page emits an artifact kind", () => {
  it("nle, mix, mam, render, and vfx-engine declare artifacts", () => {
    for (const page of ["nle", "mix", "mam", "render", "vfx-engine"]) {
      const body = src(`app/${page}/page.tsx`);
      expect(body).toMatch(/artifacts:/);
    }
  });

  it("mix, mam, and vfx-engine pages do not claim to be the engine", () => {
    expect(src("app/mix/page.tsx")).toMatch(/Not Fairlight/);
    expect(src("app/mam/page.tsx")).toMatch(/Not Drive, not S3, not Frame.io/);
    expect(src("app/vfx-engine/page.tsx")).toMatch(/Not Fusion/);
  });

  it("mix emits a session dump, mam a catalog export, vfx-engine a node graph", () => {
    expect(src("app/mix/page.tsx")).toMatch(/"session"/);
    expect(src("app/mam/page.tsx")).toMatch(/"catalog"/);
    expect(src("app/vfx-engine/page.tsx")).toMatch(/"graph"/);
    expect(buildMixSession({ title: "T", clips: SAMPLE_TIMELINE, target: LOUDNESS_TARGETS[0] })).toMatch(/Not Fairlight/);
    expect(buildCatalogExport({ assets: [{ name: "a.mov", type: "video" }] })).toMatch(/does not enforce it/);
    expect(buildCatalogExport({ assets: [{ name: "a.mov", type: "video" }] })).not.toMatch(/without the \/archive checklist complete/);
    expect(buildNodeGraph({ title: "T", clips: SAMPLE_TIMELINE, fps: 25 })).toMatch(/Not Fusion/);
  });

  it("MAM page does not encode a fake archive checklist gate", () => {
    expect(src("app/mam/page.tsx")).not.toMatch(/Nothing reaches cold archive without the \/archive checklist complete/);
    expect(src("app/mam/page.tsx")).toMatch(/does not enforce it/);
  });
});

describe("honesty: gen-video does not sell unwired modalities", () => {
  it("Runway strengths name text-to-video and refuse motion-brush/restyle/extend as wired", () => {
    const runway = GEN_PROVIDERS.find((p) => p.id === "runway");
    expect(runway?.strengths).toMatch(/text-to-video/i);
    expect(runway?.strengths).toMatch(/not wired/i);
    expect(runway?.liveWired).toBe(true);
  });

  it("Kling, Veo, Seedream strengths do not sell a live path", () => {
    for (const id of ["kling", "veo", "seedream"]) {
      const p = GEN_PROVIDERS.find((x) => x.id === id);
      expect(p?.liveWired).toBe(false);
      expect(p?.strengths).toMatch(/no live path/i);
    }
  });

  it("gen-video page defaults to mock and does not mount a studio reference clip as the result", () => {
    const page = src("app/gen-video/page.tsx");
    expect(page).toMatch(/useState\("mock"\)/);
    expect(page).not.toMatch(/useState\("runway"\)/);
    expect(page).not.toMatch(/PRIMARY_CLIP/);
    expect(page).toMatch(/JobResultStage/);
    expect(page).toMatch(/hideResult/);
  });
});

describe("honesty: sample avatars are drafts, not ready renders", () => {
  it("no sample avatar wears ready", () => {
    expect(SAMPLE_AVATARS.every((a) => a.status !== "ready")).toBe(true);
  });
});

describe("honesty: chrome is not AAA Studio OS", () => {
  it("layout and README do not claim AAA flagship Studio OS", () => {
    const layout = src("app/layout.tsx");
    const readme = src("README.md");
    expect(layout).not.toMatch(/AAA flagship/);
    expect(readme).not.toMatch(/Ultra Meta Supreme AAA/);
    expect(readme).not.toMatch(/Flagship production studio OS/);
  });

  it("COMPLETION does not check Boards as Operational or claim code-complete", () => {
    const body = src("COMPLETION.md");
    expect(body).not.toMatch(/code-complete/);
    expect(body).not.toMatch(/Flagship Studio OS/);
    expect(body).not.toMatch(/- \[x\] Pipeline, projects, dailies, script/);
    expect(body).not.toMatch(/- \[x\] Export, jobs, archive, collab/);
    expect(body).toMatch(/- \[ \] Boards/);
    expect(body).toMatch(/assets catalog index/);
    expect(body).toMatch(/export format matrix/);
    expect(body).not.toMatch(/- \[x\] Assets, review, rubric/);
    expect(body).not.toMatch(/- \[x\] Export, jobs/);
  });

  it("studio hub does not print modules ready", () => {
    expect(src("app/studio/page.tsx")).not.toMatch(/modules ready/);
    expect(src("app/studio/page.tsx")).toMatch(/working surfaces/);
  });
});


describe("honesty: board editors change content then emit", () => {
  it("captions emits the edited cue text, not only the sample", () => {
    const srt = formatSrt([{ id: "x", startSec: 1, endSec: 2, text: "Hello operator" }]);
    expect(srt).toMatch(/Hello operator/);
    expect(srt).not.toMatch(/Where are we today/);
  });

  it("captions page can add and remove cues", () => {
    const page = src("app/captions/page.tsx");
    expect(page).toMatch(/Add cue/);
    expect(page).toMatch(/newCaptionCue/);
    expect(page).toMatch(/Remove/);
  });

  it("titles page edits cards then emits the spec", () => {
    const page = src("app/titles/page.tsx");
    expect(page).toMatch(/useState/);
    expect(page).toMatch(/buildTitleSpec\(cards\)/);
    expect(page).toMatch(/Add card/);
    const spec = buildTitleSpec([{ ...SAMPLE_TITLE_CARDS[0], text: "Edited card" }]);
    expect(spec).toMatch(/Edited card/);
  });

  it("archive checkboxes start empty and the file can mark a check", () => {
    expect(src("app/archive/page.tsx")).toMatch(/type="checkbox"/);
    expect(src("app/archive/page.tsx")).toMatch(/Boxes start empty/);
    const md = buildArchiveChecklist(undefined, { "Caption SRT beside master": true });
    expect(md).toMatch(/- \[x\] Caption SRT beside master/);
    expect(md).toMatch(/- \[ \] Master \+ project archive linked/);
  });

  it("assets and export are Board indexes, not Ready", () => {
    expect(STUDIO_MODULES.find((m) => m.id === "assets")?.status).toBe("planner");
    expect(STUDIO_MODULES.find((m) => m.id === "export")?.status).toBe("planner");
    expect(workingSurfaces().map((m) => m.id)).not.toContain("assets");
    expect(workingSurfaces().map((m) => m.id)).not.toContain("export");
  });

  it("assets copy does not claim Drive/S3 behind /mam", () => {
    expect(src("app/assets/page.tsx")).not.toMatch(/Bytes live on Drive, S3, or Frame\.io behind \/mam/);
    expect(src("app/assets/page.tsx")).toMatch(/Not Drive, not S3, not Frame\.io/);
    expect(src("app/assets/page.tsx")).toMatch(/Download index/);
    expect(buildAssetIndex([])).toMatch(/Not Drive, not S3, not Frame\.io/);
  });

  it("export does not speak CapCut as this product", () => {
    expect(src("app/export/page.tsx")).not.toMatch(/Resolve deliver \+ CapCut format matrix/);
    expect(src("app/export/page.tsx")).toMatch(/Not a live encoder/);
    expect(src("app/export/page.tsx")).toMatch(/Download matrix/);
    expect(buildExportMatrix()).toMatch(/not CapCut/);
  });
});

describe("live submit gate", () => {
  it("allows mock even when nothing else is ready", () => {
    expect(liveSubmitBlocked({ id: "mock", billable: false, wired: true }, false)).toBeNull();
    expect(liveSubmitBlocked(undefined, false)).toBeNull();
  });

  it("blocks unwired, missing credential, missing settings, and missing store", () => {
    expect(liveSubmitBlocked({ id: "kling", billable: false, wired: false, credentialSet: true }, true)).toMatch(
      /No live path/
    );
    expect(
      liveSubmitBlocked({ id: "heygen", billable: false, wired: true, credentialSet: false }, true)
    ).toMatch(/Credential is not set/);
    expect(
      liveSubmitBlocked({
        id: "heygen",
        billable: false,
        wired: true,
        credentialSet: true,
        settingsMissing: ["HEYGEN_AVATAR_ID"],
      }, true)
    ).toMatch(/HEYGEN_AVATAR_ID/);
    expect(
      liveSubmitBlocked({
        id: "elevenlabs",
        billable: false,
        wired: true,
        credentialSet: true,
        requiresArtifactStore: true,
      }, false)
    ).toMatch(/artifact store/);
  });

  it("allows a billable wired provider with a store", () => {
    expect(
      liveSubmitBlocked({ id: "runway", billable: true, wired: true, credentialSet: true, settingsMissing: [] }, true)
    ).toBeNull();
  });
});

describe("no blur in chrome", () => {
  it("Nav and landing do not use backdrop-blur", () => {
    const nav = src("components/Nav.tsx");
    const landing = src("app/page.tsx");
    expect(nav).not.toMatch(/backdrop-blur/);
    expect(landing).not.toMatch(/backdrop-blur/);
  });
});
