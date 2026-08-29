/**
 * Masters that live in Drive, not in this repo.
 *
 * `mediaLibrary` is the studio's *on-disk* media: every entry there is a file
 * under `public/`, and its test asserts exactly that. This file is the other
 * half — footage and voice the studio owns that is too large to carry in the
 * repo but that the control plane still has to be able to name, count and point
 * at. Without it the studio's own record of its masters is a Drive folder a
 * human has to open, which is how a show ends up with twenty-nine clips nobody
 * can account for.
 *
 * Every id here is a Google Drive file id, recorded against the byte size Drive
 * reports. The size is not decoration: it is the only identity check available
 * over the connector lane, and it is what let the two TSWS clips below be
 * matched to the masters already sitting in `public/media`.
 */

export type DriveMaster = {
  /** Google Drive file id. */
  fileId: string;
  /** Filename as it sits in Drive. */
  name: string;
  /** Byte size Drive reports. The identity check, not a display field. */
  bytes: number;
};

/* -------------------------------------------------------------------------- */
/* Ascension Caudex — Node 01 voice                                            */
/* -------------------------------------------------------------------------- */

/**
 * How the durations below were established.
 *
 * The lines are ElevenLabs renders and carry a C2PA content-credentials
 * manifest, which is large and — being a fixed certificate chain with fixed
 * padding — the same size in every file. That matters because it means byte
 * size does *not* track runtime on its own: a third of the smallest line is
 * provenance metadata, not audio.
 *
 * L07 was pulled down and read. Its Xing/Info header declares 42 frames and a
 * 17,971-byte stream; its C2PA hash assertion excludes bytes 87..16,648. Three
 * numbers that agree: 42 frames x 1152 samples / 44,100 Hz = 1.097s, and
 * (17,971 - 417 header frame) / 1.097s = 16,000 bytes/s, which is 128 kbit/s
 * constant bitrate. So every file is `mp3_44100_128` with 17,065 bytes of
 * non-audio overhead, and runtime follows from size alone.
 *
 * The check that this holds across the set: L06 and L09 are byte-identical at
 * 81,012 bytes. Two separately generated lines landing on the same size is what
 * constant bitrate plus constant overhead predicts, and nothing else does.
 *
 * All eleven have since been pulled through the connector and decoded, and the
 * model held: every file came down at exactly the byte count recorded below,
 * and every decoded runtime matched its predicted one to the two decimal places
 * a container reports. `MEASURED_SEC` carries those readings, and the test
 * checks the formula against them rather than against the one header it was
 * originally derived from — the difference being that a wrong constant now has
 * eleven chances to show up instead of one.
 */
const OVERHEAD_BYTES = 17_065;
const BYTES_PER_SECOND = 16_000;

/** Runtime of an ElevenLabs `mp3_44100_128` line, from its size on disk. */
export function voiceLineSeconds(bytes: number): number {
  return Math.round(((bytes - OVERHEAD_BYTES) / BYTES_PER_SECOND) * 1000) / 1000;
}

export type VoiceLine = DriveMaster & {
  /** Read order. L01 is the first line of the episode. */
  line: number;
  /** Derived — see the note above. */
  durationSec: number;
};

function voiceLine(line: number, name: string, fileId: string, bytes: number): VoiceLine {
  return { line, name, fileId, bytes, durationSec: voiceLineSeconds(bytes) };
}

/**
 * Node 01 narration, eleven lines in read order.
 *
 * Recorded 20 Aug 2026 into the Node 01 Masters folder alongside the five
 * picture masters. The line numbers are the order; there is no other ordering
 * information attached to the files, and there does not need to be — narration
 * is read front to back.
 */
export const NODE01_VO: VoiceLine[] = [
  voiceLine(1, "L01.mp3", "1WS9ea-iM1kj6TS5a1kbTjykoo6VzE2j5", 77_251),
  voiceLine(2, "L02.mp3", "16sjUnKdIuNQei-56caYkCOOHfGzjE6O2", 37_545),
  voiceLine(3, "L03.mp3", "1tuPmTWwYZS3AulfI224AGFel4i-QrrE8", 135_765),
  voiceLine(4, "L04.mp3", "1TjR05eh1FyFvvWlCvJzDWbbnJnG4P1Jf", 91_043),
  voiceLine(5, "L05.mp3", "1ResHSSc8ojBdY7EOG_1ahWOweOEJFLvF", 49_665),
  voiceLine(6, "L06.mp3", "1U477YfhzLiZsUjaFCJ6bUTb4XuTHc71H", 81_012),
  voiceLine(7, "L07.mp3", "1kVfPo8Hi72MzhAoYKA-Sl18F1MvzZ-zP", 34_619),
  voiceLine(8, "L08.mp3", "1VUW__h541bY6bsssqwlMHgICLjL8tLkc", 127_824),
  voiceLine(9, "L09.mp3", "1xnbioL-9h6YiP2_sQI0rNj16cwCvMRfq", 81_012),
  voiceLine(10, "L10.mp3", "1g7rJB4sff_8bZjjcmRO1_g776ihDswnZ", 90_625),
  voiceLine(11, "L11.mp3", "1B8Cy3miwKWwNqkpqM1rMeLaqxivL1DE-", 101_492),
];

/**
 * An alternate read of line 8, one second longer than the take in the sequence.
 *
 * Deliberately not in `NODE01_VO`: an alternate that sits in the line list is an
 * alternate that eventually gets counted as a twelfth line and laid end to end
 * with the rest, which would put a second reading of the same words into the
 * cut. It is here so the studio knows the take exists.
 */
export const NODE01_VO_ALT: VoiceLine = voiceLine(
  8,
  "L08_alt.mp3",
  "14mHTjt7P4lXr4XRThRskcW9Zajwl1RqE",
  129_078,
);

/**
 * Decoded runtime of each line, in seconds, as the container reports it.
 *
 * Read off the eleven files after they were pulled down and decoded — this is
 * measurement, not derivation, which is the whole reason it is worth carrying.
 * Two decimal places because that is the precision the reading has; asserting
 * more would be dressing up the source. The alternate take is absent for the
 * same reason it is absent from `NODE01_VO`.
 */
export const MEASURED_SEC: Record<number, number> = {
  1: 3.76,
  2: 1.28,
  3: 7.42,
  4: 4.62,
  5: 2.04,
  6: 4.0,
  7: 1.1,
  8: 6.92,
  9: 4.0,
  10: 4.6,
  11: 5.28,
};

/** Every line the studio holds for Node 01, alternates included. */
export function node01VoiceTakes(): VoiceLine[] {
  return [...NODE01_VO, NODE01_VO_ALT];
}

/** Runtime of the narration laid end to end. */
export function node01NarrationSeconds(): number {
  return Math.round(NODE01_VO.reduce((sum, l) => sum + l.durationSec, 0) * 1000) / 1000;
}

/* -------------------------------------------------------------------------- */
/* TSWS — brand clip bin                                                       */
/* -------------------------------------------------------------------------- */

export type BrandClip = DriveMaster & {
  /**
   * The file under `public/media` this clip is already cut in as, when it is.
   *
   * Two of the twenty-nine are the masters the media library already serves.
   * Identified by exact byte match, which is available here and worth using:
   * without it the repo carries two clips whose provenance is a filename
   * somebody chose, and the bin carries twenty-nine of which two are secretly
   * duplicates of what is already shipped.
   */
  cutInAs?: string;
};

/**
 * The TSWS brand clip bin — coverage, deliberately not a cut.
 *
 * Twenty-nine clips delivered 20 Aug 2026. Their filenames are content
 * hashes: `tsws_2388dd38.mp4` and the rest carry no scene, take, slate or
 * order. That is the whole difficulty with this set and the reason it is a bin
 * rather than a sequence — an ordered list would be an order somebody invented,
 * and unlike the Node 01 shots, where the order *is* documented content, there
 * is nothing here to recover it from.
 *
 * The two that are on disk were probed for anything that could recover an
 * order — creation time, title, scene, take. They carry none: an encoder
 * string and a generator signature, nothing else. So the ordering has to come
 * from the delivery shot list or from somebody who has watched them.
 *
 * Both of those two are 720x1280, under the 1080x1920 the intake set as the
 * delivery floor. Two out of twenty-nine is not a finding about the set, but it
 * is the reason to measure the rest before anything here is cut as a master.
 */
export const TSWS_CLIP_BIN: BrandClip[] = [
  { name: "tsws_2388dd38.mp4", fileId: "1phUzIJXqY0PNf-8VyAQmXb5cyNPN81tn", bytes: 17_807_832 },
  {
    name: "tsws_07bc1738.mp4",
    fileId: "17BdgeyH5pwLj2qxc0llDxZmv5pXapB5A",
    bytes: 5_759_345,
    cutInAs: "/media/tsws_brand_master_a.mp4",
  },
  { name: "tsws_1cc5ff23.mp4", fileId: "1j7yRxEANDNTWHpJLnc4WW-aW2t8M9sf1", bytes: 4_020_651 },
  { name: "tsws_20433200.mp4", fileId: "1YFB7Yrt8SqtL85P6G06nuTUfDi3vEvJO", bytes: 3_533_491 },
  {
    name: "tsws_e8466435.mp4",
    fileId: "1A8sXd6i1TwAbLjz9DpDh6VIwb4P7nhxS",
    bytes: 2_845_308,
    cutInAs: "/media/tsws_brand_master_b.mp4",
  },
  { name: "tsws_27ad1789.mp4", fileId: "1Cc_EWFIT8si6dj4K8NQlQR6tBn972lF4", bytes: 2_829_824 },
  { name: "tsws_c72f1e75.mp4", fileId: "12aADvDOrseCA5dc8hONp3wVOv_IbLAtv", bytes: 2_677_641 },
  { name: "tsws_f20b855d.mp4", fileId: "1r3l2MflIktx4XVd0CTPjuYxLl0i65XNZ", bytes: 2_465_340 },
  { name: "tsws_ef6b8d5f.mp4", fileId: "19x2wnkLkX8yGelSuPUVhYsnyQ_98AAQk", bytes: 2_429_047 },
  { name: "tsws_c7bd7e86.mp4", fileId: "1NlO5uep_dzHoVfXJ-yqYuiVqavt-oVQx", bytes: 2_412_417 },
  { name: "tsws_59e058cf.mp4", fileId: "1_GAi5P_HqXnQUSlTlbcqBM-bq8zFfPeh", bytes: 1_717_199 },
  { name: "tsws_eabc5d81.mp4", fileId: "1FqjPWR-K-stRb0tcazE_XDhOZ73zq6qQ", bytes: 1_687_783 },
  { name: "tsws_be3a1735.mp4", fileId: "1mMsGX5mdW7gijWu_OlXjpUjmLKIh3Jco", bytes: 1_501_484 },
  { name: "tsws_e37e08ac.mp4", fileId: "141YlKBzas2QYOHnBp7jGr1ByxwOqDPT-", bytes: 1_433_374 },
  { name: "tsws_4638f8ba.mp4", fileId: "1_rGbn2n0RRyj0HZyP8zky3m-Cw_bMoAT", bytes: 1_132_300 },
  { name: "tsws_9c054486.mp4", fileId: "1cw1LXFIWrug8wMtD0ZNTg-HvlbPxglDv", bytes: 1_119_187 },
  { name: "tsws_20ab7461.mp4", fileId: "1Zl8C8VXKLqqIyCTqwNuyARPVFyWervpD", bytes: 1_106_648 },
  { name: "tsws_6cb22ef3.mp4", fileId: "1il8L029BzT040ucDbt35omtzAEHt6TOS", bytes: 1_024_644 },
  { name: "tsws_94e9a62a.mp4", fileId: "1lmRjAuIWA0JUHV3QtfC_G-CCaMpXh4By", bytes: 991_451 },
  { name: "tsws_0194b3c6.mp4", fileId: "1lSbqJiCA9LdbVfoUzTl_fxAP1FNSQO3h", bytes: 861_289 },
  { name: "tsws_b1c51ba0.mp4", fileId: "1Cq5NeHppk1MAg79rsa-6yz4JCPor15I5", bytes: 794_164 },
  { name: "tsws_1733c79c.mp4", fileId: "1DMMT4ZlRJs9y4g4LMN9DM4PqGfbflg1O", bytes: 672_835 },
  { name: "tsws_6064fa3a.mp4", fileId: "1PqPik7YU4L4zVtdqGnU8FGMsLzhVzl0o", bytes: 565_471 },
  { name: "tsws_73df8c86.mp4", fileId: "1vmWkbWAXhuTJyEYhznHZ0T_rsf0_uR7H", bytes: 519_458 },
  { name: "tsws_30949e11.mp4", fileId: "196d1eKHRY9DGPA9jOg-zrexFL-vPLVuc", bytes: 463_767 },
  { name: "tsws_536eb840.mp4", fileId: "1Hej0sOtvZb3XF8Bd5me50rwek2C4yftw", bytes: 436_280 },
  { name: "tsws_005ba973.mp4", fileId: "1fx-U2EjEE9XQwvM0Fd9yZ6ulbmKeeHgA", bytes: 427_545 },
  { name: "tsws_6a70ac78.mp4", fileId: "1djD2nPQSByblywQ44PHfH-a0ZSCDX_L-", bytes: 418_609 },
  { name: "tsws_c47433dd.mp4", fileId: "1XEvfh3koTkc5C7u92Y4xXarNvpiw_JFh", bytes: 340_369 },
];

/** The clips already serving from `public/media`. */
export function tswsCutIn(): BrandClip[] {
  return TSWS_CLIP_BIN.filter((c) => c.cutInAs !== undefined);
}

/** The clips the studio holds but has never put on screen. */
export function tswsUnplaced(): BrandClip[] {
  return TSWS_CLIP_BIN.filter((c) => c.cutInAs === undefined);
}
