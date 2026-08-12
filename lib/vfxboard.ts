import { durableCollection } from "./durable";
import type { ShotStatus, VfxShot } from "./vfxShot";

/**
 * The VFX shot board.
 *
 * /vfx called itself a tracker while holding three hardcoded shots whose status
 * could never change — a tracker that cannot track. Shots live here now, status
 * moves are recorded, and /vfx-engine's shot package carries the board state so
 * a compositor opening the package knows what is already in progress.
 */


function seedShots(): VfxShot[] {
  const now = new Date().toISOString();
  return [
    { id: "VFX_010", desc: "Shadow realm establish", status: "todo", engine: "Fusion / AE external", cutId: "cut-01", updatedAt: now },
    { id: "VFX_020", desc: "Subtle particulate", status: "wip", engine: "Fusion / AE external", cutId: "cut-01", updatedAt: now },
    { id: "VFX_030", desc: "End still enhancement", status: "hold", engine: "Restraint only", cutId: "cut-01", updatedAt: now },
  ];
}

const shots = durableCollection<VfxShot>({
  key: "editforge:vfx",
  file: "vfx.json",
  seed: seedShots,
});

export async function listShots(): Promise<VfxShot[]> {
  return shots.list();
}

export async function shotsForCut(cutId: string): Promise<VfxShot[]> {
  const all = await shots.list();
  return all.filter((s) => s.cutId === cutId);
}

export async function setShotStatus(
  id: string,
  status: ShotStatus,
  note?: string
): Promise<VfxShot | null> {
  let updated: VfxShot | null = null;
  await shots.mutate((all) => {
    const shot = all.find((s) => s.id === id);
    if (!shot) return;
    shot.status = status;
    if (note !== undefined) shot.note = note.trim() || undefined;
    shot.updatedAt = new Date().toISOString();
    updated = shot;
  });
  return updated;
}

export type AddShotResult = { ok: true; shot: VfxShot } | { ok: false; reason: string };

/**
 * Add a shot to the board.
 *
 * Ids are the conform key between the board, the shot package, and whatever the
 * compositor names their file — so a duplicate is refused rather than silently
 * merged into the existing one.
 */
export async function addShot(input: {
  id: string;
  desc: string;
  engine: string;
  cutId?: string;
}): Promise<AddShotResult> {
  const id = input.id.trim().toUpperCase();
  if (!id) return { ok: false, reason: "A shot needs an id" };
  if (!input.desc.trim()) return { ok: false, reason: "A shot needs a description" };

  const existing = await shots.get(id);
  if (existing) return { ok: false, reason: `Shot "${id}" is already on the board` };

  const shot: VfxShot = {
    id,
    desc: input.desc.trim(),
    status: "todo",
    engine: input.engine.trim() || "Fusion / AE external",
    cutId: input.cutId?.trim() || undefined,
    updatedAt: new Date().toISOString(),
  };

  let raced = false;
  await shots.mutate((all) => {
    // Re-check inside the atomic section: two adds of the same id can both pass
    // the read above, and the board's ids are supposed to be unique.
    if (all.some((s) => s.id === id)) {
      raced = true;
      return;
    }
    all.push(shot);
  });

  return raced ? { ok: false, reason: `Shot "${id}" is already on the board` } : { ok: true, shot };
}
