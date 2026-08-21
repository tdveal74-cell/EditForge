import { afterEach, describe, expect, it } from "vitest";
import { GET } from "./route";

const SECRET = "sk-super-secret-value-9999";

afterEach(() => {
  for (const key of [
    "RUNWAY_API_KEY",
    "RUNWAY_COST_PER_SECOND_USD",
    "KLING_API_KEY",
    "EDITFORGE_SPEND_MODE",
    "EDITFORGE_BILLING_ENABLED",
    "EDITFORGE_TOTAL_BUDGET_USD",
    "EDITFORGE_SPENT_USD",
    "EDITFORGE_PER_JOB_LIMIT_USD",
    "EDITFORGE_WORKER_URL",
    "EDITFORGE_WORKER_TOKEN",
  ]) delete process.env[key];
});

describe("provider readiness endpoint", () => {
  it("reports the credential name and whether it is set, never the value", async () => {
    process.env.RUNWAY_API_KEY = SECRET;

    const res = await GET();
    const body = await res.json();
    const raw = JSON.stringify(body);

    // The whole point of this endpoint is that it is safe to call from a browser.
    expect(raw).not.toContain(SECRET);
    expect(raw).toContain("RUNWAY_API_KEY");

    const runway = body.providers.find((p: { id: string }) => p.id === "runway");
    expect(runway.credentialSet).toBe(true);
    expect(runway.billable).toBe(false);
    expect(runway.blockedReason).toMatch(/zero-cost/i);
    expect(body.spendPolicy.totalBudgetUsd).toBe(0);
  });

  it("marks Runway eligible only after every controlled-spend control is explicit", async () => {
    process.env.RUNWAY_API_KEY = "live-key";
    process.env.RUNWAY_COST_PER_SECOND_USD = "0.05";
    process.env.EDITFORGE_SPEND_MODE = "controlled";
    process.env.EDITFORGE_BILLING_ENABLED = "true";
    process.env.EDITFORGE_TOTAL_BUDGET_USD = "10";
    process.env.EDITFORGE_SPENT_USD = "0";
    process.env.EDITFORGE_PER_JOB_LIMIT_USD = "1";

    const body = await (await GET()).json();
    const runway = body.providers.find((p: { id: string }) => p.id === "runway");
    expect(runway.billable).toBe(true);
    expect(runway.rateConfigured).toBe(true);
  });

  it("marks a provider without its credential as not billable", async () => {
    delete process.env.RUNWAY_API_KEY;

    const body = await (await GET()).json();
    const runway = body.providers.find((p: { id: string }) => p.id === "runway");
    expect(runway.credentialSet).toBe(false);
    expect(runway.billable).toBe(false);
    // The live path exists; it is the key that is missing.
    expect(runway.wired).toBe(true);
  });

  it("marks a credentialled provider with no live path as wired-false, not billable", async () => {
    process.env.KLING_API_KEY = "tok";
    const body = await (await GET()).json();
    const kling = body.providers.find((p: { id: string }) => p.id === "kling");
    expect(kling.wired).toBe(false);
    expect(kling.billable).toBe(false);
    delete process.env.KLING_API_KEY;
  });

  it("never marks the offline provider billable", async () => {
    const body = await (await GET()).json();
    const mock = body.providers.find((p: { id: string }) => p.id === "mock");
    expect(mock.billable).toBe(false);
    expect(mock.wired).toBe(true);
    expect(mock.available).toBe(true);
  });

  it("marks an authenticated self-hosted worker available without enabling paid providers", async () => {
    process.env.EDITFORGE_WORKER_URL = "http://worker.internal:8787";
    process.env.EDITFORGE_WORKER_TOKEN = "private-token";
    const body = await (await GET()).json();
    const worker = body.providers.find((p: { id: string }) => p.id === "forge-worker");
    expect(worker.wired).toBe(true);
    expect(worker.available).toBe(true);
    expect(worker.billable).toBe(false);
    expect(worker.executionClass).toBe("free-local");
    expect(JSON.stringify(body)).not.toContain("private-token");
  });
});
