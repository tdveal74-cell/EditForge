import { useSyncExternalStore } from "react";
import { audioUrl } from "@/lib/studio/audio-files";
import type { Clip, Project } from "@/lib/studio/model";
import { speakLine, stopSpeak } from "@/lib/studio/speech";

let mouth = false;
const listeners = new Set<() => void>();

function setMouth(open: boolean) {
  if (mouth === open) return;
  mouth = open;
  listeners.forEach((listener) => listener());
}

export function pushMouth(open: boolean) {
  setMouth(open);
}

export function useMouth(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => mouth,
    () => false,
  );
}

let audio: HTMLAudioElement | null = null;
let context: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let wired = false;
let currentKey = "";
let previewFrame = 0;

function ensure(): { audio: HTMLAudioElement; context: AudioContext; analyser: AnalyserNode } {
  if (!audio) audio = new Audio();
  if (!context) context = new AudioContext();
  if (!wired && audio && context) {
    const source = context.createMediaElementSource(audio);
    analyser = context.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyser.connect(context.destination);
    wired = true;
  }
  return { audio: audio!, context: context!, analyser: analyser! };
}

function pump() {
  if (!analyser) return;
  const data = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(data);
  let sum = 0;
  for (const value of data) {
    const sample = (value - 128) / 128;
    sum += sample * sample;
  }
  setMouth(Math.sqrt(sum / data.length) > 0.06);
}

function clipAtTime(project: Project, time: number): Clip | null {
  const hits = project.clips.filter(
    (clip) => (clip.kind === "voice" || clip.kind === "fx") && time >= clip.start && time < clip.start + clip.duration,
  );
  return hits.find((clip) => clip.audioId) ?? hits.find((clip) => clip.kind === "voice") ?? null;
}

export function stopPerformance(): void {
  currentKey = "";
  cancelAnimationFrame(previewFrame);
  audio?.pause();
  stopSpeak();
  setMouth(false);
}

export async function playStored(id: string): Promise<void> {
  const url = await audioUrl(id);
  if (!url) return;
  const nodes = ensure();
  await nodes.context.resume();
  stopSpeak();
  currentKey = `preview:${id}`;
  nodes.audio.src = url;
  nodes.audio.currentTime = 0;
  await nodes.audio.play();
  const tick = () => {
    if (!audio || audio.paused || currentKey !== `preview:${id}`) {
      setMouth(false);
      return;
    }
    pump();
    previewFrame = requestAnimationFrame(tick);
  };
  previewFrame = requestAnimationFrame(tick);
}

export function syncPerformance(project: Project, time: number, playing: boolean): void {
  if (!playing) {
    stopPerformance();
    return;
  }
  const clip = clipAtTime(project, time);
  if (!clip) {
    if (currentKey) stopPerformance();
    return;
  }
  const key = clip.audioId ? `audio:${clip.id}` : `speak:${clip.id}`;
  if (clip.audioId) {
    const local = Math.max(0, time - clip.start);
    if (currentKey !== key) {
      currentKey = key;
      stopSpeak();
      void startClip(clip.audioId, local);
      return;
    }
    if (audio && Math.abs(audio.currentTime - local) > 0.4) audio.currentTime = local;
    pump();
    return;
  }
  if (currentKey === key) return;
  currentKey = key;
  audio?.pause();
  speakLine(clip.text || clip.name, {
    voiceURI: "",
    rate: 1,
    pitch: 1,
    onMouth: setMouth,
    onEnd: () => setMouth(false),
  });
}

async function startClip(id: string, offset: number): Promise<void> {
  const url = await audioUrl(id);
  if (!url || !currentKey.startsWith("audio:")) return;
  const nodes = ensure();
  await nodes.context.resume();
  if (nodes.audio.src !== url) nodes.audio.src = url;
  nodes.audio.currentTime = offset;
  await nodes.audio.play().catch(() => undefined);
}
