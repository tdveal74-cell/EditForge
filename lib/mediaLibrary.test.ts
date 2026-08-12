import { describe, expect, it } from "vitest";
import { existsSync, statSync } from "fs";
import path from "path";
import { MEDIA, PRIMARY_CLIP, REFERENCE_STILL, noteIsInRange, videos } from "./mediaLibrary";

describe("the media library points at files that exist", () => {
  it("has every declared asset on disk under public/", () => {
    // A src that 404s renders as a black player or a broken frame, which reads
    // as "the component is broken" rather than "the file moved".
    for (const asset of MEDIA) {
      const file = path.join(process.cwd(), "public", asset.src.replace(/^\//, ""));
      expect(existsSync(file), `${asset.src} is declared but not on disk`).toBe(true);
      expect(statSync(file).size).toBeGreaterThan(0);
    }
  });

  it("gives every video a duration, because the filmstrip spaces frames across it", () => {
    // Without one, frameTimesFor gets 0 and draws nothing; with a wrong one the
    // strip either stops early or repeats the last frame.
    for (const v of videos()) {
      expect(v.durationSec, `${v.id} has no duration`).toBeGreaterThan(0);
    }
  });

  it("records real pixel dimensions, not placeholders", () => {
    for (const asset of MEDIA) {
      expect(asset.width).toBeGreaterThan(0);
      expect(asset.height).toBeGreaterThan(0);
    }
    // The clips are vertical and the reference frame is landscape; a surface
    // that assumed one shape would letterbox the other.
    expect(PRIMARY_CLIP.height).toBeGreaterThan(PRIMARY_CLIP.width);
    expect(REFERENCE_STILL.width).toBeGreaterThan(REFERENCE_STILL.height);
  });

  it("keeps ids unique, since surfaces look assets up by id", () => {
    expect(new Set(MEDIA.map((m) => m.id)).size).toBe(MEDIA.length);
  });
});

describe("note range", () => {
  it("rejects a timestamp past the end of its clip", () => {
    // The sample notes read 00:01:12 / 00:04:40 / 00:09:58 against a 15s take.
    expect(noteIsInRange(72, 15.07)).toBe(false);
    expect(noteIsInRange(280, 15.07)).toBe(false);
    expect(noteIsInRange(598, 15.07)).toBe(false);
  });

  it("accepts one inside the clip, including both ends", () => {
    expect(noteIsInRange(0, 15.07)).toBe(true);
    expect(noteIsInRange(11, 15.07)).toBe(true);
    expect(noteIsInRange(15.07, 15.07)).toBe(true);
  });

  it("rejects a negative timestamp", () => {
    expect(noteIsInRange(-1, 15.07)).toBe(false);
  });

  it("permits anything when the duration is unknown, rather than guessing", () => {
    expect(noteIsInRange(9999, undefined)).toBe(true);
  });
});
