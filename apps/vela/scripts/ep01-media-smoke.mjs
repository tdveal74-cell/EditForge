import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const mediaRoot = process.env.VELA_TEST_MEDIA_DIR;
if (!mediaRoot) throw new Error("Set VELA_TEST_MEDIA_DIR to the real EP01 test sources.");
const temp = await mkdtemp(join(tmpdir(), "vela-ep01-test-"));
const tone = Buffer.alloc(44 + 48000 * 4 * 2);
tone.write("RIFF"); tone.writeUInt32LE(tone.length - 8, 4); tone.write("WAVEfmt ", 8); tone.writeUInt32LE(16, 16);
tone.writeUInt16LE(1, 20); tone.writeUInt16LE(1, 22); tone.writeUInt32LE(48000, 24); tone.writeUInt32LE(96000, 28);
tone.writeUInt16LE(2, 32); tone.writeUInt16LE(16, 34); tone.write("data", 36); tone.writeUInt32LE(tone.length - 44, 40);
for (let i = 0; i < 48000 * 4; i += 1) tone.writeInt16LE(Math.round(1200 * Math.sin(i * 2 * Math.PI * 440 / 48000)), 44 + i * 2);
const tonePath = join(temp, "TEST_TONE_NOT_VOICE.wav"); await writeFile(tonePath, tone);
const proxies = [];
for (const name of ["SH070_motion_v01_ORIGINAL_FAILED_DRAFT.mp4", "VEO4_SH100_E2b_to_E3_shells_fall.mp4"]) {
  const output = join(temp, `${name}.webm`);
  execFileSync("ffmpeg", ["-v", "error", "-i", join(mediaRoot, name), "-map", "0:v:0", "-map", "0:a?", "-vf", "scale=iw/2:ih/2", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-cpu-used", "8", "-crf", "35", "-b:v", "0", "-c:a", "libopus", output], { timeout: 60000 });
  proxies.push(output);
}
const server = spawn(process.execPath, ["scripts/with-app-env.mjs", "node_modules/vite/bin/vite.js", "dev", "--host", "127.0.0.1", "--port", "8087"], { stdio: ["ignore", "pipe", "pipe"] });
let logs = ""; server.stdout.on("data", (x) => { logs += x; }); server.stderr.on("data", (x) => { logs += x; });
let browser;
let debugPage;
const runtimeErrors = [];
const base = "http://127.0.0.1:8087";
const hashes = [
  "0e5710ac6c44d7ed53085ede2fb96700cbf4d296ec525bb070fd812f167fd02b",
  "202086b308ebac48a65462371aa9521aa685ec4e1fdf122c3f267fc287e05fd5",
  "0c82b6cfb118ae559e5ab49776dc10551f972fa21df0e5582c044e0d347cb310",
];
const snapshot = (page) => page.evaluate(async () => {
  const { useStudio } = await import("/src/lib/studio/store.ts");
  const state = useStudio.getState();
  return { project: state.projects.find((p) => p.id === state.activeId), playhead: state.playhead };
});

try {
  let ready = false;
  for (let i = 0; i < 100; i += 1) {
    try { await fetch(base); ready = true; break; } catch { /* wait for the isolated dev server */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  if (!ready) throw new Error(`Test server did not start: ${logs.slice(-3000)}`);
  browser = await chromium.launch({ headless: true, ...(process.env.VELA_TEST_CHROMIUM ? { executablePath: process.env.VELA_TEST_CHROMIUM } : {}), args: ["--no-sandbox"] });
  const context = await browser.newContext({ acceptDownloads: true });
  await context.addInitScript(() => {
    const OriginalAudio = window.Audio;
    window.__velaTestAudio = [];
    window.Audio = function (...args) { const audio = new OriginalAudio(...args); window.__velaTestAudio.push(audio); return audio; };
    window.Audio.prototype = OriginalAudio.prototype;
  });
  const page = await context.newPage(); page.on("pageerror", (error) => runtimeErrors.push(error.message));
  debugPage = page;
  page.setDefaultTimeout(10000);
  await page.goto(base, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await page.getByRole("button", { name: "Bay", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("EP01 CORE TEST — NOT A REPAIRED CUT");
  await page.getByRole("button", { name: "Open the cut", exact: true }).click();
  // Remove the new-project demo picture through the ordinary Remove action.
  await page.evaluate(async () => { const { useStudio } = await import("/src/lib/studio/store.ts"); const s = useStudio.getState(); const p = s.projects.find((p) => p.id === s.activeId); s.selectClip(p.clips[0].id); });
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await page.getByLabel("Timeline fps").selectOption("30");
  await page.locator('input[type="file"][multiple]').setInputFiles([
    join(mediaRoot, "SH070_motion_v01_ORIGINAL_FAILED_DRAFT.mp4"),
    join(mediaRoot, "VEO4_SH100_E2b_to_E3_shells_fall.mp4"),
    join(mediaRoot, "SH135_RETAINED_UNCHANGED.png"), tonePath,
  ]);
  await page.locator('[data-media-source]').nth(3).waitFor({ timeout: 30000 });
  const imported = await snapshot(page);
  assert.equal(imported.project.media.length, 4);
  assert.equal(imported.project.fps, 30);
  assert.deepEqual(imported.project.media.slice(0, 3).map((a) => a.sha256), hashes);
  assert.equal(imported.project.media[0].hasAudio, false);
  assert.equal(imported.project.media[1].hasAudio, true);
  assert.equal(imported.project.media[2].locked, true);
  for (let i = 0; i < 2; i += 1) {
    const row = page.locator(`[data-media-source="media-${hashes[i]}"]`);
    await row.locator('input[type="file"]').setInputFiles(proxies[i]);
    await row.getByText("User-linked proxy · content/sync still need verification", { exact: true }).waitFor();
  }
  for (const hash of hashes.slice(0, 2)) await page.locator(`[data-media-source="media-${hash}"]`).getByRole("button", { name: "Add to cut" }).click();
  await page.evaluate(async () => { const { useStudio } = await import("/src/lib/studio/store.ts"); useStudio.getState().setPlayhead(0); });
  await page.locator("video").waitFor();
  await page.waitForFunction(() => document.querySelector("video")?.readyState >= 2);
  await page.getByRole("button", { name: "Next frame", exact: true }).click();
  assert.ok(Math.abs((await snapshot(page)).playhead - 1 / 30) < 1e-8);
  await page.evaluate(async () => {
    const { useStudio } = await import("/src/lib/studio/store.ts");
    const s = useStudio.getState(); const p = s.projects.find((p) => p.id === s.activeId);
    s.selectClip(p.clips.find((c) => c.mediaId?.includes("0e5710ac")).id); s.setPlayhead(100 / 30);
  });
  await page.getByRole("button", { name: "Split", exact: true }).click();
  const split = await snapshot(page);
  const right = split.project.clips.find((c) => c.name.endsWith(" B"));
  assert.ok(right && Math.abs(right.sourceIn - 100 / 30) < 1e-8);
  assert.ok(Math.abs(right.duration - 81 / 30) < 1e-8);
  // A real WAV read spans the silent SH070 picture and the SH100 cut.
  await page.evaluate(async () => { const { useStudio } = await import("/src/lib/studio/store.ts"); useStudio.getState().setPlayhead(5); });
  await page.locator(`[data-media-source="${imported.project.media[3].id}"]`).getByRole("button", { name: "Add to cut" }).click();
  await page.evaluate(async () => {
    const { useStudio } = await import("/src/lib/studio/store.ts"); const s = useStudio.getState();
    const p = s.projects.find((p) => p.id === s.activeId);
    for (const clip of p.clips) if (clip.mediaId?.includes("202086b3")) s.updateMediaClip(clip.id, { muted: true });
    s.setPlayhead(179 / 30);
  });
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForFunction(() => window.__velaTestAudio.some((audio) => !audio.paused && audio.currentTime > 1.3));
  await page.waitForFunction(() => { const video = document.querySelector("video"); return video && !video.paused && video.currentTime > 0.2; });
  assert.ok((await snapshot(page)).playhead > 6.033333);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.reload({ waitUntil: "networkidle" });
  const reloaded = await snapshot(page);
  assert.equal(reloaded.project.fps, 30); assert.equal(reloaded.project.media.length, 4);
  assert.ok(reloaded.project.clips.find((c) => c.id === right.id)?.sourceIn > 3);
  await page.getByRole("button", { name: "Package", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Project + media backup", exact: true }).click();
  const backup = await download; const backupPath = join(temp, "ep01-test.vela.zip"); await backup.saveAs(backupPath);
  assert.ok((await readFile(backupPath)).length > 12_000_000);
  const fresh = await browser.newContext();
  const restoredPage = await fresh.newPage(); restoredPage.on("pageerror", (error) => runtimeErrors.push(error.message));
  await restoredPage.goto(base, { waitUntil: "networkidle" });
  assert.equal((await snapshot(restoredPage)).project.media?.length ?? 0, 0);
  await restoredPage.locator('input[type="file"]').setInputFiles(backupPath);
  await restoredPage.getByRole("button", { name: /^EP01 CORE TEST/ }).waitFor({ timeout: 30000 });
  const restored = await snapshot(restoredPage);
  assert.equal(restored.project.media.length, 4); assert.equal(restored.project.fps, 30);
  const restoredHashes = await restoredPage.evaluate(async () => {
    const { useStudio } = await import("/src/lib/studio/store.ts");
    const { mediaBlob, hashMedia } = await import("/src/lib/studio/media-files.ts");
    const s = useStudio.getState(); const p = s.projects.find((p) => p.id === s.activeId);
    return Promise.all(p.media.map(async (a) => hashMedia(await mediaBlob(a.id))));
  });
  assert.deepEqual(restoredHashes.slice(0, 3), hashes);
  assert.equal(restored.project.media[2].locked, true);
  const previousSave = await restoredPage.evaluate(() => localStorage.getItem("vela-studio-v1"));
  await restoredPage.evaluate(() => { Storage.prototype.setItem = function () { throw new DOMException("Test quota failure", "QuotaExceededError"); }; });
  await restoredPage.getByLabel("Title", { exact: true }).fill("UNSAVED QUOTA TEST");
  await restoredPage.getByRole("alert").getByText(/Changes are NOT saved/).waitFor();
  assert.equal(await restoredPage.evaluate(() => localStorage.getItem("vela-studio-v1")), previousSave);
  assert.deepEqual(runtimeErrors, []);
  console.log(JSON.stringify({ status: "passed", realSources: hashes, tests: ["real media import", "stream facts", "30 fps frame step", "split source offset", "source proxy playback", "independent WAV across silent SH070 and SH100 cut", "reload persistence", "self-contained ZIP export", "fresh-profile restore", "byte-identical SH135", "quota failure leaves previous save intact"], backupPath, backupBytes: (await readFile(backupPath)).length }));
} catch (error) {
  if (debugPage) { console.error("PAGE_TEXT", (await debugPage.locator("body").innerText()).slice(-6000)); console.error("STATE", JSON.stringify(await snapshot(debugPage))); }
  console.error(error); console.error("SERVER_TAIL", logs.slice(-4000)); process.exitCode = 1;
} finally {
  if (browser) await browser.close(); server.kill("SIGTERM");
}
