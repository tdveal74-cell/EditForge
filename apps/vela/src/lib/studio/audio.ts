import type { Score } from "@/lib/studio/model";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let step = 0;
let nextNote = 0;
let running = false;
let onStep: (step: number) => void = () => {};

const SCALE = [0, 3, 5, 7, 10, 12, 15, 17];

export function setStepListener(fn: (step: number) => void) {
  onStep = fn;
}

function context(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (!master || master.context !== ctx) {
    master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);
    noiseBuf = null;
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function noise(audio: AudioContext): AudioBuffer {
  if (noiseBuf && noiseBuf.sampleRate === audio.sampleRate) return noiseBuf;
  const buffer = audio.createBuffer(1, Math.floor(audio.sampleRate * 0.4), audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  noiseBuf = buffer;
  return buffer;
}

function envGain(audio: AudioContext, time: number, peak: number, decay: number): GainNode {
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.001), time + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + decay);
  gain.connect(master!);
  return gain;
}

function kick(audio: AudioContext, time: number) {
  const osc = audio.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(148, time);
  osc.frequency.exponentialRampToValueAtTime(46, time + 0.12);
  const gain = envGain(audio, time, 0.95, 0.28);
  osc.connect(gain);
  osc.start(time);
  osc.stop(time + 0.3);
}

function snare(audio: AudioContext, time: number) {
  const src = audio.createBufferSource();
  src.buffer = noise(audio);
  const filter = audio.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 1400;
  const gain = envGain(audio, time, 0.45, 0.16);
  src.connect(filter);
  filter.connect(gain);
  src.start(time);
  src.stop(time + 0.2);
  const osc = audio.createOscillator();
  osc.type = "triangle";
  osc.frequency.value = 190;
  const tone = envGain(audio, time, 0.2, 0.1);
  osc.connect(tone);
  osc.start(time);
  osc.stop(time + 0.12);
}

function hat(audio: AudioContext, time: number) {
  const src = audio.createBufferSource();
  src.buffer = noise(audio);
  const filter = audio.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 7000;
  const gain = envGain(audio, time, 0.18, 0.05);
  src.connect(filter);
  filter.connect(gain);
  src.start(time);
  src.stop(time + 0.06);
}

function perc(audio: AudioContext, time: number) {
  const osc = audio.createOscillator();
  osc.type = "square";
  osc.frequency.setValueAtTime(320, time);
  osc.frequency.exponentialRampToValueAtTime(180, time + 0.08);
  const gain = envGain(audio, time, 0.12, 0.1);
  osc.connect(gain);
  osc.start(time);
  osc.stop(time + 0.12);
}

function tone(audio: AudioContext, time: number, freq: number, length: number) {
  const osc = audio.createOscillator();
  osc.type = "triangle";
  osc.frequency.value = freq;
  const gain = envGain(audio, time, 0.16, Math.max(0.12, length));
  osc.connect(gain);
  osc.start(time);
  osc.stop(time + length + 0.02);
}

export function stopLoop() {
  running = false;
  if (timer) clearTimeout(timer);
  timer = null;
}

export function loopRunning(): boolean {
  return running;
}

export async function startLoop(readScore: () => Score) {
  const audio = context();
  if (audio.state === "suspended") await audio.resume();
  stopLoop();
  running = true;
  step = 0;
  nextNote = audio.currentTime + 0.06;

  const tick = () => {
    if (!running || !ctx) return;
    const score = readScore();
    const stepDur = 60 / Math.max(40, score.bpm) / 4;
    while (nextNote < ctx.currentTime + 0.12) {
      const swing = step % 2 === 1 ? (score.swing / 100) * stepDur * 0.65 : 0;
      const time = nextNote + swing;
      const index = step % 16;
      if (score.drums.kick[index]) kick(ctx, time);
      if (score.drums.snare[index]) snare(ctx, time);
      if (score.drums.hat[index]) hat(ctx, time);
      if (score.drums.perc[index]) perc(ctx, time);
      const degree = score.melody[index] ?? 0;
      if (degree > 0) {
        const semi = SCALE[degree - 1] ?? 0;
        tone(ctx, time, 220 * 2 ** (semi / 12), stepDur * 0.9);
      }
      onStep(index);
      step = (step + 1) % 16;
      nextNote += stepDur;
    }
    timer = setTimeout(tick, 25);
  };
  tick();
}

export function blip() {
  const audio = context();
  tone(audio, audio.currentTime, 440, 0.12);
}
