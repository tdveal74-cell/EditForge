export type StockItem = {
  id: string;
  kind: "music" | "sfx" | "footage";
  title: string;
  durationSec?: number;
  mood: string;
  licenseNote: string;
};

export const SAMPLE_STOCK: StockItem[] = [
  { id: "st-score-01", kind: "music", title: "Restraint bed — low pulse", durationSec: 180, mood: "calm · editorial", licenseNote: "Artlist-class: project license required" },
  { id: "st-sfx-01", kind: "sfx", title: "Soft whoosh — transition", durationSec: 2, mood: "minimal", licenseNote: "Clear for social + master" },
  { id: "st-broll-01", kind: "footage", title: "Hands · paper · window light", durationSec: 12, mood: "tactile · still", licenseNote: "Royalty stock — check exclusivity" },
];

export const STOCK_ENV = {
  artlist: "ARTLIST_API_KEY",
  epidemic: "EPIDEMIC_API_KEY",
} as const;
