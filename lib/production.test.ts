import { describe, expect, it } from "vitest";
import { createAscensionThreadOneProject } from "./ascension-caudex";
import { readinessFor, validateProductionProject, type ProductionAsset } from "./production";

function asset(
  id: string,
  requirementId: string,
  kind: ProductionAsset["kind"],
  consentId?: string,
): ProductionAsset {
  return {
    id,
    requirementId,
    kind,
    label: id,
    mimeType: kind === "consent-record" ? "application/json" : "application/octet-stream",
    bytes: 100,
    sha256: "a".repeat(64),
    workerAssetId: `worker-${id}`,
    consentId,
    createdAt: "2026-08-20T00:00:00.000Z",
  };
}

function attachAllProofAssets() {
  const project = createAscensionThreadOneProject("2026-08-20T00:00:00.000Z");
  const consentWorkerId = "worker-asset-devon-consent";
  for (const requirement of project.requirements) {
    const linked = asset(
      `asset-${requirement.id}`,
      requirement.id,
      requirement.kind,
      requirement.consentRequired ? consentWorkerId : undefined,
    );
    if (requirement.id === "devon-consent") linked.workerAssetId = consentWorkerId;
    project.assets.push(linked);
    requirement.assetId = linked.id;
  }
  return project;
}

describe("Ascension production manifest", () => {
  it("locks the 12×90-second native vertical 4K Thread specification", () => {
    const project = createAscensionThreadOneProject();
    expect(project.output).toEqual({
      width: 2160,
      height: 3840,
      fps: 24,
      aspect: "9:16",
      episodeDurationSec: 90,
      episodeCount: 12,
    });
    expect(project.episodes).toHaveLength(12);
    expect(project.episodes.map((episode) => episode.number)).toEqual(
      Array.from({ length: 12 }, (_, index) => index + 1),
    );
    expect(validateProductionProject(project).valid).toBe(true);
  });

  it("contains Devon and no stale Malik identity", () => {
    const project = createAscensionThreadOneProject();
    expect(project.characters.map((character) => character.name)).toContain("Devon Rook");
    expect(JSON.stringify(project)).not.toMatch(/Malik/i);
  });

  it("blocks a proof render until identity, voice, driving performance, and consent are attached", () => {
    const project = createAscensionThreadOneProject();
    const readiness = readinessFor(project, "proof");
    expect(readiness.valid).toBe(false);
    expect(readiness.blockers.filter((item) => item.code === "REQUIRED_ASSET")).toHaveLength(4);
  });

  it("blocks identity-clone media when consent linkage is absent", () => {
    const project = attachAllProofAssets();
    const voice = project.assets.find((item) => item.requirementId === "devon-voice-primary")!;
    delete voice.consentId;
    const readiness = readinessFor(project, "proof");
    expect(readiness.blockers.some((item) => item.code === "CONSENT_REQUIRED")).toBe(true);
  });

  it("allows the proof after every required asset has provenance and consent", () => {
    const project = attachAllProofAssets();
    expect(readinessFor(project, "proof").valid).toBe(true);
  });

  it("blocks episode work until the proof has been accepted", () => {
    const project = attachAllProofAssets();
    expect(readinessFor(project, "episode", 1).blockers.some((item) => item.code === "PROOF_GATE")).toBe(true);
    project.proofGate.status = "accepted";
    project.proofGate.artifactId = "artifact-shot-1";
    project.episodes[0].sourceAssetIds = ["artifact-shot-1"];
    expect(readinessFor(project, "episode", 1).valid).toBe(true);
  });

  it("blocks a Thread master until all twelve episode masters are accepted", () => {
    const project = attachAllProofAssets();
    project.proofGate.status = "accepted";
    expect(readinessFor(project, "thread").blockers.some((item) => item.code === "EPISODES_NOT_ACCEPTED")).toBe(true);
    for (const episode of project.episodes) episode.status = "accepted";
    expect(readinessFor(project, "thread").valid).toBe(true);
  });

  it("refuses stale identity and output drift", () => {
    const project = createAscensionThreadOneProject();
    project.characters[0].name = "Malik";
    project.output = { ...project.output, width: 1080 } as unknown as typeof project.output;
    const result = validateProductionProject(project);
    expect(result.blockers.map((item) => item.code)).toEqual(
      expect.arrayContaining(["OUTPUT_SPEC", "DEVON_IDENTITY", "STALE_IDENTITY"]),
    );
  });
});
