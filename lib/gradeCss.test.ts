import { describe, expect, it } from "vitest";
import { DEFAULT_GRADE, type GradeParams } from "./grade";
import {
  GREY_RAMP,
  REFERENCE_PATCHES,
  gradeFilter,
  temperatureOverlay,
  vignetteGradient,
} from "./gradeCss";

const neutral: GradeParams = {
  exposure: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
  vignette: 0,
};

describe("grade as CSS", () => {
  it("is a no-op at neutral — every multiplier is 1", () => {
    const f = gradeFilter(neutral);
    expect(f).toBe("brightness(1) contrast(1) saturate(1)");
    expect(temperatureOverlay(neutral)).toBeNull();
    expect(vignetteGradient(neutral)).toBeNull();
  });

  it("maps each parameter to its own filter, in a predictable direction", () => {
    expect(gradeFilter({ ...neutral, exposure: 0.2 })).toContain("brightness(1.2)");
    expect(gradeFilter({ ...neutral, exposure: -0.2 })).toContain("brightness(0.8)");
    expect(gradeFilter({ ...neutral, contrast: 0.1 })).toContain("contrast(1.1)");
    expect(gradeFilter({ ...neutral, saturation: -0.3 })).toContain("saturate(0.7)");
  });

  it("warms and cools in opposite directions", () => {
    const warm = temperatureOverlay({ ...neutral, temperature: 0.3 });
    const cool = temperatureOverlay({ ...neutral, temperature: -0.3 });
    expect(warm?.color).not.toBe(cool?.color);
    // Equal magnitude, equal strength — the cast is symmetric.
    expect(warm?.opacity).toBe(cool?.opacity);
  });

  it("never renders temperature as an opaque wash", () => {
    // A gel tints a frame; it does not replace it. Even at full scale the
    // overlay has to stay well clear of 1.
    const extreme = temperatureOverlay({ ...neutral, temperature: 0.5 });
    expect(extreme!.opacity).toBeLessThanOrEqual(0.3);
  });

  it("leaves the centre of frame untouched by the vignette", () => {
    // A vignette that darkens the subject is a filter, not restraint.
    const v = vignetteGradient({ ...neutral, vignette: 0.35 })!;
    expect(v).toContain("rgba(0,0,0,0) 55%");
    expect(v).toContain("0.35");
  });

  it("scales the vignette with its parameter", () => {
    expect(vignetteGradient({ ...neutral, vignette: 0.1 })).toContain("0.1");
    expect(vignetteGradient({ ...neutral, vignette: 0.3 })).toContain("0.3");
  });

  it("clamps rather than letting an out-of-range value blow out the frame", () => {
    // isRestraintGrade rejects these, but the renderer must not produce a
    // black frame if one ever reaches it.
    const v = vignetteGradient({ ...neutral, vignette: 5 })!;
    expect(v).toContain("0.5");
    expect(temperatureOverlay({ ...neutral, temperature: 5 })!.opacity).toBeLessThanOrEqual(0.3);
  });

  it("renders the studio default as a visible but gentle grade", () => {
    const f = gradeFilter(DEFAULT_GRADE);
    // The default is a real grade, not a no-op...
    expect(f).not.toBe("brightness(1) contrast(1) saturate(1)");
    // ...and every multiplier stays within a tenth of neutral.
    for (const value of f.match(/[\d.]+(?=\))/g)!.map(Number)) {
      expect(Math.abs(value - 1)).toBeLessThanOrEqual(0.1);
    }
  });

  it("provides a chart worth judging against", () => {
    // A ramp with both ends, so crushed blacks and clipped whites are visible.
    expect(GREY_RAMP[0]).toBe("#000000");
    expect(GREY_RAMP[GREY_RAMP.length - 1]).toBe("#FFFFFF");
    expect(GREY_RAMP.length).toBeGreaterThanOrEqual(5);
    // Skin is the patch a grade breaks first, so it must be present.
    expect(REFERENCE_PATCHES.some((p) => p.label.toLowerCase().includes("skin"))).toBe(true);
    expect(REFERENCE_PATCHES.every((p) => /^#[0-9A-F]{6}$/i.test(p.color))).toBe(true);
  });
});
