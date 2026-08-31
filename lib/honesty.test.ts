import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LANDING_CAPABILITIES } from "./landing";
import { BOARD_MODULE_IDS, MODULE_STATUS_LABEL, STUDIO_MODULES } from "./studio";
import { isLiveWired, liveSubmitBlocked, PROVIDERS } from "./provider-registry";
import { GEN_PROVIDERS } from "./genvideo";
import { SAMPLE_AVATARS } from "./avatar";
import { formatSrt, formatVtt, SAMPLE_CUES } from "./captions";
import { buildTitleSpec } from "./titles";
import { buildPresetPack } from "./presets";
import { buildAudioLaw } from "./audio";
import { buildScriptBoard } from "./script-board";
import { buildArchiveChecklist } from "./archive";

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
  it("script, pipeline, and archive are not counted as Ready", () => {
    for (const id of ["script", "pipeline", "archive"]) {
      expect(STUDIO_MODULES.find((m) => m.id === id)?.status).toBe("planner");
    }
  });

  it("landing no longer labels the operational count as Ready modules", () => {
    const page = src("app/page.tsx");
    expect(page).not.toMatch(/Ready modules/);
    expect(page).toMatch(/Working surfaces/);
  });
});

describe("honesty: board pages self-label and do not speak as product engines", () => {
  it("captions, titles, presets, audio, script, pipeline, archive eyebrows say Board", () => {
    for (const page of ["captions", "titles", "presets", "audio", "script", "pipeline", "archive"]) {
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
