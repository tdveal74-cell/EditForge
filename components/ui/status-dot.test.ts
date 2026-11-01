import { describe, expect, it } from "vitest";
import { toneFor } from "./status-dot";
import { SHOT_STATUSES } from "@/lib/vfxShot";

/**
 * `toneFor` matches free text and falls through to `pending`, which draws the
 * hollow "not started yet" ring. That fallthrough is the hazard: a status the
 * matcher has never heard of does not fail, it silently renders as not-started.
 * A rejected roll shipped looking exactly like an un-ingested one for that
 * reason, so every status the studio actually produces is enumerated here.
 */

const CUT_STATUSES = ["ingest", "grade", "review", "shipped", "archived"];
const ROLL_STATUSES = ["ingest", "review", "approved", "rejected"];

describe("status tone", () => {
  it("never draws a refusal as not-yet-started", () => {
    for (const s of ["rejected", "failed", "cancelled", "blocked", "hold"]) {
      expect(toneFor(s)).toBe("blocked");
    }
  });

  it("marks settled work as done", () => {
    for (const s of ["approved", "shipped", "completed", "done", "archived"]) {
      expect(toneFor(s)).toBe("done");
    }
  });

  it("does not treat Ready taxonomy or Live provider mode as done", () => {
    expect(toneFor("ready")).not.toBe("done");
    expect(toneFor("ready")).toBe("pending");
    expect(toneFor("live")).not.toBe("done");
    expect(toneFor("live")).toBe("active");
  });

  it("marks work in flight as active", () => {
    for (const s of ["wip", "running", "review", "grade", "rendering", "live"]) {
      expect(toneFor(s)).toBe("active");
    }
  });

  it("gives every cut status a tone that is not an accident of the fallthrough", () => {
    // `ingest` legitimately means not-started; the rest must be classified.
    for (const s of CUT_STATUSES) {
      if (s === "ingest") expect(toneFor(s)).toBe("pending");
      else expect(toneFor(s)).not.toBe("pending");
    }
  });

  it("gives every roll status a tone", () => {
    for (const s of ROLL_STATUSES) {
      if (s === "ingest") expect(toneFor(s)).toBe("pending");
      else expect(toneFor(s)).not.toBe("pending");
    }
  });

  it("gives every shot-board status a tone", () => {
    for (const s of SHOT_STATUSES) {
      if (s === "todo") expect(toneFor(s)).toBe("pending");
      else expect(toneFor(s)).not.toBe("pending");
    }
  });

  it("is case-insensitive, because these strings come from several stores", () => {
    expect(toneFor("REJECTED")).toBe("blocked");
    expect(toneFor("Approved")).toBe("done");
  });
});
