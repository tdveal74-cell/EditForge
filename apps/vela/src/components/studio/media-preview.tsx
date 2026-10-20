import { useEffect, useRef, useState } from "react";
import { mediaUrl } from "@/lib/studio/media-files";
import { audioGain, type MediaAsset } from "@/lib/studio/media-model";
import type { Clip, Project } from "@/lib/studio/model";

function useSource(id: string) {
  const [state, setState] = useState<{ url?: string; error?: string }>({});
  useEffect(() => {
    let live = true;
    setState({});
    void mediaUrl(id).then((url) => { if (live) setState({ url }); })
      .catch((error) => { if (live) setState({ error: String(error.message ?? error) }); });
    return () => { live = false; };
  }, [id]);
  return state;
}

export function MediaPicture({ clip, asset, time, playing, fps }: { clip: Clip; asset: MediaAsset; time: number; playing: boolean; fps: number }) {
  const { url, error } = useSource(asset.preview?.id ?? asset.id);
  const video = useRef<HTMLVideoElement>(null);
  const [failure, setFailure] = useState("");
  useEffect(() => {
    const node = video.current;
    if (!node || !url) return;
    const sourceTime = Math.max(0, (clip.sourceIn ?? 0) + time - clip.start);
    const sync = () => {
      if (!playing || Math.abs(node.currentTime - sourceTime) > 2 / fps) node.currentTime = sourceTime;
      if (playing && node.paused) void node.play().catch(() => setFailure("Playback was blocked. Pause, then press Play again."));
      if (!playing) node.pause();
    };
    if (node.readyState >= 1) sync();
    else node.addEventListener("loadedmetadata", sync, { once: true });
    return () => node.removeEventListener("loadedmetadata", sync);
  }, [url, clip.sourceIn, clip.start, time, playing, fps]);
  if (error || failure) return <div className="grid h-full place-items-center p-4 text-sm">{error ?? failure}</div>;
  if (!url) return <div className="grid h-full place-items-center text-sm">Loading original media…</div>;
  return asset.kind === "image"
    ? <img src={url} alt={asset.name} className="h-full w-full object-contain" />
    : <video ref={video} src={url} muted playsInline preload="auto" className="h-full w-full object-contain" onError={() => setFailure("The source could not be decoded. Relink a browser-playable proxy.")} />;
}

let context: AudioContext | undefined;
function audioContext() { return context ??= new AudioContext(); }

function MediaRead({ clip, asset, time, playing }: { clip: Clip; asset: MediaAsset; time: number; playing: boolean }) {
  const { url, error } = useSource(asset.preview?.id ?? asset.id);
  const nodes = useRef<{ audio: HTMLAudioElement; gain: GainNode; source: MediaElementAudioSourceNode } | null>(null);
  const [failure, setFailure] = useState("");
  useEffect(() => {
    if (!url) return;
    const audio = new Audio(url);
    const ctx = audioContext();
    const gain = ctx.createGain();
    const source = ctx.createMediaElementSource(audio);
    source.connect(gain); gain.connect(ctx.destination);
    nodes.current = { audio, gain, source };
    return () => { audio.pause(); audio.removeAttribute("src"); audio.load(); source.disconnect(); gain.disconnect(); nodes.current = null; };
  }, [url]);
  useEffect(() => {
    const current = nodes.current;
    if (!current) return;
    const local = time - clip.start;
    const sourceTime = (clip.sourceIn ?? 0) + local;
    current.gain.gain.value = audioGain(clip.gainDb ?? 0, local, clip.duration, clip.fadeIn, clip.fadeOut);
    if (!playing) { current.audio.pause(); return; }
    if (Math.abs(current.audio.currentTime - sourceTime) > 0.05) current.audio.currentTime = sourceTime;
    if (current.audio.paused) void audioContext().resume().then(() => current.audio.play()).catch(() => setFailure("Source audio playback was blocked."));
  }, [url, time, playing, clip]);
  return error || failure ? <span className="text-xs text-copper">{error ?? failure}</span> : null;
}

/** Real-media reads use separate players; a silent picture cannot mute A1–A5. */
export function MediaAudio({ project, time, playing }: { project: Project; time: number; playing: boolean }) {
  const active = project.clips.filter((clip) => clip.mediaId && !clip.muted && time >= clip.start && time < clip.start + clip.duration
    && (project.soloTrack == null || clip.track === project.soloTrack));
  return <>{active.map((clip) => {
    const asset = project.media?.find((item) => item.id === clip.mediaId);
    return asset && asset.kind !== "image" && asset.hasAudio !== false ? <MediaRead key={clip.id} clip={clip} asset={asset} time={time} playing={playing} /> : null;
  })}</>;
}
