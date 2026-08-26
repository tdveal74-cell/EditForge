import { createHash } from "crypto";

export const EDIT_COMMAND_SCHEMA = "editforge.edit-command.v1" as const;
export const EDIT_RECEIPT_SCHEMA = "editforge.edit-receipt.v1" as const;

export type PortfolioProperty = "tqo" | "nco-forge" | "tsws" | "ascension-caudex";
export type Deliverable = "long-form" | "short-form" | "micro-drama";
export type OutputMode = "preview" | "master";

export const EDIT_OPERATION_TYPES = [
  "trim",
  "split",
  "reorder",
  "replace-shot",
  "reframe",
  "speed",
  "captions",
  "audio-mix",
  "grade",
  "title",
  "transition",
  "synthesize-voice",
  "generate-full-motion",
  "lip-sync",
  "render-preview",
  "render-master",
  "derive-short",
  "assemble-episode",
  "assemble-compilation",
] as const;

export type EditOperationType = (typeof EDIT_OPERATION_TYPES)[number];

export type EditOperation = {
  id: string;
  type: EditOperationType;
  target?: string;
  params: Record<string, unknown>;
};

export type EditCommand = {
  schema: typeof EDIT_COMMAND_SCHEMA;
  commandId: string;
  projectId: string;
  cutId: string;
  property: PortfolioProperty;
  deliverable: Deliverable;
  issuedBy: "DEVON";
  source: {
    uri: string;
    sha256: string;
  };
  identity?: {
    cloneId: string;
    voiceId: string;
    version: string;
    consentRecorded: boolean;
  };
  canon: {
    version: string;
    locked: boolean;
  };
  authorization: {
    approvalId: string;
    approvedBy: string;
    scopes: string[];
    expiresAt?: string;
  };
  operations: EditOperation[];
  output: {
    mode: OutputMode;
    width: number;
    height: number;
    fps: 24 | 25 | 30;
    container: "mp4" | "mov";
    uploadUrl?: string;
  };
};

export type EditValidationIssue = {
  field: string;
  severity: "error" | "warning";
  message: string;
};

const PROPERTIES = new Set<PortfolioProperty>(["tqo", "nco-forge", "tsws", "ascension-caudex"]);
const DELIVERABLES = new Set<Deliverable>(["long-form", "short-form", "micro-drama"]);
const OPERATIONS = new Set<string>(EDIT_OPERATION_TYPES);
const IDENTITY_OPERATIONS = new Set<EditOperationType>([
  "synthesize-voice",
  "generate-full-motion",
  "lip-sync",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function validHash(value: unknown): boolean {
  return /^[a-f0-9]{64}$/i.test(text(value));
}

function validId(value: unknown): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{2,119}$/.test(text(value));
}

function operationAuthorized(command: EditCommand, type: EditOperationType): boolean {
  const scopes = new Set(command.authorization.scopes);
  return scopes.has("edit:*") || scopes.has(`edit:${type}`);
}

export function validateEditCommand(value: unknown, now = new Date()): EditValidationIssue[] {
  const issues: EditValidationIssue[] = [];
  const fail = (field: string, message: string) => issues.push({ field, severity: "error", message });

  if (!isRecord(value)) return [{ field: "command", severity: "error", message: "must be an object" }];
  if (value.schema !== EDIT_COMMAND_SCHEMA) fail("schema", `must equal ${EDIT_COMMAND_SCHEMA}`);
  if (!validId(value.commandId)) fail("commandId", "must be a stable 3-120 character id");
  if (!validId(value.projectId)) fail("projectId", "must be a stable 3-120 character id");
  if (!validId(value.cutId)) fail("cutId", "must be a stable 3-120 character id");
  if (!PROPERTIES.has(value.property as PortfolioProperty)) fail("property", "is not a canonical portfolio property");
  if (!DELIVERABLES.has(value.deliverable as Deliverable)) fail("deliverable", "is not supported");
  if (value.issuedBy !== "DEVON") fail("issuedBy", "must be DEVON");

  if (!isRecord(value.source)) fail("source", "is required");
  else {
    if (!text(value.source.uri)) fail("source.uri", "is required");
    if (!validHash(value.source.sha256)) fail("source.sha256", "must be a SHA-256 hash");
  }

  if (!isRecord(value.canon)) fail("canon", "is required");
  else {
    if (!text(value.canon.version)) fail("canon.version", "is required");
    if (value.canon.locked !== true) fail("canon.locked", "must be true before execution");
  }

  if (!isRecord(value.authorization)) fail("authorization", "is required");
  else {
    if (!validId(value.authorization.approvalId)) fail("authorization.approvalId", "is required");
    if (!text(value.authorization.approvedBy)) fail("authorization.approvedBy", "is required");
    if (!Array.isArray(value.authorization.scopes) || value.authorization.scopes.length === 0) {
      fail("authorization.scopes", "must contain at least one edit scope");
    }
    const expiresAt = text(value.authorization.expiresAt);
    if (expiresAt) {
      const parsed = new Date(expiresAt);
      if (Number.isNaN(parsed.getTime())) fail("authorization.expiresAt", "must be an ISO timestamp");
      else if (parsed <= now) fail("authorization.expiresAt", "approval has expired");
    }
  }

  if (!Array.isArray(value.operations) || value.operations.length === 0) {
    fail("operations", "must contain at least one non-destructive edit");
  } else {
    const ids = new Set<string>();
    value.operations.forEach((raw, index) => {
      if (!isRecord(raw)) {
        fail(`operations.${index}`, "must be an object");
        return;
      }
      const id = text(raw.id);
      const type = text(raw.type) as EditOperationType;
      if (!validId(id)) fail(`operations.${index}.id`, "must be a stable id");
      else if (ids.has(id)) fail(`operations.${index}.id`, "must be unique inside the command");
      ids.add(id);
      if (!OPERATIONS.has(type)) fail(`operations.${index}.type`, "is not an allowed edit operation");
      if (!isRecord(raw.params)) fail(`operations.${index}.params`, "must be an object");
    });
  }

  if (!isRecord(value.output)) fail("output", "is required");
  else {
    if (value.output.mode !== "preview" && value.output.mode !== "master") fail("output.mode", "must be preview or master");
    if (!Number.isInteger(value.output.width) || Number(value.output.width) < 320) fail("output.width", "must be an integer at least 320");
    if (!Number.isInteger(value.output.height) || Number(value.output.height) < 320) fail("output.height", "must be an integer at least 320");
    if (![24, 25, 30].includes(Number(value.output.fps))) fail("output.fps", "must be 24, 25, or 30");
    if (value.output.container !== "mp4" && value.output.container !== "mov") fail("output.container", "must be mp4 or mov");
  }

  if (issues.some((issue) => issue.severity === "error")) return issues;
  const command = value as unknown as EditCommand;

  for (const operation of command.operations) {
    if (!operationAuthorized(command, operation.type)) {
      fail(`operations.${operation.id}`, `approval does not grant edit:${operation.type}`);
    }
  }

  if (command.operations.some((operation) => IDENTITY_OPERATIONS.has(operation.type))) {
    if (!command.identity) fail("identity", "clone and voice identity lock is required for performance work");
    else {
      if (!text(command.identity.cloneId)) fail("identity.cloneId", "is required for performance work");
      if (!text(command.identity.voiceId)) fail("identity.voiceId", "is required for performance work");
      if (!text(command.identity.version)) fail("identity.version", "is required for performance work");
      if (!command.identity.consentRecorded) fail("identity.consentRecorded", "must be true for cloned identity work");
    }
  }

  if (command.property === "tsws" && !command.canon.version.toLowerCase().includes("tsws")) {
    fail("canon.version", "TSWS work must name a TSWS canon revision");
  }
  if (command.property === "ascension-caudex" && !command.canon.version.toLowerCase().includes("acx")) {
    fail("canon.version", "Ascension Caudex work must name an ACX canon revision");
  }
  if (command.deliverable === "micro-drama" && !command.operations.some((operation) => operation.type === "generate-full-motion")) {
    fail("operations", "micro-drama work must include full-motion generation");
  }
  if (command.output.mode === "master" && !command.operations.some((operation) => operation.type === "render-master")) {
    fail("operations", "master output must include render-master");
  }
  if (command.output.mode === "preview" && command.operations.some((operation) => operation.type === "render-master")) {
    fail("output.mode", "render-master cannot be executed as a preview");
  }

  return issues;
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

export function commandHash(command: EditCommand): string {
  return createHash("sha256").update(JSON.stringify(stable(command))).digest("hex");
}

export function revisionId(command: EditCommand): string {
  return `rev-${commandHash(command).slice(0, 20)}`;
}

export function commandNeedsRubric(command: EditCommand): boolean {
  return command.output.mode === "master" || command.operations.some((operation) => operation.type === "render-master");
}
