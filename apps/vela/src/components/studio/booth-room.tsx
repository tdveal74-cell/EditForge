import { useEffect, useRef, useState } from "react";
import { audioUrl, downloadAudio, saveAudio } from "@/lib/studio/audio-files";
import { Btn, Kicker, Slider } from "@/components/studio/controls";
import { renderEffect } from "@/lib/studio/effects";
import { Frame } from "@/components/studio/frame";
import { Face, usePlate } from "@/components/studio/plate";
import { ASPECT_RATIO, clipAt, defaultLikeness, extractCues, speakLength, uid, type Look, type Shot, type Take } from "@/lib/studio/model";
import { playStored, pushMouth, stopPerformance, useMouth } from "@/lib/studio/performance";
import { canSpeak, naturalVoices, speakLine } from "@/lib/studio/speech";
import { useProject, useStudio } from "@/lib/studio/store";

const LOOKS: Look[] = ["lamp", "ink", "paper"];
const SHOTS: Shot[] = ["close", "medium", "wide"];
const SETUPS: { label: string; shot: Shot; look: Look }[] = [
  { label: "Spokesperson", shot: "close", look: "ink" },
  { label: "Host", shot: "medium", look: "lamp" },
  { label: "Wide", shot: "wide", look: "paper" },
];

function snap(take: Take): Take {
  return { ...take, rate: Math.round(take.rate * 20) / 20, pitch: Math.round(take.pitch * 20) / 20 };
}

function plateBlob(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const max = 1280;
      const scale = Math.min(1, max / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("image"));
        return;
      }
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (blob) resolve(blob);
          else reject(new Error("image"));
        },
        "image/jpeg",
        0.86,
      );
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image"));
    };
    image.src = url;
  });
}

const EMPTY: Take = {
  id: "",
  speaker: "SPEAKER",
  line: "",
  voiceURI: "",
  rate: 1,
  pitch: 1,
  shot: "medium",
  look: "ink",
};

function measure(url: string): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio(url);
    audio.onloadedmetadata = () => {
      const seconds = Number.isFinite(audio.duration) ? audio.duration : 2;
      resolve(Math.max(0.4, Math.round(seconds * 4) / 4));
    };
    audio.onerror = () => resolve(2);
  });
}

export function BoothRoom() {
  const project = useProject();
  const playhead = useStudio((state) => state.playhead);
  const saveTake = useStudio((state) => state.saveTake);
  const setLikeness = useStudio((state) => state.setLikeness);
  const deleteTake = useStudio((state) => state.deleteTake);
  const placeVoice = useStudio((state) => state.placeVoice);
  const placeFx = useStudio((state) => state.placeFx);
  const flash = useStudio((state) => state.flash);
  const booth = project.booth ?? { takes: [], activeId: null };
  const active = booth.takes.find((take) => take.id === booth.activeId) ?? booth.takes[0] ?? null;
  const [draft, setDraft] = useState<Take>(active ? snap(active) : EMPTY);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const [recording, setRecording] = useState(false);
  const [prompt, setPrompt] = useState("rain");
  const [fx, setFx] = useState<{ id: string; name: string; duration: number } | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const mouth = useMouth();
  const likeness = project.likeness ?? defaultLikeness();
  const plateUrl = usePlate(likeness.plateId);
  const picture = clipAt(project.clips, 0, playhead);
  const cues = extractCues(project.script);

  useEffect(() => {
    if (active) setDraft(snap(active));
  }, [active?.id]);

  useEffect(() => {
    const load = () => setVoices(naturalVoices());
    load();
    window.speechSynthesis?.addEventListener("voiceschanged", load);
    return () => {
      window.speechSynthesis?.removeEventListener("voiceschanged", load);
      stopPerformance();
    };
  }, []);

  const frame =
    draft.shot === "close"
      ? "absolute inset-0"
      : draft.shot === "medium"
        ? "absolute inset-x-[12%] bottom-0 h-[80%]"
        : "absolute bottom-2 left-2 h-[48%] w-[34%]";

  const current = (): Take => ({
    ...draft,
    id: draft.id || uid("take"),
    line: draft.line.trim(),
    speaker: draft.speaker.trim() || "SPEAKER",
  });

  const hear = () => {
    const line = draft.line.trim();
    if (!line) {
      flash("Pick a line from the script first.");
      return;
    }
    if (!canSpeak()) {
      flash("This browser has no speech voices. Record the line instead.");
      return;
    }
    stopPerformance();
    setSpeaking(true);
    speakLine(line, {
      voiceURI: draft.voiceURI,
      rate: draft.rate,
      pitch: draft.pitch,
      onMouth: pushMouth,
      onEnd: (error) => {
        setSpeaking(false);
        pushMouth(false);
        if (error && error !== "interrupted" && error !== "canceled") flash("This browser could not speak. Record the line instead.");
      },
    });
  };

  const record = async () => {
    if (recording) {
      recorder.current?.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      flash("This browser has no microphone.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const media = new MediaRecorder(stream);
      chunks.current = [];
      media.ondataavailable = (event) => {
        if (event.data.size) chunks.current.push(event.data);
      };
      media.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
        const blob = new Blob(chunks.current, { type: media.mimeType || "audio/webm" });
        const id = uid("audio");
        void saveAudio(id, blob).then(async () => {
          const url = await audioUrl(id);
          const duration = url ? await measure(url) : 2;
          setDraft((prev) => ({ ...prev, audioId: id, duration }));
          flash("Read saved. Play it, or mark it on the cut.");
        });
      };
      recorder.current = media;
      stopPerformance();
      media.start();
      setRecording(true);
    } catch {
      flash("The microphone is blocked. Hear still uses this device.");
    }
  };

  const makeSound = async () => {
    const made = await renderEffect(prompt);
    const id = uid("audio");
    await saveAudio(id, made.blob);
    setFx({ id, name: made.kind, duration: made.duration });
    await playStored(id);
    flash(`${made.kind} is ready to drop on the cut.`);
  };

  return (
    <div className="flex flex-col gap-4 p-3 lg:flex-row lg:p-5">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div>
          <h1 className="font-display text-4xl">Booth</h1>
          <p className="mt-2 max-w-xl text-pretty text-mute">
            Your plate performs on the picture. Pores and retouch stay in Enhance. Vela does not invent a face and does not send the photo anywhere.
          </p>
        </div>
        <div className="mx-auto w-full max-w-3xl">
          <div className="relative overflow-hidden rounded-lg border border-line bg-ink" style={{ aspectRatio: ASPECT_RATIO[project.aspect] }}>
            <div className={draft.shot === "close" ? "h-full opacity-30" : "h-full"}>
              <Frame motif={picture?.motif ?? "city"} grade={project.grade} enhance={project.enhance} />
            </div>
            <div className={frame}>
              <Face look={draft.look} mouth={mouth} label={draft.speaker} plateUrl={plateUrl} enhance={project.enhance} likeness={likeness} />
            </div>
          </div>
          <p className="mt-3 text-sm text-pretty text-paper">{draft.line || "No line yet."}</p>
          <p className="text-xs text-mute">
            {draft.audioId ? "A recorded read is attached." : `About ${speakLength(draft.line || "word", draft.rate)}s spoken.`} The score room is still the music.
          </p>
        </div>
      </div>
      <aside className="flex w-full shrink-0 flex-col gap-3 lg:w-80">
        <Kicker>Your plate</Kicker>
        <p className="text-xs text-pretty text-mute">A photo you supply. Identity holds the real picture. Catchlight, iris, under-eye, and lip are the hyperreal finish on top of Enhance.</p>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex min-h-11 cursor-pointer items-center rounded-md border border-line bg-raise px-3 text-sm text-paper">
            {plateUrl ? "Replace plate" : "Load plate"}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                void plateBlob(file).then(async (blob) => {
                  const id = uid("plate");
                  await saveAudio(id, blob);
                  setLikeness({ plateId: id });
                  flash("Plate is on this device. Enhance still owns skin.");
                }).catch(() => flash("That picture could not be read."));
              }}
            />
          </label>
          {likeness.plateId && (
            <Btn onClick={() => setLikeness({ plateId: null })}>Use the figure</Btn>
          )}
        </div>
        <Slider label="Identity" min={0} max={100} value={likeness.identity} onChange={(identity) => setLikeness({ identity })} />
        <Slider label="Catchlight" min={0} max={100} value={likeness.catchlight} onChange={(catchlight) => setLikeness({ catchlight })} />
        <Slider label="Iris" min={0} max={100} value={likeness.iris} onChange={(iris) => setLikeness({ iris })} />
        <Slider label="Under-eye" min={0} max={100} value={likeness.underEye} onChange={(underEye) => setLikeness({ underEye })} />
        <Slider label="Lip" min={0} max={100} value={likeness.lip} onChange={(lip) => setLikeness({ lip })} />
        <Kicker>Voice body</Kicker>
        <p className="text-xs text-pretty text-mute">Warmth, presence, and breath shape a recorded read. Hear still uses a voice on this device, with the pitch falling at the end of a sentence.</p>
        <Slider label="Warmth" min={0} max={100} value={likeness.warmth} onChange={(warmth) => setLikeness({ warmth })} />
        <Slider label="Presence" min={0} max={100} value={likeness.presence} onChange={(presence) => setLikeness({ presence })} />
        <Slider label="Breath" min={0} max={100} value={likeness.breath} onChange={(breath) => setLikeness({ breath })} />
        <Kicker>Setup</Kicker>
        <div className="flex flex-wrap gap-2">
          {SETUPS.map((setup) => (
            <Btn key={setup.label} tone={draft.shot === setup.shot && draft.look === setup.look ? "copper" : "ghost"} onClick={() => setDraft({ ...draft, shot: setup.shot, look: setup.look })}>
              {setup.label}
            </Btn>
          ))}
        </div>
        <Kicker>Lines</Kicker>
        <div className="flex max-h-36 flex-col gap-1 overflow-y-auto">
          {cues.length === 0 && <p className="text-sm text-mute">No dialogue in the script. A name in caps, then the line.</p>}
          {cues.map((cue) => (
            <button
              key={`${cue.speaker}-${cue.line}`}
              type="button"
              onClick={() => setDraft({ ...draft, id: "", speaker: cue.speaker, line: cue.line, audioId: undefined, duration: undefined })}
              className="min-h-11 rounded-md border border-line px-3 text-left text-sm"
            >
              <span className="text-xs text-copper">{cue.speaker}</span>
              <span className="block truncate">{cue.line}</span>
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1 text-xs text-mute">
          Line
          <textarea
            value={draft.line}
            onChange={(event) => setDraft({ ...draft, line: event.target.value, audioId: undefined, duration: undefined })}
            rows={3}
            className="rounded-md border border-line bg-ink px-3 py-2 text-sm text-paper outline-none focus:border-copper"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-mute">
          Voice on this device
          <select
            value={draft.voiceURI}
            onChange={(event) => setDraft({ ...draft, voiceURI: event.target.value })}
            className="min-h-11 rounded-md border border-line bg-ink px-2 text-sm text-paper outline-none focus:border-copper"
          >
            <option value="">Default</option>
            {voices.map((voice) => (
              <option key={voice.voiceURI} value={voice.voiceURI}>
                {voice.name} · {voice.lang}
              </option>
            ))}
          </select>
        </label>
        <Slider label="Pace" min={0.7} max={1.35} step={0.05} value={draft.rate} onChange={(rate) => setDraft({ ...draft, rate: Math.round(rate * 20) / 20 })} />
        <Slider label="Pitch" min={0.7} max={1.4} step={0.05} value={draft.pitch} onChange={(pitch) => setDraft({ ...draft, pitch: Math.round(pitch * 20) / 20 })} />
        <div className="flex flex-wrap gap-2">
          {SHOTS.map((shot) => (
            <Btn key={shot} tone={draft.shot === shot ? "copper" : "ghost"} onClick={() => setDraft({ ...draft, shot })}>
              {shot === "close" ? "Close" : shot === "medium" ? "Medium" : "Wide"}
            </Btn>
          ))}
          {LOOKS.map((look) => (
            <Btn key={look} tone={draft.look === look ? "copper" : "ghost"} onClick={() => setDraft({ ...draft, look })}>
              {look === "lamp" ? "Lamp" : look === "ink" ? "Ink" : "Paper"}
            </Btn>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn tone="copper" onClick={speaking ? () => { stopPerformance(); setSpeaking(false); } : hear}>
            {speaking ? "Stop" : "Hear"}
          </Btn>
          <Btn onClick={() => void record()}>{recording ? "Stop recording" : "Record"}</Btn>
          {draft.audioId && (
            <Btn onClick={() => void playStored(draft.audioId!)}>Play read</Btn>
          )}
          {draft.audioId && (
            <Btn
              onClick={() => {
                void audioUrl(draft.audioId!).then((url) => {
                  if (url) downloadAudio("vela-read.webm", url);
                });
              }}
            >
              Download read
            </Btn>
          )}
        </div>
        <Kicker>Sound</Kicker>
        <label className="flex flex-col gap-1 text-xs text-mute">
          Prompt
          <input
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            className="min-h-11 rounded-md border border-line bg-ink px-3 text-sm text-paper outline-none focus:border-copper"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Btn onClick={() => void makeSound()}>Make sound</Btn>
          {fx && <Btn onClick={() => void playStored(fx.id)}>Play {fx.name}</Btn>}
          {fx && (
            <Btn
              onClick={() => placeFx({ name: fx.name, audioId: fx.id, duration: fx.duration })}
            >
              Sound on the cut
            </Btn>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn
            onClick={() => {
              const take = current();
              if (!take.line) {
                flash("Write a line before saving.");
                return;
              }
              setDraft(take);
              saveTake(take);
              flash("Take saved on this project.");
            }}
          >
            Save take
          </Btn>
          <Btn
            onClick={() => {
              const take = current();
              if (!take.line) {
                flash("Write a line before marking the cut.");
                return;
              }
              setDraft(take);
              placeVoice(take);
            }}
          >
            Mark on the cut
          </Btn>
        </div>
        <Kicker>Takes</Kicker>
        {booth.takes.length === 0 && <p className="text-sm text-mute">No saved takes.</p>}
        {booth.takes.map((take) => (
          <div key={take.id} className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setDraft(snap(take))}
              className={`min-h-11 min-w-0 flex-1 truncate rounded-md border px-3 text-left text-sm ${take.id === draft.id ? "border-copper text-paper" : "border-line text-mute"}`}
            >
              {take.speaker}: {take.line}
            </button>
            <Btn onClick={() => deleteTake(take.id)}>Remove</Btn>
          </div>
        ))}
      </aside>
    </div>
  );
}
