import type {
  CanonicalSourceReference,
  ProductionCharacter,
  ProductionProject,
  ProtectedCanonReference,
} from "./production";
import { VERTICAL_4K } from "./production";

export const TSWS_GROK_VISUALS_FOLDER = {
  id: "1F0DnCbnG1PfrAj2BZsNklRKcXhs7J1lb",
  url: "https://drive.google.com/drive/folders/1F0DnCbnG1PfrAj2BZsNklRKcXhs7J1lb",
  label: "grok visuals",
} as const;

const SOURCE_REFERENCES: CanonicalSourceReference[] = [
  [1, "1XEvfh3koTkc5C7u92Y4xXarNvpiw_JFh", "tsws_c47433dd.mp4", 340369, 6.042, 720, 1280, "2026-08-20T06:07:55.014Z"],
  [2, "1djD2nPQSByblywQ44PHfH-a0ZSCDX_L-", "tsws_6a70ac78.mp4", 418609, 6.042, 720, 1280, "2026-08-20T06:08:14.796Z"],
  [3, "1fx-U2EjEE9XQwvM0Fd9yZ6ulbmKeeHgA", "tsws_005ba973.mp4", 427545, 9.25, 1080, 1920, "2026-08-20T06:08:18.035Z"],
  [4, "1Hej0sOtvZb3XF8Bd5me50rwek2C4yftw", "tsws_536eb840.mp4", 436280, 6.042, 720, 1280, "2026-08-20T06:08:21.220Z"],
  [5, "196d1eKHRY9DGPA9jOg-zrexFL-vPLVuc", "tsws_30949e11.mp4", 463767, 6.042, 720, 1280, "2026-08-20T06:08:24.220Z"],
  [6, "1vmWkbWAXhuTJyEYhznHZ0T_rsf0_uR7H", "tsws_73df8c86.mp4", 519458, 6.042, 720, 1280, "2026-08-20T06:08:32.884Z"],
  [7, "1PqPik7YU4L4zVtdqGnU8FGMsLzhVzl0o", "tsws_6064fa3a.mp4", 565471, 6.042, 720, 1280, "2026-08-20T06:08:36.064Z"],
  [8, "1DMMT4ZlRJs9y4g4LMN9DM4PqGfbflg1O", "tsws_1733c79c.mp4", 672835, 6.042, 720, 1280, "2026-08-20T06:08:39.586Z"],
  [9, "1Cq5NeHppk1MAg79rsa-6yz4JCPor15I5", "tsws_b1c51ba0.mp4", 794164, 6.042, 720, 1280, "2026-08-20T06:08:41.428Z"],
  [10, "1lSbqJiCA9LdbVfoUzTl_fxAP1FNSQO3h", "tsws_0194b3c6.mp4", 861289, 20.583, 1080, 1920, "2026-08-20T06:08:46.584Z"],
  [11, "1lmRjAuIWA0JUHV3QtfC_G-CCaMpXh4By", "tsws_94e9a62a.mp4", 991451, 6.042, 720, 1280, "2026-08-20T06:08:48.245Z"],
  [12, "1il8L029BzT040ucDbt35omtzAEHt6TOS", "tsws_6cb22ef3.mp4", 1024644, 6.042, 720, 1280, "2026-08-20T06:08:49.997Z"],
  [13, "1Zl8C8VXKLqqIyCTqwNuyARPVFyWervpD", "tsws_20ab7461.mp4", 1106648, 6.042, 720, 1280, "2026-08-20T06:08:53.903Z"],
  [14, "1cw1LXFIWrug8wMtD0ZNTg-HvlbPxglDv", "tsws_9c054486.mp4", 1119187, 6.042, 720, 1280, "2026-08-20T06:08:57.483Z"],
  [15, "1_rGbn2n0RRyj0HZyP8zky3m-Cw_bMoAT", "tsws_4638f8ba.mp4", 1132300, 6.042, 720, 1280, "2026-08-20T06:09:02.426Z"],
  [16, "141YlKBzas2QYOHnBp7jGr1ByxwOqDPT-", "tsws_e37e08ac.mp4", 1433374, 6.042, 720, 1280, "2026-08-20T06:09:04.875Z"],
  [17, "1mMsGX5mdW7gijWu_OlXjpUjmLKIh3Jco", "tsws_be3a1735.mp4", 1501484, 6.042, 720, 1280, "2026-08-20T06:09:07.020Z"],
  [18, "1FqjPWR-K-stRb0tcazE_XDhOZ73zq6qQ", "tsws_eabc5d81.mp4", 1687783, 6.042, 720, 1280, "2026-08-20T06:09:11.262Z"],
  [19, "1_GAi5P_HqXnQUSlTlbcqBM-bq8zFfPeh", "tsws_59e058cf.mp4", 1717199, 10.042, 720, 1280, "2026-08-20T06:09:13.224Z"],
  [20, "1NlO5uep_dzHoVfXJ-yqYuiVqavt-oVQx", "tsws_c7bd7e86.mp4", 2412417, 10.042, 720, 1280, "2026-08-20T06:09:18.052Z"],
  [21, "19x2wnkLkX8yGelSuPUVhYsnyQ_98AAQk", "tsws_ef6b8d5f.mp4", 2429047, 10.042, 720, 1280, "2026-08-20T06:09:20.629Z"],
  [22, "1r3l2MflIktx4XVd0CTPjuYxLl0i65XNZ", "tsws_f20b855d.mp4", 2465340, 10.042, 720, 1280, "2026-08-20T06:09:24.973Z"],
  [23, "12aADvDOrseCA5dc8hONp3wVOv_IbLAtv", "tsws_c72f1e75.mp4", 2677641, 6.042, 400, 736, "2026-08-20T06:09:32.065Z"],
  [24, "1Cc_EWFIT8si6dj4K8NQlQR6tBn972lF4", "tsws_27ad1789.mp4", 2829824, 10.042, 720, 1280, "2026-08-20T06:09:41.590Z"],
  [25, "1A8sXd6i1TwAbLjz9DpDh6VIwb4P7nhxS", "tsws_e8466435.mp4", 2845308, 6.042, 720, 1280, "2026-08-20T06:09:50.077Z"],
  [26, "1YFB7Yrt8SqtL85P6G06nuTUfDi3vEvJO", "tsws_20433200.mp4", 3533491, 10.042, 720, 1280, "2026-08-20T06:09:55.005Z"],
  [27, "1j7yRxEANDNTWHpJLnc4WW-aW2t8M9sf1", "tsws_1cc5ff23.mp4", 4020651, 6.042, 720, 1280, "2026-08-20T06:10:07.819Z"],
  [28, "17BdgeyH5pwLj2qxc0llDxZmv5pXapB5A", "tsws_07bc1738.mp4", 5759345, 6.042, 720, 1280, "2026-08-20T06:10:45.839Z"],
  [29, "1phUzIJXqY0PNf-8VyAQmXb5cyNPN81tn", "tsws_2388dd38.mp4", 17807832, 72.25, 1080, 1920, "2026-08-20T06:11:05.727Z"],
].map(([order, externalId, label, bytes, durationSec, width, height, createdAt]) => ({
  id: `tsws-grok-${String(order).padStart(2, "0")}`,
  provider: "google-drive" as const,
  externalId: String(externalId),
  url: `https://drive.google.com/file/d/${externalId}/view?usp=drivesdk`,
  label: String(label),
  mimeType: "video/mp4",
  bytes: Number(bytes),
  durationSec: Number(durationSec),
  width: Number(width),
  height: Number(height),
  order: Number(order),
  role: Number(order) === 29 ? "completed-cut" as const : "source-clip" as const,
  createdAt: String(createdAt),
}));

const PROTECTED_REFERENCES: ProtectedCanonReference[] = [
  {
    id: "tsws-longform-season-one-package",
    provider: "google-drive",
    externalId: "1YaPQ5N5rxKcjzO8cO0lrByC6aSZ57Ms3",
    url: "https://drive.google.com/file/d/1YaPQ5N5rxKcjzO8cO0lrByC6aSZ57Ms3/view?usp=drivesdk",
    label: "TSWS_Season_One_Complete_Package.zip",
    reason: "Protected TSWS long-form source. It is reference-only and cannot be imported, adapted, overwritten, or included in the Microdrama render lane.",
  },
];

const CHARACTERS: ProductionCharacter[] = [
  {
    id: "auren",
    name: "Auren",
    isIdentityClone: false,
    performanceDirection: "Use only Tee-approved Auren performance references and direction.",
    media: {},
  },
  {
    id: "vespera",
    name: "Vespera",
    isIdentityClone: false,
    performanceDirection: "Use only Tee-approved Vespera performance references and direction.",
    media: {},
  },
];

export function createTswsMicrodramaProject(now = new Date().toISOString()): ProductionProject {
  return {
    id: "tsws-microdrama-01",
    property: "tsws-microdrama",
    title: "TSWS",
    canonAuthority: "Tee",
    releasePosition: "before-long-form",
    threadNumber: 1,
    threadTitle: "Microdrama 01",
    releaseUnit: "complete-microdrama",
    proofCharacterId: "auren",
    productionNotes: [
      "The TSWS Microdrama releases before the long-form videos.",
      "The Grok Visuals loose MP4s are the creator-authored Microdrama visual source set.",
      "The TSWS Season One long-form package is protected and remains untouched.",
    ],
    output: {
      ...VERTICAL_4K,
      episodeDurationSec: 72.25,
      episodeCount: 1,
    },
    characters: CHARACTERS.map((character) => ({ ...character, media: { ...character.media } })),
    requirements: [],
    assets: [],
    sourceReferences: SOURCE_REFERENCES.map((reference) => ({ ...reference })),
    protectedReferences: PROTECTED_REFERENCES.map((reference) => ({ ...reference })),
    episodes: [
      {
        id: "tsws-microdrama-01",
        number: 1,
        title: "TSWS MICRODRAMA 01",
        slug: "tsws-microdrama-01",
        targetDurationSec: 72.25,
        artifact: "TEE-AUTHORED GROK VISUALS CUT",
        status: "script-locked",
        sourceAssetIds: [],
        beats: [
          {
            id: "tsws-m01-b01",
            startSec: 0,
            endSec: 72.25,
            text: "Preserve the creator-authored Auren/Vespera cut, gold-thread continuity, mirror imagery, sound, and TSWS end card unless Tee issues a revision.",
            intent: "artifact",
          },
        ],
      },
    ],
    proofGate: {
      status: "accepted",
      acceptedAt: now,
      reviewer: "Tee",
      notes: "Creator-authored Grok Visuals cut is the accepted Microdrama identity and continuity proof.",
    },
    createdAt: now,
    updatedAt: now,
  };
}
