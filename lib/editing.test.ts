import { describe, expect, it } from "vitest";
import {
  EDIT_COMMAND_SCHEMA,
  commandHash,
  revisionId,
  validateEditCommand,
  type EditCommand,
} from "./editing";

const HASH = "a".repeat(64);

function command(overrides: Partial<EditCommand> = {}): EditCommand {
  return {
    schema: EDIT_COMMAND_SCHEMA,
    commandId: "cmd-20260826-001",
    projectId: "project-tqo-001",
    cutId: "cut-tqo-001",
    property: "tqo",
    deliverable: "long-form",
    issuedBy: "DEVON",
    source: { uri: "https://media.example/source.mp4", sha256: HASH },
    identity: {
      cloneId: "tee-clone-v1",
      voiceId: "tee-voice-v1",
      version: "tee-identity-v1",
      consentRecorded: true,
    },
    canon: { version: "tqo-canon-v1", locked: true },
    authorization: {
      approvalId: "approval-001",
      approvedBy: "Tee",
      scopes: ["edit:*"],
    },
    operations: [
      { id: "op-full-motion", type: "generate-full-motion", params: {} },
      { id: "op-preview", type: "render-preview", params: {} },
    ],
    output: { mode: "preview", width: 1920, height: 1080, fps: 24, container: "mp4" },
    ...overrides,
  };
}

describe("DEVON edit command contract", () => {
  it("accepts an authorized identity-locked non-destructive command", () => {
    expect(validateEditCommand(command())).toEqual([]);
  });

  it("refuses performance work without the clone and voice lock", () => {
    const issues = validateEditCommand(command({ identity: undefined }));
    expect(issues.some((issue) => issue.field === "identity")).toBe(true);
  });

  it("refuses an operation outside the approved scope", () => {
    const value = command({
      authorization: { approvalId: "approval-001", approvedBy: "Tee", scopes: ["edit:trim"] },
    });
    expect(validateEditCommand(value).some((issue) => issue.message.includes("edit:generate-full-motion"))).toBe(true);
  });

  it("requires full motion for micro-drama work", () => {
    const value = command({
      deliverable: "micro-drama",
      operations: [{ id: "op-preview", type: "render-preview", params: {} }],
    });
    expect(validateEditCommand(value).some((issue) => issue.message.includes("full-motion"))).toBe(true);
  });

  it("keeps project canon separated", () => {
    const value = command({ property: "tsws", canon: { version: "tqo-canon-v1", locked: true } });
    expect(validateEditCommand(value).some((issue) => issue.field === "canon.version")).toBe(true);
  });

  it("derives a stable content hash and revision id", () => {
    const a = command();
    const b = { ...command(), output: { ...command().output } };
    expect(commandHash(a)).toBe(commandHash(b));
    expect(revisionId(a)).toMatch(/^rev-[a-f0-9]{20}$/);
  });
});
