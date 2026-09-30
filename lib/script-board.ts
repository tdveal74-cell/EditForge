export type ScriptBeat = {
  scene: string;
  slug: string;
  note: string;
  marks: string[];
};

export function newScriptBeat(): ScriptBeat {
  return { scene: "", slug: "", note: "", marks: [] };
}

export const SAMPLE_BEATS: ScriptBeat[] = [
  {
    scene: "1A",
    slug: "COLD OPEN — SHARED SHADOW",
    note: "Environment establishes first. No rush to dialogue.",
    marks: ["Establish"],
  },
  { scene: "1B", slug: "QUESTION", note: "Auren asks. Hold on silence.", marks: ["VO", "Hold"] },
  { scene: "2A", slug: "ORACLE WALK", note: "Still-frame eligible at end of beat.", marks: ["Still hold"] },
];

export function buildScriptBoard(beats: ScriptBeat[] = SAMPLE_BEATS): string {
  return (
    JSON.stringify(
      {
        kind: "script-board",
        notice: "Sample continuity beats. Not a screenplay tool and not a live script.",
        beats,
      },
      null,
      2
    ) + "\n"
  );
}
