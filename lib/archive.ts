export type ArchiveCheck = {
  item: string;
  why: string;
};

export const ARCHIVE_CHECKLIST: ArchiveCheck[] = [
  { item: "Master + project archive linked", why: "The master is findable from the cut, not just from a path someone remembers." },
  { item: "Proxies marked disposable or kept", why: "Nobody should have to guess whether a proxy tree is safe to delete." },
  { item: "SFX / music licenses filed", why: "License terms outlive the edit; they belong beside the master." },
  { item: "Caption SRT beside master", why: "Re-cutting later without captions means redoing the pass." },
  { item: "Rubric pass recorded on cut", why: "The ship decision is part of the record, not a memory." },
  { item: "Drive / LTO path documented", why: "3-2-1 only holds if the second and third copies are written down." },
];

export function buildArchiveChecklist(items: ArchiveCheck[] = ARCHIVE_CHECKLIST): string {
  const lines = [
    "# Archive checklist",
    "# Sample board — not a live archive. Nothing here is checked until an operator checks it.",
    "",
    ...items.map((c) => `- [ ] ${c.item}\n      ${c.why}`),
    "",
  ];
  return lines.join("\n");
}
