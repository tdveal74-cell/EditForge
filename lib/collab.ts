export type CollabRole = {
  role: string;
  access: string[];
  note: string;
};

export type EnforcedGate = {
  what: string;
  how: string;
  real: boolean;
};

export const COLLAB_ROLES: CollabRole[] = [
  { role: "Director", access: ["Review", "Rubric", "Ship"], note: "Only role that can record a ship decision." },
  { role: "Editor", access: ["Timeline", "Cuts", "Captions"], note: "Owns assembly and the caption lane." },
  { role: "Color", access: ["Grade envelope", "Notes"], note: "Grades inside the envelope; cannot widen it." },
  { role: "Sound", access: ["Hierarchy", "Stems"], note: "Realises the hierarchy, does not renegotiate it." },
  { role: "Producer", access: ["Projects", "Dailies", "Archive"], note: "Moves work through stages; no grade access." },
];

export const COLLAB_ENFORCED: EnforcedGate[] = [
  {
    what: "Access to the app",
    how: "One shared password. Everything except /login, /api/login, and /api/health is refused without a session.",
    real: true,
  },
  {
    what: "Master export",
    how: "Refused unless a rubric pass is recorded on the cut. The decision is read from the store, never from the caller.",
    real: true,
  },
  {
    what: "A roll entering a cut",
    how: "Refused unless an approval is recorded against that roll on /dailies.",
    real: true,
  },
  {
    what: "Spending money",
    how: "A billable provider submit requires credentials and authentication independently of the access gate.",
    real: true,
  },
  {
    what: "Per-role permissions",
    how: "Not enforced. One shared session means anyone through the gate can reach every surface — the roles above are a working agreement, not a check.",
    real: false,
  },
];

/** Working agreement as a file. Per-role auth is not code. */
export function buildRoleAgreement(
  roles: CollabRole[] = COLLAB_ROLES,
  enforced: EnforcedGate[] = COLLAB_ENFORCED,
): string {
  return (
    JSON.stringify(
      {
        kind: "role-agreement",
        notice:
          "Working-agreement board as a file. Per-role access is not enforced. One shared session.",
        roles,
        enforced,
      },
      null,
      2,
    ) + "\n"
  );
}
