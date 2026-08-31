import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LANDING_CAPABILITIES } from "./landing";
import { MODULE_STATUS_LABEL, STUDIO_MODULES } from "./studio";
import { isLiveWired, liveSubmitBlocked, PROVIDERS } from "./provider-registry";

describe("honesty: operational is never Live", () => {
  it("maps operational to Ready, never Live", () => {
    expect(MODULE_STATUS_LABEL.operational).toBe("Ready");
    expect(MODULE_STATUS_LABEL.planner).toBe("Board");
    expect(MODULE_STATUS_LABEL.bridge).toBe("Bridge");
    expect(MODULE_STATUS_LABEL["ai-media"]).toBe("AI media");
    expect(Object.values(MODULE_STATUS_LABEL).join(" ")).not.toMatch(/\bLive\b/i);
  });

  it("studio hub source does not print Live for modules", () => {
    const src = readFileSync(path.join(process.cwd(), "app/studio/page.tsx"), "utf8");
    expect(src).not.toMatch(/operational:\s*"Live"/);
    expect(src).not.toMatch(/modules live/);
  });

  it("captions, titles, presets, and audio are boards", () => {
    for (const id of ["captions", "titles", "presets", "audio"]) {
      expect(STUDIO_MODULES.find((m) => m.id === id)?.status).toBe("planner");
    }
  });

  it("stock is a working index, not a bridge caption", () => {
    expect(STUDIO_MODULES.find((m) => m.id === "stock")?.status).toBe("operational");
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
    const src = readFileSync(path.join(process.cwd(), "app/page.tsx"), "utf8");
    expect(src).not.toMatch(/Seedream-class output/);
    expect(src).not.toMatch(/Kling · Veo · Runway/);
  });
});

describe("honesty: NLE is EDL, not AAF/XML", () => {
  it("NLE page does not claim AAF or XML", () => {
    const src = readFileSync(path.join(process.cwd(), "app/nle/page.tsx"), "utf8");
    expect(src).not.toMatch(/\bAAF\b/);
    expect(src).not.toMatch(/\bXML\b/);
    expect(src).toMatch(/CMX3600 EDL/);
  });
});

describe("honesty: every bridge page emits an artifact kind", () => {
  it("nle, mix, mam, render, and vfx-engine declare artifacts", () => {
    for (const page of ["nle", "mix", "mam", "render", "vfx-engine"]) {
      const src = readFileSync(path.join(process.cwd(), `app/${page}/page.tsx`), "utf8");
      expect(src).toMatch(/artifacts:/);
    }
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
    const nav = readFileSync(path.join(process.cwd(), "components/Nav.tsx"), "utf8");
    const landing = readFileSync(path.join(process.cwd(), "app/page.tsx"), "utf8");
    expect(nav).not.toMatch(/backdrop-blur/);
    expect(landing).not.toMatch(/backdrop-blur/);
  });
});
