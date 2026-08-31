/**
 * What a VFX shot *is*, separate from the board that stores it.
 *
 * Same reason as lib/asset.ts: /vfx renders the status ladder as buttons, and
 * importing that ladder from the store module would pull `fs` into the client
 * bundle.
 */

export const SHOT_STATUSES = ["todo", "wip", "review", "done", "hold"] as const;
export type ShotStatus = (typeof SHOT_STATUSES)[number];

export function isShotStatus(v: string): v is ShotStatus {
  return (SHOT_STATUSES as readonly string[]).includes(v);
}

export type VfxShot = {
  id: string;
  desc: string;
  status: ShotStatus;
  engine: string;
  /** The cut this shot belongs to. Unassigned shots sit on the board unfiled. */
  cutId?: string;
  note?: string;
  updatedAt: string;
};

/** Shot tracker as a file. Not Fusion, not a compositor. */
export function buildVfxBoardFile(shots: VfxShot[]): string {
  return (
    JSON.stringify(
      {
        kind: "vfx-shot-board",
        notice:
          "Shot tracker as a file. Not Fusion, not After Effects, not a compositor. Heavy comp stays external.",
        shots: shots.map((s) => ({
          id: s.id,
          desc: s.desc,
          status: s.status,
          engine: s.engine,
          cutId: s.cutId,
          note: s.note,
        })),
      },
      null,
      2,
    ) + "\n"
  );
}
