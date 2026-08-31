import { beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "fs";
import path from "path";

// Own data dir — test files run in parallel and would otherwise share a store.
const DATA_DIR = path.join(process.cwd(), ".data-test-handoff");
process.env.EDITFORGE_DATA_DIR = DATA_DIR;

const { GET } = await import("./route");
const { upsertCut } = await import("@/lib/store");

function get(query: string) {
  return new Request(`http://localhost/api/handoff?${query}`);
}

const now = new Date().toISOString();

beforeEach(async () => {
  await fs.rm(path.join(DATA_DIR, "cuts.json"), { force: true });
  await upsertCut({ id: "c1", title: "Cold Open", status: "review", createdAt: now, updatedAt: now });
});

describe("handoff download", () => {
  it("serves an EDL as a named file attachment", async () => {
    const res = await GET(get("kind=edl&cutId=c1"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="cold_open_25fps.edl"');
    expect(await res.text()).toContain("FCM: NON-DROP FRAME");
  });

  it("honours the requested timebase", async () => {
    const body = await (await GET(get("kind=edl&cutId=c1&fps=24"))).text();
    expect(body).toContain("* TIMEBASE: 24 FPS");
  });

  it("refuses a timebase it does not compute correctly", async () => {
    // 29.97 needs drop-frame arithmetic. Coercing it to 30 would emit timecode
    // that drifts ~3.6s per hour against wall clock.
    const res = await GET(get("kind=edl&cutId=c1&fps=29.97"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/fps must be one of/);
  });

  it("refuses an unknown kind rather than guessing one", async () => {
    const res = await GET(get("kind=aaf&cutId=c1"));
    expect(res.status).toBe(400);
  });

  it("requires a cut — an artifact with no cut describes nothing", async () => {
    expect((await GET(get("kind=edl"))).status).toBe(400);
  });

  it("404s a cut that is not in the store", async () => {
    expect((await GET(get("kind=edl&cutId=ghost"))).status).toBe(404);
  });

  it("serves the stem sheet as CSV at the requested delivery target", async () => {
    const res = await GET(get("kind=stems&cutId=c1&target=broadcast"));
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(res.headers.get("Content-Disposition")).toContain("cold_open_stems_broadcast.csv");
    expect(await res.text()).toContain("-23");
  });

  it("refuses a delivery target that has no defined loudness law", async () => {
    expect((await GET(get("kind=stems&cutId=c1&target=cinema"))).status).toBe(400);
  });

  it("serves the shot package and path contract as JSON", async () => {
    const shots = await GET(get("kind=shots&cutId=c1"));
    expect(shots.headers.get("Content-Type")).toContain("application/json");
    expect(JSON.parse(await shots.text()).shots.length).toBeGreaterThan(0);

    const paths = await GET(get("kind=paths&cutId=c1"));
    expect(JSON.parse(await paths.text()).tiers.online.path).toBe("online/c1/cold_open/");
  });

  it("says in the file when it fell back to the sample assembly", async () => {
    // Conforming from an assembly that is not this cut's, without being told,
    // is the failure this note exists to prevent.
    const body = await (await GET(get("kind=edl&cutId=c1"))).text();
    expect(body).toContain("sample assembly");
  });

  it("uses the cut's own assembly when it has one, and stops saying sample", async () => {
    await upsertCut({
      id: "c2",
      title: "Real Cut",
      status: "review",
      createdAt: now,
      updatedAt: now,
      clips: [{ id: "a", label: "Own plate", track: "video", startSec: 0, durationSec: 2 }],
    });

    const body = await (await GET(get("kind=edl&cutId=c2"))).text();
    expect(body).toContain("* FROM CLIP NAME: Own plate");
    expect(body).not.toContain("A-cam cold open");
    expect(body).toContain("cut assembly");
  });

  it("is never cached — a stale artifact conforms last week's cut", async () => {
    const res = await GET(get("kind=paths&cutId=c1"));
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});

  it("serves an ffmpeg plan as a named JSON attachment", async () => {
    const res = await GET(get("kind=plan&cutId=c1&jobKind=proxy"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/json");
    expect(res.headers.get("Content-Disposition")).toContain("cold_open_ffmpeg_proxy.json");
    const body = JSON.parse(await res.text());
    expect(body.handoff).toBe("render-farm");
    expect(body.plan.command).toContain("ffmpeg");
    expect(body.allowed).toBe(true);
  });

  it("export plans stay blocked in the file when the cut has no rubric pass", async () => {
    const res = await GET(get("kind=plan&cutId=c1&jobKind=export"));
    expect(res.status).toBe(200);
    const body = JSON.parse(await res.text());
    expect(body.kind).toBe("export");
    expect(body.allowed).toBe(false);
    expect(body.reason).toMatch(/no recorded rubric pass/);
  });


  it("serves a catalog export without a cut", async () => {
    const res = await GET(get("kind=catalog"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toContain("editforge-catalog.json");
    const body = JSON.parse(await res.text());
    expect(body.kind).toBe("catalog-export");
    expect(body.notice).toMatch(/does not enforce it/);
  });

  it("serves a mix session dump for a cut", async () => {
    const res = await GET(get("kind=session&cutId=c1"));
    expect(res.status).toBe(200);
    const body = JSON.parse(await res.text());
    expect(body.kind).toBe("mix-session");
    expect(body.notice).toMatch(/Not Fairlight/);
  });

  it("serves a node graph for a cut", async () => {
    const res = await GET(get("kind=graph&cutId=c1"));
    expect(res.status).toBe(200);
    const body = JSON.parse(await res.text());
    expect(body.kind).toBe("vfx-node-graph");
    expect(body.notice).toMatch(/Not Fusion/);
  });
