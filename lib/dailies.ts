import { durableCollection } from "./durable";

/**
 * Day rolls and the review decision on each.
 *
 * /dailies said "select, note, approve before assembly. Nothing enters the cut
 * unreviewed." It was a static list, so the sentence was a caption: there was no
 * decision to record and nothing to stop an unreviewed roll being cut.
 *
 * The decision lives here, and `selectForCut` is the gate that enforces it. Like
 * the rubric gate on export, the decision is read from the store — a caller
 * cannot approve a roll by asserting it is approved.
 */

export type RollStatus = "ingest" | "review" | "approved" | "rejected";

export type Roll = {
  id: string;
  day: string;
  camera: string;
  scenes: string;
  notes: string;
  status: RollStatus;
  /** Why the reviewer decided what they decided. */
  reviewNote?: string;
  reviewedAt?: string;
  /** The cut this roll has been selected into, once it is approved. */
  selectedForCutId?: string;
  selectedAt?: string;
};

function seedRolls(): Roll[] {
  return [
    { id: "d-0811-a", day: "2026-08-11", camera: "A-cam", scenes: "1A–1C", notes: "Cold open plates", status: "review" },
    { id: "d-0811-b", day: "2026-08-11", camera: "B-cam", scenes: "1B", notes: "Insert hands", status: "ingest" },
    { id: "d-0810-a", day: "2026-08-10", camera: "A-cam", scenes: "2A", notes: "Oracle walk", status: "approved" },
  ];
}

const rolls = durableCollection<Roll>({
  key: "editforge:dailies",
  file: "dailies.json",
  seed: seedRolls,
});

export async function listRolls(): Promise<Roll[]> {
  return rolls.list();
}

export async function getRoll(id: string): Promise<Roll | null> {
  return rolls.get(id);
}

/**
 * Record a review decision.
 *
 * A rejection may carry a note and so may an approval; neither is required,
 * because forcing a note produces "ok" rather than a reason.
 */
export async function reviewRoll(
  id: string,
  decision: "approve" | "reject",
  note?: string
): Promise<Roll | null> {
  let updated: Roll | null = null;
  await rolls.mutate((all) => {
    const roll = all.find((r) => r.id === id);
    if (!roll) return;
    roll.status = decision === "approve" ? "approved" : "rejected";
    roll.reviewNote = note?.trim() || undefined;
    roll.reviewedAt = new Date().toISOString();
    // A roll pulled back to rejected must not stay in a cut it was let into.
    if (decision === "reject") {
      roll.selectedForCutId = undefined;
      roll.selectedAt = undefined;
    }
    updated = roll;
  });
  return updated;
}

export type SelectResult =
  | { ok: true; roll: Roll }
  | { ok: false; reason: string; status?: RollStatus };

/**
 * Put a roll into a cut — the one place "nothing enters the cut unreviewed" is
 * either true or false. It reads the recorded status; it does not ask.
 */
export async function selectForCut(id: string, cutId: string): Promise<SelectResult> {
  const roll = await getRoll(id);
  if (!roll) return { ok: false, reason: `No roll "${id}"` };

  if (roll.status !== "approved") {
    return {
      ok: false,
      status: roll.status,
      reason:
        roll.status === "rejected"
          ? `"${roll.id}" was rejected in review — it cannot enter a cut`
          : `"${roll.id}" has no recorded approval — review it before it enters a cut`,
    };
  }

  let updated: Roll | null = null;
  await rolls.mutate((all) => {
    const target = all.find((r) => r.id === id);
    if (!target) return;
    target.selectedForCutId = cutId;
    target.selectedAt = new Date().toISOString();
    updated = target;
  });

  return updated ? { ok: true, roll: updated } : { ok: false, reason: `No roll "${id}"` };
}

/** Rolls that have been let into a given cut. */
export async function rollsForCut(cutId: string): Promise<Roll[]> {
  const all = await rolls.list();
  return all.filter((r) => r.selectedForCutId === cutId);
}
