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
 *
 * The check runs INSIDE the atomic section, against the copy that is about to be
 * written. Checking first and writing after leaves a window where a reviewer
 * rejects the roll between the two, and the write lands anyway — the gate
 * failing precisely when two people are working at once, which is the only time
 * it is under any pressure.
 */
export async function selectForCut(id: string, cutId: string): Promise<SelectResult> {
  let refusal: SelectResult | null = null;
  let updated: Roll | null = null;

  await rolls.mutate((all) => {
    // Reset per attempt: mutate may re-run the callback on a concurrent-write
    // retry, and a refusal recorded on a stale read must not survive into it.
    refusal = null;
    updated = null;

    const roll = all.find((r) => r.id === id);
    if (!roll) {
      refusal = { ok: false, reason: `No roll "${id}"` };
      return;
    }

    if (roll.status !== "approved") {
      refusal = {
        ok: false,
        status: roll.status,
        reason:
          roll.status === "rejected"
            ? `"${roll.id}" was rejected in review — it cannot enter a cut`
            : `"${roll.id}" has no recorded approval — review it before it enters a cut`,
      };
      return;
    }

    roll.selectedForCutId = cutId;
    roll.selectedAt = new Date().toISOString();
    updated = roll;
  });

  if (refusal) return refusal;
  return updated ? { ok: true, roll: updated } : { ok: false, reason: `No roll "${id}"` };
}

/** Rolls that have been let into a given cut. */
export async function rollsForCut(cutId: string): Promise<Roll[]> {
  const all = await rolls.list();
  return all.filter((r) => r.selectedForCutId === cutId);
}
