import { useSyncExternalStore } from "react";
import { audioUrl } from "@/lib/studio/audio-files";
import type { Clip, Project } from "@/lib/studio/model";
import { speakLine, stopSpeak } from "@/lib/studio/speech";

let jaw = 0;
let mouth = false;
const listeners = new Set<() => void>();

function publish(nextJaw: number) {
  const value = Math.max(0, Math.min(1, nextJaw));
  const open = value > 0.12;
  if (Math.abs(value - jaw) < 0.02 && open === mouth) return;
  jaw = value;
  mouth = open;
  listeners.forEach((listener) => listener());
}

export function pushMouth(open: boolean) {
  publish(open ? 0.72 : 0.04);
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

export function useJaw(): number {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => jaw,
    () => 0,
  );
}

let audio: HTMLAudioElement | null = null;
let context: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let warmthFilter: BiquadFilterNode | null = null;
let presenceFilter: BiquadFilterNode | null = null;
let breathGain: GainNode | null = null;
let wired = false;
let currentKey = "";
let previewFrame = 0;
let body = { warmth: 46, presence: 38, breath: 16 };

export function applyVoiceBody(next: { warmth: number; presence: number; breath: number }) {
  body = next;
  if (warmthFilter) warmthFilter.gain.value = (next.warmth / 100) * 8;
  if (presenceFilter) presenceFilter.gain.value = (next.presence / 100) * 6;
  if (breathGain) breathGain.gain.value = (next.breath / 100) * 0.028;
}

function ensure(): { audio: HTMLAudioElement; context: AudioContext; analyser: AnalyserNode } {
  if (!audio) audio = new Audio();
  if (!context) context = new AudioContext();
  if (!wired && audio && context) {
    const source = context.createMediaElementSource(audio);
    warmthFilter = context.createBiquadFilter();
    warmthFilter.type = "lowshelf";
    warmthFilter.frequency.value = 240;
    presenceFilter = context.createBiquadFilter();
    presenceFilter.type = "peaking";
    presenceFilter.frequency.value = 2800;
    presenceFilter.Q.value = 0.8;
    const air = context.createBiquadFilter();
    air.type = "highshelf";
    air.frequency.value = 7000;
    air.gain.value = 1.4;
    const comp = context.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.knee.value = 10;
    comp.ratio.value = 2.4;
    comp.attack.value = 0.006;
    comp.release.value = 0.2;
    analyser = context.createAnalyser();
    analyser.fftSize = 256;
    const noise = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const channel = noise.getChannelData(0);
    for (let i = 0; i < channel.length; i += 1) channel[i] = Math.random() * 2 - 1;
    const hiss = context.createBufferSource();
    hiss.buffer = noise;
    hiss.loop = true;
    breathGain = context.createGain();
    const breathFilter = context.createBiquadFilter();
    breathFilter.type = "bandpass";
    breathFilter.frequency.value = 700;
    breathFilter.Q.value = 0.6;
    hiss.connect(breathFilter);
    breathFilter.connect(breathGain);
    breathGain.connect(comp);
    hiss.start();
    source.connect(warmthFilter);
    warmthFilter.connect(presenceFilter);
    presenceFilter.connect(air);
    air.connect(comp);
    comp.connect(analyser);
    analyser.connect(context.destination);
    wired = true;
    applyVoiceBody(body);
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
  publish(Math.min(1, Math.sqrt(sum / data.length) * 7));
}

function clipAtTime(project: Project, time: number): Clip | null {
  const hits = project.clips.filter(
    (clip) => !clip.mediaId && !clip.muted && (project.soloTrack == null || project.soloTrack === clip.track)
      && (clip.kind === "voice" || clip.kind === "fx") && time >= clip.start && time < clip.start + clip.duration,
  );
  return hits.find((clip) => clip.audioId) ?? hits.find((clip) => clip.kind === "voice") ?? null;
}

export function stopPerformance(): void {
  currentKey = "";
  cancelAnimationFrame(previewFrame);
  audio?.pause();
  stopSpeak();
  publish(0);
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
      publish(0);
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
    onMouth: (open) => publish(open ? 0.72 : 0.04),
    onEnd: () => publish(0),
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
