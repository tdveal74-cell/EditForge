import { describe, expect, it } from "vitest";
import { HARDWARE_STATIONS, INFRA_LANES, flagshipCoverage, stationsByDept } from "./hardware";

describe("hardware reference spec", () => {
  it("covers every core department at flagship tier", () => {
    const { complete, depts } = flagshipCoverage();
    expect(complete).toBe(true);
    expect(depts).toEqual(expect.arrayContaining(["Editorial", "Color", "Sound", "VFX", "AI Media"]));
  });

  it("groups stations by department with no empty groups", () => {
    const byDept = stationsByDept();
    for (const stations of Object.values(byDept)) {
      expect(stations.length).toBeGreaterThan(0);
    }
    expect(Object.keys(byDept).length).toBeGreaterThanOrEqual(5);
  });

  it("defines the full storage lifecycle: online, nearline, cold archive", () => {
    const ids = INFRA_LANES.map((l) => l.id);
    expect(ids).toEqual(
      expect.arrayContaining(["storage-online", "storage-nearline", "storage-archive", "render-farm", "network"])
    );
  });

  it("every station states monitoring and I/O — no undefined chains", () => {
    for (const s of HARDWARE_STATIONS) {
      expect(s.io.length).toBeGreaterThan(0);
      expect(s.monitoring.length).toBeGreaterThan(0);
    }
  });
});
