export const VERTICAL_4K = {
  width: 2160,
  height: 3840,
  fps: 24,
  aspect: "9:16",
} as const;

export type ProductionAssetKind =
  | "identity-image"
  | "voice-reference"
  | "consent-record"
  | "driving-video"
  | "visual-reference"
  | "audio"
  | "video"
  | "caption-track"
  | "master";

export type ProductionTarget = "proof" | "episode" | "thread";

export type ProductionAsset = {
  id: string;
  requirementId?: string;
  kind: ProductionAssetKind;
  label: string;
  mimeType: string;
  bytes: number;
  sha256: string;
  workerAssetId: string;
  consentId?: string;
  createdAt: string;
};

export type CanonicalSourceReference = {
  id: string;
  provider: "google-drive";
  externalId: string;
  url: string;
  label: string;
  mimeType: string;
  bytes: number;
  durationSec: number;
  width: number;
  height: number;
  order: number;
  role: "source-clip" | "completed-cut";
  createdAt: string;
};

export type ProtectedCanonReference = {
  id: string;
  provider: "google-drive";
  externalId: string;
  url: string;
  label: string;
  reason: string;
};

export type AssetRequirement = {
  id: string;
  kind: ProductionAssetKind;
  label: string;
  subjectId?: string;
  requiredFor: readonly ProductionTarget[];
  consentRequired: boolean;
  assetId?: string;
};

export type ProductionCharacter = {
  id: string;
  name: string;
  isIdentityClone: boolean;
  performanceDirection: string;
  media: {
    identityAssetId?: string;
    voiceReferenceAssetId?: string;
    drivingVideoAssetId?: string;
    consentAssetId?: string;
  };
};

export type ProductionBeat = {
  id: string;
  startSec: number;
  endSec: number;
  speaker?: string;
  text: string;
  intent: "action" | "dialogue" | "reveal" | "artifact";
};

export type EpisodeProductionStatus =
  | "script-locked"
  | "assets-ready"
  | "rendering"
  | "validating"
  | "accepted";

export type ProductionEpisode = {
  id: string;
  number: number;
  title: string;
  slug: string;
  targetDurationSec: number;
  artifact: string;
  beats: ProductionBeat[];
  status: EpisodeProductionStatus;
  /** Worker asset or artifact ids, in final editorial order. */
  sourceAssetIds: string[];
  masterAssetId?: string;
};

export type ProofGate = {
  status: "not-ready" | "ready" | "rendering" | "validating" | "accepted";
  jobId?: string;
  artifactId?: string;
  acceptedAt?: string;
  reviewer?: string;
  notes?: string;
};

export type ProductionProject = {
  id: string;
  property: "ascension-caudex" | "tsws-microdrama";
  title: string;
  canonAuthority: string;
  releasePosition: "primary" | "before-long-form";
  threadNumber: number;
  threadTitle: string;
  releaseUnit: "complete-thread" | "complete-season" | "complete-series" | "complete-microdrama";
  output: typeof VERTICAL_4K & { episodeDurationSec: number; episodeCount: number };
  proofCharacterId: string;
  productionNotes?: string[];
  characters: ProductionCharacter[];
  requirements: AssetRequirement[];
  assets: ProductionAsset[];
  sourceReferences: CanonicalSourceReference[];
  protectedReferences: ProtectedCanonReference[];
  episodes: ProductionEpisode[];
  proofGate: ProofGate;
  threadMasterAssetId?: string;
  createdAt: string;
  updatedAt: string;
};

export type ProductionRun = {
  id: string;
  projectId: string;
  target: ProductionTarget;
  episodeNumber?: number;
  createdAt: string;
  updatedAt: string;
};

export type ProductionIssue = {
  code: string;
  severity: "blocker" | "warning";
  path: string;
  message: string;
};

export type ProductionValidation = {
  valid: boolean;
  blockers: ProductionIssue[];
  warnings: ProductionIssue[];
};

function issue(
  code: string,
  path: string,
  message: string,
  severity: ProductionIssue["severity"] = "blocker",
): ProductionIssue {
  return { code, path, message, severity };
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated];
}

export function validateProductionProject(project: ProductionProject): ProductionValidation {
  const issues: ProductionIssue[] = [];

  if (
    project.output.width !== VERTICAL_4K.width ||
    project.output.height !== VERTICAL_4K.height ||
    project.output.fps !== VERTICAL_4K.fps ||
    project.output.aspect !== VERTICAL_4K.aspect
  ) {
    issues.push(
      issue(
        "OUTPUT_SPEC",
        "output",
        "Production masters must be native 2160×3840 vertical at 24 fps.",
      ),
    );
  }

  if (
    !Number.isInteger(project.output.episodeCount) ||
    project.output.episodeCount < 1 ||
    project.output.episodeCount > 108 ||
    project.episodes.length !== project.output.episodeCount
  ) {
    issues.push(issue("EPISODE_COUNT", "episodes", "The episode inventory must match the declared release unit count (1–108)."));
  }

  const expectedNumbers = Array.from({ length: project.output.episodeCount }, (_, index) => index + 1);
  const actualNumbers = project.episodes.map((episode) => episode.number).sort((a, b) => a - b);
  if (expectedNumbers.some((value, index) => actualNumbers[index] !== value)) {
    issues.push(issue("EPISODE_SEQUENCE", "episodes", `Episode numbers must be unique and contiguous from 1 through ${project.output.episodeCount}.`));
  }

  if (!project.canonAuthority.trim()) {
    issues.push(issue("CANON_AUTHORITY", "canonAuthority", "Every production lane must name its canon authority."));
  }

  for (const duplicate of duplicates(project.episodes.map((episode) => episode.id))) {
    issues.push(issue("DUPLICATE_EPISODE_ID", "episodes", `Duplicate episode id: ${duplicate}`));
  }
  for (const duplicate of duplicates(project.requirements.map((requirement) => requirement.id))) {
    issues.push(issue("DUPLICATE_REQUIREMENT_ID", "requirements", `Duplicate asset requirement id: ${duplicate}`));
  }
  for (const duplicate of duplicates(project.assets.map((asset) => asset.id))) {
    issues.push(issue("DUPLICATE_ASSET_ID", "assets", `Duplicate asset id: ${duplicate}`));
  }
  for (const duplicate of duplicates(project.sourceReferences.map((reference) => reference.id))) {
    issues.push(issue("DUPLICATE_SOURCE_REFERENCE", "sourceReferences", `Duplicate source reference id: ${duplicate}`));
  }

  const sourceOrders = [...project.sourceReferences].sort((a, b) => a.order - b.order);
  for (const [index, reference] of sourceOrders.entries()) {
    if (reference.order !== index + 1) {
      issues.push(issue("SOURCE_ORDER", "sourceReferences", "Canonical source references must have one contiguous editorial order."));
      break;
    }
    if (
      reference.provider !== "google-drive" ||
      !reference.externalId ||
      !reference.url.startsWith("https://drive.google.com/") ||
      reference.bytes <= 0 ||
      reference.durationSec <= 0 ||
      reference.width <= 0 ||
      reference.height <= 0
    ) {
      issues.push(issue("SOURCE_PROVENANCE", `sourceReferences.${reference.id}`, `${reference.label} is missing complete Drive and media provenance.`));
    }
  }
  const protectedExternalIds = new Set(project.protectedReferences.map((reference) => reference.externalId));
  for (const reference of project.sourceReferences) {
    if (protectedExternalIds.has(reference.externalId)) {
      issues.push(issue("PROTECTED_SOURCE", `sourceReferences.${reference.id}`, `${reference.label} belongs to protected canon and cannot enter this production lane.`));
    }
  }

  const characterNames = new Set(project.characters.map((character) => character.name.toUpperCase()));
  if (!project.characters.some((character) => character.id === project.proofCharacterId)) {
    issues.push(issue("PROOF_CHARACTER", "proofCharacterId", "The proof character must exist in the project cast."));
  }
  if (project.property === "ascension-caudex") {
    if (project.output.episodeCount !== 12 || project.output.episodeDurationSec !== 90) {
      issues.push(issue("ASCENSION_FORMAT", "output", "An Ascension Memory Thread is 12 episodes at 90 seconds each."));
    }
    if (!characterNames.has("DEVON ROOK")) {
      issues.push(issue("DEVON_IDENTITY", "characters", "Devon Rook must remain the Ascension Caudex lead."));
    }
    if (characterNames.has("MALIK") || characterNames.has("MALIK ROOK")) {
      issues.push(issue("STALE_IDENTITY", "characters", "Malik is stale canon; the lead identity is Devon Rook."));
    }
  } else {
    if (project.output.episodeDurationSec < 20 || project.output.episodeDurationSec > 180) {
      issues.push(issue("MICRODRAMA_RUNTIME", "output.episodeDurationSec", "The TSWS microdrama lane accepts 20–180 second episodes only; long-form is protected."));
    }
    if (!["AUREN", "VESPERA"].every((name) => characterNames.has(name))) {
      issues.push(issue("TSWS_CAST", "characters", "The TSWS microdrama cast must preserve Auren and Vespera."));
    }
    if (project.releasePosition !== "before-long-form" || project.releaseUnit !== "complete-microdrama") {
      issues.push(issue("TSWS_RELEASE_LANE", "releasePosition", "TSWS Microdrama must remain a separate complete release scheduled before the long-form videos."));
    }
    if (project.protectedReferences.length === 0) {
      issues.push(issue("TSWS_LONGFORM_BOUNDARY", "protectedReferences", "The TSWS long-form source package must be explicitly recorded as protected."));
    }
    const completedCuts = project.sourceReferences.filter((reference) => reference.role === "completed-cut");
    if (completedCuts.length !== 1) {
      issues.push(issue("TSWS_CANON_CUT", "sourceReferences", "The Grok Visuals lane must identify exactly one creator-authored completed microdrama cut."));
    } else if (Math.abs(completedCuts[0].durationSec - project.output.episodeDurationSec) > 0.125) {
      issues.push(issue("TSWS_CANON_RUNTIME", "output.episodeDurationSec", "The microdrama runtime must match the creator-authored completed cut."));
    }
  }

  const assetIds = new Set(project.assets.map((asset) => asset.id));
  const knownWorkerMediaIds = new Set(
    project.assets.map((asset) => asset.workerAssetId).filter(Boolean),
  );
  if (project.proofGate.artifactId) knownWorkerMediaIds.add(project.proofGate.artifactId);
  for (const episode of project.episodes) {
    if (episode.masterAssetId) knownWorkerMediaIds.add(episode.masterAssetId);
  }
  const requirementIds = new Set(project.requirements.map((requirement) => requirement.id));
  for (const requirement of project.requirements) {
    if (requirement.assetId && !assetIds.has(requirement.assetId)) {
      issues.push(
        issue(
          "MISSING_ASSET_RECORD",
          `requirements.${requirement.id}`,
          `${requirement.label} points to an asset that is not in the project inventory.`,
        ),
      );
    }
  }
  for (const asset of project.assets) {
    if (asset.requirementId && !requirementIds.has(asset.requirementId)) {
      issues.push(
        issue(
          "UNKNOWN_REQUIREMENT",
          `assets.${asset.id}`,
          `${asset.label} is attached to an unknown requirement.`,
        ),
      );
    }
    if (!/^[a-f0-9]{64}$/i.test(asset.sha256)) {
      issues.push(issue("ASSET_HASH", `assets.${asset.id}.sha256`, `${asset.label} needs a complete SHA-256 provenance hash.`));
    }
    if (asset.bytes <= 0) {
      issues.push(issue("ASSET_BYTES", `assets.${asset.id}.bytes`, `${asset.label} has no recorded file size.`));
    }
  }

  for (const episode of project.episodes) {
    const base = `episodes.${episode.number}`;
    if (episode.targetDurationSec !== project.output.episodeDurationSec) {
      issues.push(
        issue(
          "EPISODE_RUNTIME",
          `${base}.targetDurationSec`,
          `Episode ${episode.number} must target ${project.output.episodeDurationSec} seconds.`,
        ),
      );
    }
    if (episode.beats.length === 0) {
      issues.push(issue("EMPTY_EPISODE", `${base}.beats`, `Episode ${episode.number} has no production beats.`));
      continue;
    }
    const sorted = [...episode.beats].sort((a, b) => a.startSec - b.startSec);
    let previousEnd = 0;
    for (const beat of sorted) {
      if (beat.startSec < 0 || beat.endSec <= beat.startSec || beat.endSec > episode.targetDurationSec) {
        issues.push(
          issue(
            "BEAT_RANGE",
            `${base}.beats.${beat.id}`,
            `Beat ${beat.id} must fit inside the ${episode.targetDurationSec}-second episode.`,
          ),
        );
      }
      if (beat.startSec < previousEnd) {
        issues.push(issue("BEAT_OVERLAP", `${base}.beats.${beat.id}`, `Beat ${beat.id} overlaps the beat before it.`));
      }
      previousEnd = Math.max(previousEnd, beat.endSec);
    }
    if (sorted[sorted.length - 1].endSec < episode.targetDurationSec - 6) {
      issues.push(
        issue(
          "ENDING_HOLD",
          `${base}.beats`,
          `Episode ${episode.number} leaves more than six seconds without an intentional final beat.`,
          "warning",
        ),
      );
    }
    for (const sourceId of episode.sourceAssetIds) {
      if (!knownWorkerMediaIds.has(sourceId)) {
        issues.push(
          issue(
            "UNKNOWN_EPISODE_SOURCE",
            `${base}.sourceAssetIds`,
            `Episode ${episode.number} references unknown worker media: ${sourceId}`,
          ),
        );
      }
    }
  }

  const blockers = issues.filter((item) => item.severity === "blocker");
  const warnings = issues.filter((item) => item.severity === "warning");
  return { valid: blockers.length === 0, blockers, warnings };
}

export function attachedRequirement(
  project: ProductionProject,
  requirement: AssetRequirement,
): ProductionAsset | undefined {
  return requirement.assetId
    ? project.assets.find((asset) => asset.id === requirement.assetId)
    : undefined;
}

export function readinessFor(
  project: ProductionProject,
  target: ProductionTarget,
  episodeNumber?: number,
): ProductionValidation {
  const base = validateProductionProject(project);
  const issues = [...base.blockers, ...base.warnings];
  for (const requirement of project.requirements.filter((item) => item.requiredFor.includes(target))) {
    const asset = attachedRequirement(project, requirement);
    if (!asset) {
      issues.push(
        issue(
          "REQUIRED_ASSET",
          `requirements.${requirement.id}`,
          `${requirement.label} is required before ${target} rendering.`,
        ),
      );
      continue;
    }
    const consentRequirement = project.requirements.find(
      (item) => item.kind === "consent-record" && item.subjectId === requirement.subjectId,
    );
    const consentAsset = consentRequirement ? attachedRequirement(project, consentRequirement) : undefined;
    if (requirement.consentRequired && !asset.consentId) {
      issues.push(
        issue(
          "CONSENT_REQUIRED",
          `assets.${asset.id}.consentId`,
          `${requirement.label} cannot be used without an explicit consent record.`,
        ),
      );
    } else if (
      requirement.consentRequired &&
      consentAsset &&
      asset.consentId !== consentAsset.workerAssetId
    ) {
      issues.push(
        issue(
          "CONSENT_MISMATCH",
          `assets.${asset.id}.consentId`,
          `${requirement.label} is not linked to the active consent record for this character.`,
        ),
      );
    }
  }

  if (target !== "proof" && project.proofGate.status !== "accepted") {
    issues.push(issue("PROOF_GATE", "proofGate", "The identity proof shot must be accepted before episode or collection rendering."));
  }

  if (target === "episode") {
    const episode = project.episodes.find((item) => item.number === episodeNumber);
    if (!episode) {
      issues.push(issue("EPISODE_REQUIRED", "episodeNumber", `Choose an episode from 1 through ${project.output.episodeCount}.`));
    } else if (episode.sourceAssetIds.length === 0) {
      issues.push(
        issue(
          "EPISODE_SOURCES",
          `episodes.${episode.number}.sourceAssetIds`,
          `Episode ${episode.number} needs at least one accepted full-motion source segment before mastering.`,
        ),
      );
    }
  }

  if (target === "thread") {
    const incomplete = project.episodes.filter((episode) => episode.status !== "accepted");
    if (incomplete.length > 0) {
      issues.push(
        issue(
          "EPISODES_NOT_ACCEPTED",
          "episodes",
          `Collection master is blocked until all ${project.output.episodeCount} episode masters are accepted; ${incomplete.length} remain.`,
        ),
      );
    }
  }

  const blockers = issues.filter((item) => item.severity === "blocker");
  const warnings = issues.filter((item) => item.severity === "warning");
  return { valid: blockers.length === 0, blockers, warnings };
}

const SPEAKER_CHARACTER: Record<string, string> = {
  DEVON: "devon-rook",
  "DEVON ROOK": "devon-rook",
  TAVI: "tavi",
  ORIN: "orin",
  SANA: "sana",
  JONAH: "jonah",
  "THE SECOND": "the-second",
  "MASKED FOUNDER": "the-second",
  FOUNDER: "the-second",
  AUREN: "auren",
  VESPERA: "vespera",
};

export function characterForSpeaker(project: ProductionProject, speaker: string) {
  const canonicalId = SPEAKER_CHARACTER[speaker.trim().toUpperCase()];
  return canonicalId ? project.characters.find((character) => character.id === canonicalId) : undefined;
}

export function generationReadinessFor(
  project: ProductionProject,
  episodeNumber: number,
): ProductionValidation {
  const base = validateProductionProject(project);
  const issues = [...base.blockers, ...base.warnings];
  const episode = project.episodes.find((item) => item.number === episodeNumber);
  if (!episode) {
    issues.push(issue("EPISODE_REQUIRED", "episodeNumber", `Choose an episode from 1 through ${project.output.episodeCount}.`));
  }
  if (project.proofGate.status !== "accepted") {
    issues.push(issue("PROOF_GATE", "proofGate", "The identity proof shot must be accepted before script generation."));
  }

  const used = new Map<string, ProductionCharacter>();
  for (const beat of episode?.beats ?? []) {
    if (!beat.speaker) continue;
    const character = characterForSpeaker(project, beat.speaker);
    if (!character) {
      issues.push(
        issue(
          "UNKNOWN_SPEAKER",
          `episodes.${episodeNumber}.beats.${beat.id}.speaker`,
          `No production character is mapped to ${beat.speaker}.`,
        ),
      );
      continue;
    }
    used.set(character.id, character);
  }

  for (const character of used.values()) {
    const missing = [
      ["identityAssetId", "identity image"],
      ["voiceReferenceAssetId", "voice reference"],
      ["drivingVideoAssetId", "driving performance"],
      ["consentAssetId", "consent record"],
    ].filter(([field]) => !character.media[field as keyof ProductionCharacter["media"]]);
    if (missing.length > 0) {
      issues.push(
        issue(
          "CHARACTER_PACK",
          `characters.${character.id}.media`,
          `${character.name} needs ${missing.map(([, label]) => label).join(", ")} before script generation.`,
        ),
      );
      continue;
    }
    const consent = project.assets.find(
      (asset) => asset.workerAssetId === character.media.consentAssetId,
    );
    if (!consent || consent.kind !== "consent-record") {
      issues.push(
        issue(
          "CHARACTER_CONSENT",
          `characters.${character.id}.media.consentAssetId`,
          `${character.name}'s active consent record is missing from the project inventory.`,
        ),
      );
      continue;
    }
    for (const workerAssetId of [
      character.media.identityAssetId,
      character.media.voiceReferenceAssetId,
      character.media.drivingVideoAssetId,
    ]) {
      const asset = project.assets.find((item) => item.workerAssetId === workerAssetId);
      if (!asset || asset.consentId !== character.media.consentAssetId) {
        issues.push(
          issue(
            "CHARACTER_CONSENT_MISMATCH",
            `characters.${character.id}.media`,
            `${character.name}'s performance media is not bound to the active consent record.`,
          ),
        );
        break;
      }
    }
  }

  const blockers = issues.filter((item) => item.severity === "blocker");
  const warnings = issues.filter((item) => item.severity === "warning");
  return { valid: blockers.length === 0, blockers, warnings };
}
