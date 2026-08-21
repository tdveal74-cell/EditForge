import type {
  AssetRequirement,
  ProductionBeat,
  ProductionCharacter,
  ProductionEpisode,
  ProductionProject,
} from "./production";
import { VERTICAL_4K } from "./production";

type SeedBeat = Omit<ProductionBeat, "id" | "intent"> & {
  intent?: ProductionBeat["intent"];
};

type SeedEpisode = Omit<
  ProductionEpisode,
  "id" | "slug" | "beats" | "status" | "sourceAssetIds"
> & {
  beats: SeedBeat[];
};

const CHARACTERS: ProductionCharacter[] = [
  {
    id: "devon-rook",
    name: "Devon Rook",
    isIdentityClone: true,
    performanceDirection: "Grounded, low, restrained authority; emotional weight without announcer cadence.",
    media: {},
  },
  {
    id: "tavi",
    name: "Tavi",
    isIdentityClone: false,
    performanceDirection: "Precise, emotionally contained, never mechanical.",
    media: {},
  },
  {
    id: "orin",
    name: "Orin",
    isIdentityClone: false,
    performanceDirection: "Dry, analytical, older and more certain than Devon.",
    media: {},
  },
  {
    id: "sana",
    name: "Sana",
    isIdentityClone: false,
    performanceDirection: "Musical phrasing without sentimentality.",
    media: {},
  },
  {
    id: "jonah",
    name: "Jonah",
    isIdentityClone: false,
    performanceDirection: "Warm, immediate, human pressure against Guild procedure.",
    media: {},
  },
  {
    id: "the-second",
    name: "The Second",
    isIdentityClone: false,
    performanceDirection: "A controlled chorus resolving toward one unnervingly calm voice.",
    media: {},
  },
];

const REQUIREMENTS: AssetRequirement[] = [
  {
    id: "devon-identity-primary",
    kind: "identity-image",
    label: "Devon primary identity image",
    subjectId: "devon-rook",
    requiredFor: ["proof", "episode", "thread"],
    consentRequired: true,
  },
  {
    id: "devon-voice-primary",
    kind: "voice-reference",
    label: "Devon approved voice reference",
    subjectId: "devon-rook",
    requiredFor: ["proof", "episode", "thread"],
    consentRequired: true,
  },
  {
    id: "devon-driving-performance",
    kind: "driving-video",
    label: "Devon driving performance",
    subjectId: "devon-rook",
    requiredFor: ["proof", "episode", "thread"],
    consentRequired: true,
  },
  {
    id: "devon-consent",
    kind: "consent-record",
    label: "Devon likeness and voice consent record",
    subjectId: "devon-rook",
    requiredFor: ["proof", "episode", "thread"],
    consentRequired: false,
  },
];

const EPISODES: SeedEpisode[] = [
  {
    number: 1,
    title: "FIRST STONE",
    targetDurationSec: 90,
    artifact: "THE DAY ORIN RECRUITED HIM — CONSUMED",
    beats: [
      { startSec: 5, endSec: 15, text: "A black stone strikes once from the inside.", intent: "action" },
      { startSec: 15, endSec: 27, speaker: "ORIN", text: "Locate the breach edge. Bring nothing back." },
      { startSec: 27, endSec: 39, speaker: "DEVON", text: "It won’t wait for us to be ready." },
      { startSec: 39, endSec: 54, speaker: "MASKED FOUNDER", text: "Devon Rook. You took long enough.", intent: "reveal" },
      { startSec: 54, endSec: 69, speaker: "DEVON", text: "I know every mission after the first. I don’t remember you offering me that mark." },
      { startSec: 69, endSec: 87, speaker: "MASKED FOUNDER", text: "Ask him who laid the first stone.", intent: "reveal" },
      { startSec: 87, endSec: 90, text: "The stone answers from inside the wall.", intent: "artifact" },
    ],
  },
  {
    number: 2,
    title: "THE TOLL",
    targetDurationSec: 90,
    artifact: "THE MARK REMEMBERS WHAT DEVON CANNOT",
    beats: [
      { startSec: 5, endSec: 16, speaker: "JONAH", text: "Tell me where you got this." },
      { startSec: 16, endSec: 29, speaker: "DEVON", text: "Orin Vale recruited me. I don’t remember the day." },
      { startSec: 29, endSec: 43, speaker: "JONAH", text: "It proves my brother came back with a hole." },
      { startSec: 43, endSec: 58, text: "Every radio repeats the same stone impact.", intent: "action" },
      { startSec: 58, endSec: 72, speaker: "DEVON", text: "Testing me was your choice. Let them stare at me for it." },
      { startSec: 72, endSec: 87, text: "The recruitment mark ages decades in Orin’s hand. Something knocks back.", intent: "reveal" },
      { startSec: 87, endSec: 90, text: "The mark pulses once.", intent: "artifact" },
    ],
  },
  {
    number: 3,
    title: "THE SCAR",
    targetDurationSec: 90,
    artifact: "HIS MOTHER’S LAUGH — CONSUMED",
    beats: [
      { startSec: 5, endSec: 15, speaker: "DEVON", text: "Play it when I return." },
      { startSec: 15, endSec: 28, speaker: "ORIN", text: "Question: whom does the shard identify as Founder?" },
      { startSec: 28, endSec: 42, speaker: "TAVI", text: "Do not follow the familiar voice." },
      { startSec: 42, endSec: 57, speaker: "FOUNDER", text: "You always make me in your image." },
      { startSec: 57, endSec: 72, text: "The mask comes off. Devon’s own face looks back.", intent: "reveal" },
      { startSec: 72, endSec: 87, speaker: "DEVON", text: "Our mother. I recognize her. I don’t recognize her laugh." },
      { startSec: 87, endSec: 90, text: "The laugh is gone.", intent: "artifact" },
    ],
  },
  {
    number: 4,
    title: "NO CONCURRENCE",
    targetDurationSec: 90,
    artifact: "RECOVERED DOES NOT MEAN AUTHORITATIVE",
    beats: [
      { startSec: 5, endSec: 16, speaker: "TAVI", text: "You saw grief wearing your face." },
      { startSec: 16, endSec: 29, speaker: "DEVON", text: "Contamination shaped the witness. It didn’t invent the street." },
      { startSec: 29, endSec: 43, speaker: "SANA", text: "Binder withholds. We do not have four-role concurrence." },
      { startSec: 43, endSec: 57, speaker: "DEVON", text: "Then it is not authoritative." },
      { startSec: 57, endSec: 72, text: "Four separate notes refuse to become one chord.", intent: "action" },
      { startSec: 72, endSec: 87, speaker: "ORIN", text: "No Guild seal touched that plaque." },
      { startSec: 87, endSec: 90, text: "The fourth seal stays dark.", intent: "artifact" },
    ],
  },
  {
    number: 5,
    title: "THE NEW PLAQUE",
    targetDurationSec: 90,
    artifact: "FALSE HISTORY ACQUIRES PHYSICAL AGE",
    beats: [
      { startSec: 5, endSec: 17, text: "The plaque carries decades of corrosion that did not exist yesterday.", intent: "reveal" },
      { startSec: 17, endSec: 29, speaker: "JONAH", text: "There was no plaque." },
      { startSec: 29, endSec: 43, speaker: "CHILD’S MOTHER", text: "You were standing beside us." },
      { startSec: 43, endSec: 57, speaker: "TAVI", text: "Do not complete the image." },
      { startSec: 57, endSec: 72, speaker: "DEVON", text: "Cover the forming portrait. Leave the plaque exposed." },
      { startSec: 72, endSec: 87, speaker: "CHILD", text: "You promised to finish the city." },
      { startSec: 87, endSec: 90, text: "Rust falls upward.", intent: "artifact" },
    ],
  },
  {
    number: 6,
    title: "RESONANCE",
    targetDurationSec: 90,
    artifact: "ANSWERING THE ECHO FEEDS THE DOOR",
    beats: [
      { startSec: 5, endSec: 16, speaker: "ORIN", text: "No image. No rhythm. No reply." },
      { startSec: 16, endSec: 29, speaker: "SANA", text: "The door is thinning." },
      { startSec: 29, endSec: 43, speaker: "VOICE", text: "Please. I can’t see the street." },
      { startSec: 43, endSec: 57, speaker: "ORIN", text: "You hear bait shaped like a person." },
      { startSec: 57, endSec: 72, speaker: "DEVON", text: "We hear you. Stay at the door." },
      { startSec: 72, endSec: 87, text: "The oath rebuilds. The false door becomes solid.", intent: "reveal" },
      { startSec: 87, endSec: 90, text: "A real hinge turns.", intent: "artifact" },
    ],
  },
  {
    number: 7,
    title: "REWRITE SEAM",
    targetDurationSec: 90,
    artifact: "SIX BASELINE CIVILIANS — DISPLACED",
    beats: [
      { startSec: 5, endSec: 16, speaker: "TAVI", text: "Nobody was ever behind that door." },
      { startSec: 16, endSec: 29, speaker: "SANA", text: "If I hide the record, uncertainty becomes our lie." },
      { startSec: 29, endSec: 43, text: "FOUNDING STREET. EMPTY WALL. The crowd carries both histories.", intent: "action" },
      { startSec: 43, endSec: 57, speaker: "DEVON", text: "Fracture?" },
      { startSec: 57, endSec: 72, speaker: "SANA", text: "No. One baseline. One unauthoritative rewrite fighting it." },
      { startSec: 72, endSec: 87, text: "Exactly six civilians are pulled through. A three-stitch scar appears in Devon’s hand.", intent: "reveal" },
      { startSec: 87, endSec: 90, text: "Six monitors begin together.", intent: "artifact" },
    ],
  },
  {
    number: 8,
    title: "THE UNBUILT DOOR",
    targetDurationSec: 90,
    artifact: "SPARROW — CONSUMED",
    beats: [
      { startSec: 5, endSec: 17, speaker: "ORIN", text: "Return the six baseline civilians. One pass." },
      { startSec: 17, endSec: 29, speaker: "JONAH", text: "Use my name before you go." },
      { startSec: 29, endSec: 42, speaker: "DEVON", text: "Move, Sparrow." },
      { startSec: 42, endSec: 57, text: "SPARROW breaks into six tether charges and disappears.", intent: "action" },
      { startSec: 57, endSec: 72, speaker: "TRAPPED WOMAN", text: "East Gate. Three stitches. You bled on my coat." },
      { startSec: 72, endSec: 87, speaker: "SANA", text: "Pulse phase matches the shard." },
      { startSec: 87, endSec: 90, text: "The name Sparrow no longer lands.", intent: "artifact" },
    ],
  },
  {
    number: 9,
    title: "THE FIRST DELVER",
    targetDurationSec: 90,
    artifact: "REFUSAL IS EDITED INTO AN OATH",
    beats: [
      { startSec: 5, endSec: 17, speaker: "DEVON", text: "I did not found this city." },
      { startSec: 17, endSec: 29, speaker: "CROWD", text: "You returned to finish it." },
      { startSec: 29, endSec: 43, speaker: "DEVON", text: "I will not complete a promise I never made." },
      { startSec: 43, endSec: 57, text: "Every phone removes one word: I WILL COMPLETE A PROMISE I MADE.", intent: "reveal" },
      { startSec: 57, endSec: 72, speaker: "DEVON", text: "Put the stones down. Give it no second image." },
      { startSec: 72, endSec: 87, speaker: "JONAH", text: "Then who did we just make?" },
      { startSec: 87, endSec: 90, text: "The edited oath repeats.", intent: "artifact" },
    ],
  },
  {
    number: 10,
    title: "ANCHOR POINT",
    targetDurationSec: 90,
    artifact: "WHY DEVON FIRST TRUSTED TAVI — CONSUMED",
    beats: [
      { startSec: 5, endSec: 17, text: "The silhouette touches the tether. Devon is pulled inside.", intent: "action" },
      { startSec: 17, endSec: 29, speaker: "TAVI", text: "Involuntary entry. Confirm consent if able." },
      { startSec: 29, endSec: 42, speaker: "DEVON", text: "Consent active." },
      { startSec: 42, endSec: 57, speaker: "FOUNDER", text: "She returned your weapon when command ordered her to take it." },
      { startSec: 57, endSec: 72, speaker: "DEVON", text: "I trust the current procedure. I don’t remember why I trusted you before it." },
      { startSec: 72, endSec: 87, text: "Tavi cuts the far-side tether. The severed end crawls into the monument.", intent: "reveal" },
      { startSec: 87, endSec: 90, text: "Trust remains without its origin.", intent: "artifact" },
    ],
  },
  {
    number: 11,
    title: "EVACUATION",
    targetDurationSec: 90,
    artifact: "SIX LIVES REMAIN BOUND TO THE SHARD",
    beats: [
      { startSec: 5, endSec: 17, text: "Six pulse monitors beat in exact time with the shard.", intent: "action" },
      { startSec: 17, endSec: 29, speaker: "ORIN", text: "Break it now. Those six lines go flat." },
      { startSec: 29, endSec: 43, speaker: "SANA", text: "Dependency is proven. We do not test it on them again." },
      { startSec: 43, endSec: 57, speaker: "DEVON", text: "Use the baseline stairwell. Eight residents. One pass." },
      { startSec: 57, endSec: 72, text: "Jonah leads all eight residents down as black stone replaces the landing above.", intent: "action" },
      { startSec: 72, endSec: 87, text: "The false street doubles in height. Orin’s thumb remains above the trigger.", intent: "reveal" },
      { startSec: 87, endSec: 90, text: "All six lines hold.", intent: "artifact" },
    ],
  },
  {
    number: 12,
    title: "WHAT THE CITY CHOSE",
    targetDurationSec: 90,
    artifact: "THE MEMORY IS FALSE. THE STREET IS REAL.",
    beats: [
      { startSec: 5, endSec: 17, speaker: "ORIN", text: "Destroy now and the rewrite ends here." },
      { startSec: 17, endSec: 29, speaker: "JONAH", text: "Then she is not a rounding error." },
      { startSec: 29, endSec: 43, speaker: "DEVON", text: "The memory is not authoritative." },
      { startSec: 43, endSec: 57, speaker: "JONAH", text: "They’re not asking permission." },
      { startSec: 57, endSec: 72, text: "The crowd stops. The false street remains. Real rain crosses the seam.", intent: "reveal" },
      { startSec: 72, endSec: 84, speaker: "JONAH", text: "Then learn me again." },
      { startSec: 84, endSec: 90, speaker: "THE SECOND", text: "I need a witness.", intent: "reveal" },
    ],
  },
];

function slug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function materializeEpisode(seed: SeedEpisode): ProductionEpisode {
  return {
    id: `acx-t01-e${String(seed.number).padStart(2, "0")}`,
    number: seed.number,
    title: seed.title,
    slug: slug(seed.title),
    targetDurationSec: seed.targetDurationSec,
    artifact: seed.artifact,
    status: "script-locked",
    sourceAssetIds: [],
    beats: seed.beats.map((beat, index) => ({
      ...beat,
      id: `e${String(seed.number).padStart(2, "0")}-b${String(index + 1).padStart(2, "0")}`,
      intent: beat.intent ?? (beat.speaker ? "dialogue" : "action"),
    })),
  };
}

export function createAscensionThreadOneProject(now = new Date().toISOString()): ProductionProject {
  return {
    id: "ascension-caudex-thread-01",
    property: "ascension-caudex",
    title: "The Ascension Caudex",
    canonAuthority: "Tee",
    releasePosition: "primary",
    threadNumber: 1,
    threadTitle: "First Stone",
    releaseUnit: "complete-thread",
    proofCharacterId: "devon-rook",
    output: {
      ...VERTICAL_4K,
      episodeDurationSec: 90,
      episodeCount: 12,
    },
    characters: CHARACTERS.map((character) => ({ ...character })),
    requirements: REQUIREMENTS.map((requirement) => ({ ...requirement })),
    assets: [],
    sourceReferences: [],
    protectedReferences: [],
    episodes: EPISODES.map(materializeEpisode),
    proofGate: { status: "not-ready" },
    createdAt: now,
    updatedAt: now,
  };
}
