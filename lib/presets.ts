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
