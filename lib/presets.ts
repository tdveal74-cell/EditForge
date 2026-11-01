export type LanePreset = {
  id: string;
  name: string;
  description: string;
  restraintNotes: string[];
};

export const TSWS_PRESETS: LanePreset[] = [
  {
    id: "tsws-feature",
    name: "TSWS feature cut",
    description: "Long-form episode grade — protect mood, intentional endings.",
    restraintNotes: [
      "Subtle grade only",
      "Auren/Vespera VO hierarchy clear",
      "Still-frame hold on close",
      "No template title chrome",
    ],
  },
  {
    id: "tsws-short",
    name: "TSWS short / vertical",
    description: "Shorts/Reels from master — crop with restraint.",
    restraintNotes: [
      "No hero look",
      "Captions minimal",
      "Sound hierarchy intact after crop",
    ],
  },
  {
    id: "tqo-teach",
    name: "TQO presenter teach",
    description: "Teaching niche. Clarity over spectacle.",
    restraintNotes: [
      "Protect existing quality",
      "Intentional ending",
      "Sparse amber only if branded UI",
    ],
  },
];

/** Lane restraint as a file. Constrains grade — does not invent a look. */
export function buildPresetPack(presets: LanePreset[] = TSWS_PRESETS): string {
  return (
    JSON.stringify(
      {
        kind: "lane-preset-pack",
        notice:
          "Sample lane notes as JSON. A preset constrains the grade. It is not a live look engine and not a product LUT pack.",
        presets,
      },
      null,
      2
    ) + "\n"
  );
}
