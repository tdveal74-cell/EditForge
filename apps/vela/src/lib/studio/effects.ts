export type EffectKind = "rain" | "hit" | "whoosh" | "room" | "sting" | "drone";

export function effectKind(prompt: string): EffectKind {
  const text = prompt.toLowerCase();
  if (/(rain|wet|drizzle)/.test(text)) return "rain";
  if (/(hit|impact|boom|thud)/.test(text)) return "hit";
  if (/(room|tone|air|noise)/.test(text)) return "room";
  if (/(sting|chime|note)/.test(text)) return "sting";
  if (/(drone|bed|hum)/.test(text)) return "drone";
  return "whoosh";
}

export async function renderEffect(prompt: string): Promise<{ blob: Blob; duration: number; kind: EffectKind }> {
  const kind = effectKind(prompt);
  const duration = kind === "rain" || kind === "room" || kind === "drone" ? 2.4 : 1.1;
  const ctx = new OfflineAudioContext(1, Math.floor(22050 * duration), 22050);
  const master = ctx.createGain();
  master.gain.value = 0.8;
  master.connect(ctx.destination);
  if (kind === "rain") rain(ctx, master, duration);
  else if (kind === "hit") hit(ctx, master);
  else if (kind === "room") room(ctx, master, duration);
  else if (kind === "sting") sting(ctx, master);
  else if (kind === "drone") drone(ctx, master, duration);
  else whoosh(ctx, master, duration);
  const rendered = await ctx.startRendering();
  return { blob: wavBlob(rendered), duration, kind };
}

function noise(ctx: BaseAudioContext, seconds: number): AudioBufferSourceNode {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.start();
  return source;
}

function env(ctx: BaseAudioContext, gain: GainNode, peak: number, attack: number, hold: number, release: number) {
  gain.gain.setValueAtTime(0.0001, 0);
  gain.gain.exponentialRampToValueAtTime(peak, attack);
  gain.gain.setValueAtTime(peak, hold);
  gain.gain.exponentialRampToValueAtTime(0.0001, release);
}

function rain(ctx: OfflineAudioContext, master: GainNode, duration: number) {
  const source = noise(ctx, duration);
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1800;
  filter.Q.value = 0.7;
  const gain = ctx.createGain();
  env(ctx, gain, 0.35, 0.2, duration - 0.4, duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(master);
}

function hit(ctx: OfflineAudioContext, master: GainNode) {
  const source = noise(ctx, 0.4);
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1800, 0);
  filter.frequency.exponentialRampToValueAtTime(120, 0.35);
  const gain = ctx.createGain();
  env(ctx, gain, 0.9, 0.01, 0.05, 0.4);
  const body = ctx.createOscillator();
  body.frequency.setValueAtTime(140, 0);
  body.frequency.exponentialRampToValueAtTime(40, 0.3);
  const bodyGain = ctx.createGain();
  env(ctx, bodyGain, 0.5, 0.01, 0.04, 0.35);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  body.connect(bodyGain);
  bodyGain.connect(master);
  body.start();
  body.stop(0.4);
}

function whoosh(ctx: OfflineAudioContext, master: GainNode, duration: number) {
  const source = noise(ctx, duration);
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(300, 0);
  filter.frequency.exponentialRampToValueAtTime(2400, duration * 0.7);
  filter.Q.value = 2;
  const gain = ctx.createGain();
  env(ctx, gain, 0.45, 0.08, duration * 0.55, duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(master);
}

function room(ctx: OfflineAudioContext, master: GainNode, duration: number) {
  const source = noise(ctx, duration);
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 400;
  const gain = ctx.createGain();
  env(ctx, gain, 0.2, 0.3, duration - 0.4, duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(master);
}

function sting(ctx: OfflineAudioContext, master: GainNode) {
  [440, 660].forEach((freq, index) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    env(ctx, gain, index === 0 ? 0.25 : 0.16, 0.02, 0.12, 0.9);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(1);
  });
}

function drone(ctx: OfflineAudioContext, master: GainNode, duration: number) {
  [110, 165].forEach((freq, index) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    env(ctx, gain, index === 0 ? 0.22 : 0.1, 0.15, duration - 0.4, duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(duration);
  });
}

function wavBlob(buffer: AudioBuffer): Blob {
  const samples = buffer.getChannelData(0);
  const pcm = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) pcm.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, "RIFF");
  pcm.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  pcm.setUint32(16, 16, true);
  pcm.setUint16(20, 1, true);
  pcm.setUint16(22, 1, true);
  pcm.setUint32(24, buffer.sampleRate, true);
  pcm.setUint32(28, buffer.sampleRate * 2, true);
  pcm.setUint16(32, 2, true);
  pcm.setUint16(34, 16, true);
  text(36, "data");
  pcm.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, samples[i] ?? 0));
    pcm.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }
  return new Blob([pcm.buffer], { type: "audio/wav" });
}
