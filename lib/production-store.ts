import { createAscensionThreadOneProject } from "./ascension-caudex";
import { durableCollection } from "./durable";
import { createTswsMicrodramaProject } from "./tsws-microdrama";
import type {
  EpisodeProductionStatus,
  ProductionAsset,
  ProductionProject,
  ProductionRun,
  ProofGate,
} from "./production";

const projects = durableCollection<ProductionProject>({
  key: "editforge:production-projects",
  file: "production-projects.json",
  seed: () => [],
});

const runs = durableCollection<ProductionRun>({
  key: "editforge:production-runs",
  file: "production-runs.json",
  seed: () => [],
});

export async function listProductionProjects(): Promise<ProductionProject[]> {
  return projects.list();
}

export async function getProductionProject(id: string): Promise<ProductionProject | null> {
  return projects.get(id);
}

export async function ensureAscensionThreadOne(): Promise<ProductionProject> {
  const id = "ascension-caudex-thread-01";
  const created = createAscensionThreadOneProject();
  let canonical = created;
  await projects.mutate((all) => {
    const existing = all.find((project) => project.id === id);
    if (existing) {
      let changed = false;
      if (!existing.canonAuthority) {
        existing.canonAuthority = created.canonAuthority;
        changed = true;
      }
      if (!existing.releasePosition) {
        existing.releasePosition = created.releasePosition;
        changed = true;
      }
      if (!existing.proofCharacterId) {
        existing.proofCharacterId = created.proofCharacterId;
        changed = true;
      }
      if (!Array.isArray(existing.sourceReferences)) {
        existing.sourceReferences = [];
        changed = true;
      }
      if (!Array.isArray(existing.protectedReferences)) {
        existing.protectedReferences = [];
        changed = true;
      }
      for (const character of existing.characters) {
        if (!character.media) {
          character.media = {};
          changed = true;
        }
      }
      for (const episode of existing.episodes) {
        if (!Array.isArray(episode.sourceAssetIds)) {
          episode.sourceAssetIds = [];
          changed = true;
        }
      }
      const devon = existing.characters.find((character) => character.id === "devon-rook");
      if (devon) {
        for (const requirement of existing.requirements.filter((item) => item.subjectId === devon.id)) {
          const asset = requirement.assetId
            ? existing.assets.find((item) => item.id === requirement.assetId)
            : undefined;
          if (!asset) continue;
          if (requirement.kind === "identity-image" && !devon.media.identityAssetId) {
            devon.media.identityAssetId = asset.workerAssetId;
            changed = true;
          } else if (requirement.kind === "voice-reference" && !devon.media.voiceReferenceAssetId) {
            devon.media.voiceReferenceAssetId = asset.workerAssetId;
            changed = true;
          } else if (requirement.kind === "driving-video" && !devon.media.drivingVideoAssetId) {
            devon.media.drivingVideoAssetId = asset.workerAssetId;
            changed = true;
          } else if (requirement.kind === "consent-record" && !devon.media.consentAssetId) {
            devon.media.consentAssetId = asset.workerAssetId;
            changed = true;
          }
        }
      }
      if (changed) existing.updatedAt = new Date().toISOString();
      canonical = existing;
      return;
    }
    all.unshift(created);
  });
  return canonical;
}

export async function ensureTswsMicrodrama(): Promise<ProductionProject> {
  const id = "tsws-microdrama-01";
  const created = createTswsMicrodramaProject();
  let canonical = created;
  await projects.mutate((all) => {
    const existing = all.find((project) => project.id === id);
    if (!existing) {
      all.unshift(created);
      return;
    }
    let changed = false;
    for (const character of existing.characters) {
      if (!character.media) {
        character.media = {};
        changed = true;
      }
    }
    for (const episode of existing.episodes) {
      if (!Array.isArray(episode.sourceAssetIds)) {
        episode.sourceAssetIds = [];
        changed = true;
      }
    }
    const sourceChanged = JSON.stringify(existing.sourceReferences ?? []) !== JSON.stringify(created.sourceReferences);
    const protectedChanged = JSON.stringify(existing.protectedReferences ?? []) !== JSON.stringify(created.protectedReferences);
    if (sourceChanged) {
      existing.sourceReferences = created.sourceReferences;
      changed = true;
    }
    if (protectedChanged) {
      existing.protectedReferences = created.protectedReferences;
      changed = true;
    }
    if (existing.canonAuthority !== created.canonAuthority) {
      existing.canonAuthority = created.canonAuthority;
      changed = true;
    }
    if (existing.releasePosition !== "before-long-form") {
      existing.releasePosition = "before-long-form";
      changed = true;
    }
    if (existing.releaseUnit !== "complete-microdrama") {
      existing.releaseUnit = "complete-microdrama";
      changed = true;
    }
    if (!existing.proofCharacterId) {
      existing.proofCharacterId = created.proofCharacterId;
      changed = true;
    }
    if (changed) existing.updatedAt = new Date().toISOString();
    canonical = existing;
  });
  return canonical;
}

async function mutateProject(
  id: string,
  fn: (project: ProductionProject) => void,
): Promise<ProductionProject | null> {
  let updated: ProductionProject | null = null;
  await projects.mutate((all) => {
    const project = all.find((item) => item.id === id);
    if (!project) return;
    fn(project);
    project.updatedAt = new Date().toISOString();
    updated = project;
  });
  return updated;
}

export async function attachProductionAsset(
  projectId: string,
  requirementId: string,
  asset: ProductionAsset,
): Promise<ProductionProject | null> {
  return mutateProject(projectId, (project) => {
    const requirement = project.requirements.find((item) => item.id === requirementId);
    if (!requirement) throw new Error(`Unknown asset requirement: ${requirementId}`);
    if (requirement.kind !== asset.kind) {
      throw new Error(`${requirement.label} requires ${requirement.kind}, not ${asset.kind}`);
    }
    asset.requirementId = requirementId;
    const existing = project.assets.findIndex((item) => item.id === asset.id);
    if (existing >= 0) project.assets[existing] = asset;
    else project.assets.push(asset);
    requirement.assetId = asset.id;
    if (requirement.subjectId) {
      const character = project.characters.find((item) => item.id === requirement.subjectId);
      if (character) {
        if (requirement.kind === "identity-image") character.media.identityAssetId = asset.workerAssetId;
        else if (requirement.kind === "voice-reference") character.media.voiceReferenceAssetId = asset.workerAssetId;
        else if (requirement.kind === "driving-video") character.media.drivingVideoAssetId = asset.workerAssetId;
        else if (requirement.kind === "consent-record") character.media.consentAssetId = asset.workerAssetId;
      }
    }
  });
}

export type CharacterMediaRole = "identity" | "voice" | "driving" | "consent";

export async function attachCharacterMedia(
  projectId: string,
  characterId: string,
  role: CharacterMediaRole,
  asset: ProductionAsset,
): Promise<ProductionProject | null> {
  return mutateProject(projectId, (project) => {
    const character = project.characters.find((item) => item.id === characterId);
    if (!character) throw new Error(`Unknown character: ${characterId}`);
    const expected = {
      identity: "identity-image",
      voice: "voice-reference",
      driving: "driving-video",
      consent: "consent-record",
    } as const;
    if (asset.kind !== expected[role]) {
      throw new Error(`${role} requires ${expected[role]}, not ${asset.kind}`);
    }
    if (role !== "consent") {
      if (!character.media.consentAssetId) {
        throw new Error(`${character.name} needs a consent record before protected media can be attached`);
      }
      if (asset.consentId !== character.media.consentAssetId) {
        throw new Error(`${character.name} ${role} media is not linked to the active consent record`);
      }
    }
    const existing = project.assets.findIndex(
      (item) => item.id === asset.id || item.workerAssetId === asset.workerAssetId,
    );
    if (existing >= 0) project.assets[existing] = asset;
    else project.assets.push(asset);
    if (role === "identity") character.media.identityAssetId = asset.workerAssetId;
    else if (role === "voice") character.media.voiceReferenceAssetId = asset.workerAssetId;
    else if (role === "driving") character.media.drivingVideoAssetId = asset.workerAssetId;
    else character.media.consentAssetId = asset.workerAssetId;
  });
}

export async function registerProductionAsset(
  projectId: string,
  asset: ProductionAsset,
): Promise<ProductionProject | null> {
  return mutateProject(projectId, (project) => {
    const existing = project.assets.findIndex(
      (item) => item.id === asset.id || item.workerAssetId === asset.workerAssetId,
    );
    if (existing >= 0) project.assets[existing] = asset;
    else project.assets.push(asset);
  });
}

export async function setProofGate(
  projectId: string,
  patch: Partial<ProofGate>,
): Promise<ProductionProject | null> {
  return mutateProject(projectId, (project) => {
    project.proofGate = { ...project.proofGate, ...patch };
  });
}

export async function setEpisodeProductionStatus(
  projectId: string,
  episodeNumber: number,
  status: EpisodeProductionStatus,
  masterAssetId?: string,
): Promise<ProductionProject | null> {
  return mutateProject(projectId, (project) => {
    const episode = project.episodes.find((item) => item.number === episodeNumber);
    if (!episode) throw new Error(`Unknown episode: ${episodeNumber}`);
    episode.status = status;
    if (masterAssetId) episode.masterAssetId = masterAssetId;
  });
}

export async function setEpisodeSourceAssets(
  projectId: string,
  episodeNumber: number,
  sourceAssetIds: string[],
): Promise<ProductionProject | null> {
  const unique = [...new Set(sourceAssetIds.map((id) => id.trim()).filter(Boolean))];
  return mutateProject(projectId, (project) => {
    const episode = project.episodes.find((item) => item.number === episodeNumber);
    if (!episode) throw new Error(`Unknown episode: ${episodeNumber}`);
    episode.sourceAssetIds = unique;
    episode.status = unique.length > 0 ? "assets-ready" : "script-locked";
  });
}

export async function registerProductionRun(run: ProductionRun): Promise<ProductionRun> {
  let canonical = run;
  await runs.mutate((all) => {
    const existing = all.find((item) => item.id === run.id);
    if (existing) {
      canonical = existing;
      return;
    }
    all.unshift(run);
  });
  return canonical;
}

export async function getProductionRun(id: string): Promise<ProductionRun | null> {
  return runs.get(id);
}

export async function setThreadMasterAsset(
  projectId: string,
  artifactId: string,
): Promise<ProductionProject | null> {
  return mutateProject(projectId, (project) => {
    project.threadMasterAssetId = artifactId;
  });
}
