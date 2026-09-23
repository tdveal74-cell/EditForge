import type {
  GraphEdge,
  GraphNode,
  LibraryAsset,
  WorkflowTemplate,
} from "./types";

function n(
  partial: Omit<GraphNode, "status" | "aspectRatio"> & {
    aspectRatio?: GraphNode["aspectRatio"];
    status?: GraphNode["status"];
  },
): GraphNode {
  return {
    aspectRatio: "16:9",
    status: "idle",
    example: Boolean(partial.assetUrl),
    ...partial,
  };
}

function e(from: string, to: string): GraphEdge {
  return { id: `${from}-${to}`, from, to };
}

export const TEMPLATES: WorkflowTemplate[] = [
  {
    id: "micro-drama",
    name: "Micro Drama",
    category: "Series",
    tagline: "Two scenes. One emotional turn. A deliberate final image.",
    still: "/canvas/stills/film.webp",
    nodes: [
      n({
        id: "brief",
        kind: "prompt",
        x: 40,
        y: 80,
        title: "Episode brief",
        prompt:
          "Working example, not locked show canon. Two estranged siblings meet on a rooftop. One has brought a letter. The other refuses to open it. End with the unopened letter between them.",
        aspectRatio: "16:9",
      }),
      n({
        id: "continuity",
        kind: "style",
        x: 40,
        y: 360,
        title: "Continuity bible",
        prompt:
          "Keep the same two adult characters, charcoal coats, blue-hour rooftop, and single warm practical in both scenes. No face morphing. Maintain screen direction. Use approved character references before final production.",
      }),
      n({
        id: "s1-still",
        kind: "image",
        x: 380,
        y: 80,
        title: "Scene 1 · arrival",
        prompt:
          "Wide cinematic still. Two adult siblings in charcoal coats on a rooftop at blue hour. One warm practical. One holds an unopened letter. Quiet tension. No text or logos.",
        assetUrl: "/canvas/stills/film.webp",
        assetKind: "image",
        status: "done",
      }),
      n({
        id: "s1-voice",
        kind: "voice",
        x: 380,
        y: 420,
        title: "Scene 1 · dialogue",
        prompt: "I did not come here for an apology.",
        duration: 6,
      }),
      n({
        id: "s1-motion",
        kind: "video",
        x: 720,
        y: 80,
        title: "Scene 1 · motion",
        prompt:
          "Slow restrained push toward the two figures. The letter stays in one hand. Maintain faces, clothing, lighting and screen direction. No speech or captions.",
        duration: 6,
      }),
      n({
        id: "s2-still",
        kind: "image",
        x: 1060,
        y: 80,
        title: "Scene 2 · the choice",
        prompt:
          "Same two siblings, charcoal coats, same blue-hour rooftop and warm practical. Medium two-shot from the same screen direction. The unopened letter rests between them. No text or logos.",
      }),
      n({
        id: "s2-voice",
        kind: "voice",
        x: 1060,
        y: 420,
        title: "Scene 2 · dialogue",
        prompt: "Then stay long enough to hear the truth.",
        duration: 6,
      }),
      n({
        id: "s2-motion",
        kind: "video",
        x: 1400,
        y: 80,
        title: "Scene 2 · motion",
        prompt:
          "A tiny lateral camera move. One person places the letter between them. Keep anatomy and identities stable. Hold the final composition. No speech or captions.",
        duration: 6,
      }),
      n({
        id: "episode",
        kind: "output",
        x: 1740,
        y: 80,
        title: "Episode assembly",
        prompt:
          "Review still and motion continuity. Place dialogue above ambience and music. Assemble scenes in order. Hold the final image. Lip sync is a separate identity-approved production step. Review before master.",
      }),
    ],
    edges: [
      e("brief", "s1-still"),
      e("continuity", "s1-still"),
      e("s1-still", "s1-motion"),
      e("continuity", "s2-still"),
      e("s1-motion", "s2-still"),
      e("s2-still", "s2-motion"),
      e("s1-motion", "episode"),
      e("s2-motion", "episode"),
      e("s1-voice", "episode"),
      e("s2-voice", "episode"),
    ],
  },
  {
    id: "film",
    name: "Film stills",
    tagline: "Three restrained scene plates that can cut together.",
    still: "/canvas/stills/film.webp",
    category: "Film",
    nodes: [
      n({
        id: "p1",
        kind: "prompt",
        x: 60,
        y: 200,
        title: "Brief",
        prompt:
          "Two figures on a rooftop at blue hour. One warm practical. Anamorphic. Hold the stillness. No stylized grade.",
      }),
      n({
        id: "i1",
        kind: "image",
        x: 420,
        y: 40,
        title: "Wide",
        prompt:
          "Photoreal wide cinematic still, two silhouettes on a concrete rooftop at dusk, city bokeh, one warm practical lamp, 35mm grain, restrained color, no text.",
        status: "done",
        assetUrl: "/canvas/stills/film.webp",
        assetKind: "image",
      }),
      n({
        id: "i2",
        kind: "image",
        x: 420,
        y: 360,
        title: "Street",
        prompt:
          "Photoreal cinematic still, rain-soaked night street, figure in a long coat, teal neon and tungsten windows, wet asphalt, no text.",
        status: "done",
        assetUrl: "/canvas/stills/cinematic.webp",
        assetKind: "image",
      }),
      n({
        id: "v1",
        kind: "video",
        x: 760,
        y: 40,
        title: "Motion",
        prompt:
          "Slow push in. Almost no camera shake. Hold the strongest beat.",
      }),
      n({
        id: "o1",
        kind: "output",
        x: 760,
        y: 360,
        title: "Cut",
        prompt: "Assemble plates. Still-frame hold on the last shot.",
      }),
    ],
    edges: [
      e("p1", "i1"),
      e("p1", "i2"),
      e("i1", "v1"),
      e("i1", "o1"),
      e("i2", "o1"),
    ],
  },
  {
    id: "ugc",
    name: "User-generated",
    tagline: "Apartment light. Product in hand. Nothing performed.",
    still: "/canvas/stills/ugc.webp",
    category: "UGC",
    nodes: [
      n({
        id: "p1",
        kind: "prompt",
        x: 60,
        y: 160,
        title: "Brief",
        prompt:
          "Soft window light. Serum bottle in hand. Authentic, unstyled, no hard sell.",
      }),
      n({
        id: "i1",
        kind: "image",
        x: 420,
        y: 140,
        title: "Talking",
        prompt:
          "Photoreal UGC still, young woman in a sunlit apartment holding a frosted glass serum bottle to camera, plants behind, natural window light, no text.",
        status: "done",
        assetUrl: "/canvas/stills/ugc.webp",
        assetKind: "image",
      }),
      n({
        id: "v1",
        kind: "video",
        x: 760,
        y: 140,
        title: "Motion",
        prompt: "Slight handheld drift. Keep her eyes. Do not add captions.",
      }),
      n({
        id: "o1",
        kind: "output",
        x: 1100,
        y: 140,
        title: "Cut",
        prompt: "End on a still of the bottle. Logo last.",
      }),
    ],
    edges: [e("p1", "i1"), e("i1", "v1"), e("v1", "o1")],
  },
  {
    id: "talent",
    name: "On-camera talent",
    tagline: "One look. Same light. Carry her across platforms.",
    still: "/canvas/stills/talent.webp",
    category: "Talent",
    nodes: [
      n({
        id: "s1",
        kind: "style",
        x: 60,
        y: 80,
        title: "Look",
        prompt:
          "North light. Charcoal silk. Silver jewelry. 85mm. Ivory and charcoal only.",
      }),
      n({
        id: "p1",
        kind: "prompt",
        x: 60,
        y: 260,
        title: "Brief",
        prompt: "Editorial portrait. Quiet. No fashion-campaign gloss.",
      }),
      n({
        id: "i1",
        kind: "image",
        x: 420,
        y: 160,
        title: "Portrait",
        prompt:
          "Photoreal fashion editorial portrait, sculpted silver jewelry, charcoal silk blouse, soft north light, 85mm, muted ivory and charcoal, no text.",
        status: "done",
        assetUrl: "/canvas/stills/talent.webp",
        assetKind: "image",
      }),
      n({
        id: "o1",
        kind: "output",
        x: 760,
        y: 160,
        title: "Cut",
        prompt: "Hold the eyes. Title only if needed.",
      }),
    ],
    edges: [e("s1", "i1"), e("p1", "i1"), e("i1", "o1")],
  },
  {
    id: "youtube",
    name: "YouTube desk",
    tagline:
      "Warm practicals. Camera in frame. Thumbnail that is a still, not a poster.",
    still: "/canvas/stills/youtube.webp",
    category: "YouTube",
    nodes: [
      n({
        id: "p1",
        kind: "prompt",
        x: 60,
        y: 160,
        title: "Brief",
        prompt:
          "Creator at a dark oak desk. Two lamps. Cinema camera. No UI on screens.",
      }),
      n({
        id: "i1",
        kind: "image",
        x: 420,
        y: 160,
        title: "Desk still",
        prompt:
          "Photoreal creator studio still, filmmaker at a dark oak desk with a cinema camera and condenser microphone, two warm practical lamps, cinematic grade, no readable text.",
        status: "done",
        assetUrl: "/canvas/stills/youtube.webp",
        assetKind: "image",
      }),
      n({
        id: "o1",
        kind: "output",
        x: 760,
        y: 160,
        title: "Cut",
        prompt: "Thumbnail is a crop of the still. No word salad.",
      }),
    ],
    edges: [e("p1", "i1"), e("i1", "o1")],
  },
  {
    id: "product",
    name: "Product catalog",
    tagline: "Wet stone. Side light. Texture in the highlights.",
    still: "/canvas/stills/product.webp",
    category: "Product",
    nodes: [
      n({
        id: "p1",
        kind: "prompt",
        x: 60,
        y: 160,
        title: "Brief",
        prompt:
          "Faceted glass bottle on wet black stone. Dramatic side light. No sparkle bloom.",
      }),
      n({
        id: "i1",
        kind: "image",
        x: 420,
        y: 160,
        title: "Hero",
        prompt:
          "Photoreal luxury product photograph, faceted glass perfume bottle on wet black stone, dramatic side light, water droplets, muted charcoal, no text.",
        status: "done",
        assetUrl: "/canvas/stills/product.webp",
        assetKind: "image",
      }),
      n({
        id: "v1",
        kind: "video",
        x: 760,
        y: 160,
        title: "Motion",
        prompt: "Slow orbit. Keep highlights textured. No lens flare.",
      }),
      n({
        id: "o1",
        kind: "output",
        x: 1100,
        y: 160,
        title: "Cut",
        prompt: "Still-frame hold on the bottle. Logo after fade.",
      }),
    ],
    edges: [e("p1", "i1"), e("i1", "v1"), e("v1", "o1")],
  },
  {
    id: "social",
    name: "Social plate",
    tagline: "Golden hour walk. One frame that can crop to 9:16.",
    still: "/canvas/stills/social.webp",
    category: "Social",
    nodes: [
      n({
        id: "p1",
        kind: "prompt",
        x: 60,
        y: 160,
        title: "Brief",
        prompt: "Street, golden hour, charcoal coat. Quiet. Not a campaign.",
        aspectRatio: "9:16",
      }),
      n({
        id: "i1",
        kind: "image",
        x: 420,
        y: 140,
        title: "Walk",
        prompt:
          "Photoreal social fashion still, golden hour sidewalk, woman in a tailored charcoal coat walking toward camera, sun flare, shallow depth, no text.",
        aspectRatio: "16:9",
        status: "done",
        assetUrl: "/canvas/stills/social.webp",
        assetKind: "image",
      }),
      n({
        id: "o1",
        kind: "output",
        x: 760,
        y: 160,
        title: "Cut",
        prompt: "Crop to 9:16. Hold the walk. No captions.",
      }),
    ],
    edges: [e("p1", "i1"), e("i1", "o1")],
  },
];

export function templateById(id: string): WorkflowTemplate {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}

export function assetsFromTemplate(t: WorkflowTemplate) {
  return t.nodes
    .filter((n) => n.assetUrl)
    .map((n) => ({
      id: `asset-${n.id}`,
      url: n.assetUrl!,
      kind: (n.assetKind ?? "image") as "image" | "video" | "audio",
      prompt: n.prompt,
      createdAt: Date.now(),
      aspectRatio: n.aspectRatio,
      title: n.title,
    }));
}

export function clipsFromTemplate(t: WorkflowTemplate) {
  return t.nodes
    .filter((n) => n.kind === "image" && n.assetUrl)
    .map((n) => ({
      id: `clip-${n.id}`,
      assetId: `asset-${n.id}`,
      duration: 2.4,
      label: n.title,
    }));
}

/** Walkable house collection. Ids are namespaced so they never collide across workflows. */
export function houseRoll(): LibraryAsset[] {
  return TEMPLATES.flatMap((t) =>
    t.nodes
      .filter((n) => n.assetUrl)
      .map((n) => ({
        id: `house-${t.id}-${n.id}`,
        url: n.assetUrl!,
        kind: (n.assetKind ?? "image") as "image" | "video" | "audio",
        prompt: n.prompt,
        createdAt: 0,
        aspectRatio: n.aspectRatio,
        title: n.title,
      })),
  );
}

export function platesForRoll(projectAssets: LibraryAsset[]): LibraryAsset[] {
  const seen = new Set<string>();
  const out: LibraryAsset[] = [];
  for (const a of [...projectAssets, ...houseRoll()]) {
    if (seen.has(a.url)) continue;
    seen.add(a.url);
    out.push(a);
  }
  return out;
}
