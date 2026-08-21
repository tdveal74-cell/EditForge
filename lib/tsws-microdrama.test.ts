import { describe, expect, it } from "vitest";
import { readinessFor, validateProductionProject } from "./production";
import { createTswsMicrodramaProject, TSWS_GROK_VISUALS_FOLDER } from "./tsws-microdrama";

describe("TSWS Microdrama production manifest", () => {
  it("registers Tee as canon authority and releases the microdrama before long-form", () => {
    const project = createTswsMicrodramaProject("2026-08-20T00:00:00.000Z");
    expect(project.canonAuthority).toBe("Tee");
    expect(project.releasePosition).toBe("before-long-form");
    expect(project.releaseUnit).toBe("complete-microdrama");
    expect(project.property).toBe("tsws-microdrama");
    expect(validateProductionProject(project).valid).toBe(true);
  });

  it("locks the 29 Grok Visuals MP4s in Drive creation order", () => {
    const project = createTswsMicrodramaProject();
    expect(TSWS_GROK_VISUALS_FOLDER.id).toBe("1F0DnCbnG1PfrAj2BZsNklRKcXhs7J1lb");
    expect(project.sourceReferences).toHaveLength(29);
    expect(project.sourceReferences.map((reference) => reference.order)).toEqual(
      Array.from({ length: 29 }, (_, index) => index + 1),
    );
    expect(
      Number(project.sourceReferences.reduce((sum, reference) => sum + reference.durationSec, 0).toFixed(3)),
    ).toBe(283.175);
  });

  it("identifies the 72.25-second authored cut as the single completed microdrama", () => {
    const project = createTswsMicrodramaProject();
    const completed = project.sourceReferences.filter((reference) => reference.role === "completed-cut");
    expect(completed).toHaveLength(1);
    expect(completed[0]).toMatchObject({
      externalId: "1phUzIJXqY0PNf-8VyAQmXb5cyNPN81tn",
      durationSec: 72.25,
      width: 1080,
      height: 1920,
    });
    expect(project.output.episodeDurationSec).toBe(72.25);
  });

  it("keeps the long-form Season One ZIP protected and outside the render sources", () => {
    const project = createTswsMicrodramaProject();
    const protectedId = project.protectedReferences[0].externalId;
    expect(protectedId).toBe("1YaPQ5N5rxKcjzO8cO0lrByC6aSZ57Ms3");
    expect(project.sourceReferences.some((reference) => reference.externalId === protectedId)).toBe(false);

    project.sourceReferences[0].externalId = protectedId;
    expect(validateProductionProject(project).blockers.map((item) => item.code)).toContain("PROTECTED_SOURCE");
  });

  it("accepts the creator-authored continuity proof but still requires worker media before mastering", () => {
    const project = createTswsMicrodramaProject();
    expect(project.proofGate.status).toBe("accepted");
    const readiness = readinessFor(project, "episode", 1);
    expect(readiness.valid).toBe(false);
    expect(readiness.blockers.map((item) => item.code)).toContain("EPISODE_SOURCES");
  });
});
