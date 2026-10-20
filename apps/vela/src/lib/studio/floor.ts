export type FloorSeat = "floor" | "script" | "cut" | "board" | "stage" | "score";

export interface FloorStep {
  seat: Exclude<FloorSeat, "floor">;
  grant: string;
}

export interface FloorMark {
  id: string;
  seat: FloorSeat;
  grant: string;
  yielded: boolean;
  note: string;
}

const REBUILD: FloorStep[] = [
  { seat: "script", grant: "Set the scene headings." },
  { seat: "cut", grant: "Rebuild the picture track." },
  { seat: "script", grant: "Pull captions from the dialogue." },
  { seat: "board", grant: "Pull beats onto the board." },
];

export function planFloor(order: string): FloorStep[] {
  const text = order.trim().toLowerCase();
  if (!text) return [];
  if (/\brebuild\b|whole piece|from the script/.test(text)) return REBUILD;
  const steps: FloorStep[] = [];
  if (/tighten|filler|clean/.test(text)) steps.push({ seat: "script", grant: "Lift filler from the script." });
  if (/caption|dialogue/.test(text)) steps.push({ seat: "script", grant: "Pull captions from the dialogue." });
  if (/board|beat/.test(text)) steps.push({ seat: "board", grant: "Pull beats onto the board." });
  if (/shot|stage|block/.test(text)) steps.push({ seat: "stage", grant: "Send the blocked shot to the cut." });
  if (/score|music|loop/.test(text)) steps.push({ seat: "score", grant: "Drop the score loop on the cut." });
  return steps;
}
