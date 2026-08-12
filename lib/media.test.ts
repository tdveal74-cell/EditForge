import { describe, expect, it } from "vitest";
import { formatTimecode, frameTimesFor, isPlayableVideo, peaksFrom } from "./media";

describe("frame times", () => {
  it("includes both ends of the clip", () => {
    // The out-point is the frame an editor is looking for; a filmstrip that
    // stops one step short is missing the thing it was opened to check.
    const t = frameTimesFor(10, 5);
    expect(t[0]).toBe(0);
    expect(t[t.length - 1]).toBe(10);
    expect(t).toHaveLength(5);
  });

  it("spaces frames evenly", () => {
    expect(frameTimesFor(8, 5)).toEqual([0, 2, 4, 6, 8]);
  });

  it("never runs past the clip", () => {
    for (const t of frameTimesFor(3.7, 9)) expect(t).toBeLessThanOrEqual(3.7);
  });

  it("returns the single frame at the head when only one is asked for", () => {
    expect(frameTimesFor(10, 1)).toEqual([0]);
  });

  it("returns nothing for a clip with no duration", () => {
    // A zero-length clip has no frames to show, and dividing by count-1 would
    // otherwise produce NaN positions that render as a collapsed strip.
    expect(frameTimesFor(0, 5)).toEqual([]);
    expect(frameTimesFor(-2, 5)).toEqual([]);
    expect(frameTimesFor(NaN, 5)).toEqual([]);
    expect(frameTimesFor(10, 0)).toEqual([]);
  });
});

describe("waveform peaks", () => {
  it("returns one value per bucket", () => {
    expect(peaksFrom(new Float32Array(1000), 40)).toHaveLength(40);
  });

  it("keeps the transient instead of averaging it away", () => {
    // One loud sample in a quiet bucket is the whole point of a waveform.
    const samples = new Float32Array(100);
    samples.fill(0.01);
    samples[50] = 0.9;
    const peaks = peaksFrom(samples, 4);
    expect(Math.max(...peaks)).toBeCloseTo(0.9, 5);
  });

  it("treats negative excursions as loud, not quiet", () => {
    const samples = new Float32Array([0, -0.8, 0, -0.2]);
    expect(peaksFrom(samples, 1)[0]).toBeCloseTo(0.8, 5);
  });

  it("clamps above unity so a hot file cannot draw outside the box", () => {
    expect(peaksFrom(new Float32Array([3, -4]), 1)[0]).toBe(1);
  });

  it("returns nothing when there is nothing to read", () => {
    expect(peaksFrom(new Float32Array(0), 10)).toEqual([]);
    expect(peaksFrom(new Float32Array(10), 0)).toEqual([]);
  });
});

describe("timecode", () => {
  it("pads seconds so the field does not jump", () => {
    expect(formatTimecode(5)).toBe("0:05");
    expect(formatTimecode(65)).toBe("1:05");
    expect(formatTimecode(600)).toBe("10:00");
  });

  it("floors rather than rounding up into a second that has not happened", () => {
    expect(formatTimecode(9.9)).toBe("0:09");
  });

  it("survives the values a media element reports before it has loaded", () => {
    expect(formatTimecode(NaN)).toBe("0:00");
    expect(formatTimecode(-1)).toBe("0:00");
  });
});

describe("playable video", () => {
  it("accepts the container formats a browser will play", () => {
    expect(isPlayableVideo("https://x.test/a.mp4")).toBe(true);
    expect(isPlayableVideo("https://x.test/a.webm")).toBe(true);
    expect(isPlayableVideo("https://x.test/a.MOV")).toBe(true);
  });

  it("ignores a query string when reading the extension", () => {
    expect(isPlayableVideo("https://cdn.test/a.mp4?token=abc&x=1")).toBe(true);
  });

  it("rejects an image, so it shows as unsupported rather than a black player", () => {
    expect(isPlayableVideo("https://x.test/a.png")).toBe(false);
    expect(isPlayableVideo(undefined)).toBe(false);
    expect(isPlayableVideo("")).toBe(false);
  });
});
