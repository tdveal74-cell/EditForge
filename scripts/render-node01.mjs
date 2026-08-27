#!/usr/bin/env node
/**
 * Render the Node 01 assembly to a watchable picture cut.
 *
 * The point of this script is that it does not know the cut. It bundles
 * `lib/assembly.ts` and asks it, so the shot order and every duration come from
 * the same source the timeline screen and the tests read. Retyping the numbers
 * into an ffmpeg command is how a render and a timeline start disagreeing about
 * what the cut is, and the render is the one nobody re-checks.
 *
 * Picture only. The eleven narration lines live in Drive, not in this repo — the
 * assembly is timed to them but the bytes are not here to mux, and a silent
 * track laid under picture would look like a mix rather than an absence. Pass
 * --vo <dir> with the lines named L01.mp3..L11.mp3 to lay the read under it.
 *
 *   node scripts/render-node01.mjs [--out <file>] [--vo <dir>] [--ffmpeg <bin>]
 */

import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "..");

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const out = path.resolve(arg("out", path.join(root, "out", "acx_node01_assembly.mp4")));
const ffmpeg = arg("ffmpeg", "ffmpeg");
const voDir = arg("vo", null);

// Delivery floor is 1080x1920 — the intake flagged 720x1280 clips as below it.
// The masters are 941x1672 natives, so this is the same 1.15x Lanczos step the
// Drive README describes for the derived set.
const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 24;

const work = mkdtempSync(path.join(tmpdir(), "node01-"));
const bundle = path.join(work, "assembly.mjs");

await build({
  entryPoints: [path.join(root, "lib", "assembly.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: bundle,
  logLevel: "silent",
});

const { assembleNode01, node01Duration } = await import(pathToFileURL(bundle).href);
const shots = assembleNode01();
const duration = node01Duration();

// The concat demuxer holds each image for its `duration` and then ignores the
// duration on the final entry, so the last file is listed twice and the whole
// thing is cut to length with -t. Without that the closing beat plays for one
// frame.
const list = shots
  .map(({ shot, durationSec }) => {
    const file = path.join(root, "public", shot.src.replace(/^\//, ""));
    if (!existsSync(file)) throw new Error(`${shot.src} is in the assembly but not on disk`);
    return `file '${file}'\nduration ${durationSec}`;
  })
  .join("\n");
const last = path.join(root, "public", shots.at(-1).shot.src.replace(/^\//, ""));
const listFile = path.join(work, "shots.txt");
writeFileSync(listFile, `${list}\nfile '${last}'\n`);

const args = ["-y", "-f", "concat", "-safe", "0", "-i", listFile];

if (voDir) {
  // One concat list for the narration, in read order, laid end to end — the
  // same order the assembly times picture against.
  const lines = shots.flatMap((s) => s.lines);
  const voList = lines
    .map((l) => {
      const file = path.resolve(voDir, l.name);
      if (!existsSync(file)) throw new Error(`${l.name} not found in ${voDir}`);
      return `file '${file}'`;
    })
    .join("\n");
  const voFile = path.join(work, "vo.txt");
  writeFileSync(voFile, `${voList}\n`);
  args.push("-f", "concat", "-safe", "0", "-i", voFile);
}

args.push(
  "-t", String(duration),
  "-vf", `scale=${WIDTH}:${HEIGHT}:flags=lanczos,format=yuv420p`,
  "-r", String(FPS),
  "-c:v", "libx264",
  "-preset", "medium",
  "-crf", "18",
);
if (voDir) args.push("-c:a", "aac", "-b:a", "192k", "-shortest");
args.push("-movflags", "+faststart", out);

mkdirSync(path.dirname(out), { recursive: true });
const run = spawnSync(ffmpeg, args, { stdio: ["ignore", "ignore", "pipe"] });
if (run.status !== 0) {
  process.stderr.write(run.stderr?.toString() ?? "");
  process.exit(run.status ?? 1);
}

for (const { shot, lines, startSec, durationSec } of shots) {
  const at = `${startSec.toFixed(3)}s`.padStart(8);
  const held = `${durationSec.toFixed(3)}s`.padStart(8);
  const over = lines.map((l) => `L${String(l.line).padStart(2, "0")}`).join(" ");
  console.log(`${at} ${held}  S${shot.shot} ${shot.label.padEnd(22)} ${over}`);
}
console.log(`\n${duration.toFixed(3)}s  ${WIDTH}x${HEIGHT}  ${voDir ? "picture + read" : "picture only"}`);
console.log(out);
