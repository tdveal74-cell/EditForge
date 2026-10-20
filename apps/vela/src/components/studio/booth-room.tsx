import { useEffect, useRef, useState } from "react";
import { audioUrl, downloadAudio, saveAudio } from "@/lib/studio/audio-files";
import { Btn, Kicker, Slider } from "@/components/studio/controls";
import { renderEffect } from "@/lib/studio/effects";
import { Frame } from "@/components/studio/frame";
import { Presenter } from "@/components/studio/presenter";
import { ASPECT_RATIO, clipAt, extractCues, speakLength, uid, type Look, type Shot, type Take } from "@/lib/studio/model";
import { playStored, pushMouth, stopPerformance, useMouth } from "@/lib/studio/performance";
import { canSpeak, deviceVoices, speakLine } from "@/lib/studio/speech";
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
  const picture = clipAt(project.clips, 0, playhead);
  const cues = extractCues(project.script);

  useEffect(() => {
    if (active) setDraft(snap(active));
  }, [active?.id]);

  useEffect(() => {
    const load = () => setVoices(deviceVoices());
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
            Speak the line, record a read, or make a sound. The figure performs on your picture, and the cut plays it back.
          </p>
        </div>
        <div className="mx-auto w-full max-w-3xl">
          <div className="relative overflow-hidden rounded-lg border border-line bg-ink" style={{ aspectRatio: ASPECT_RATIO[project.aspect] }}>
            <div className={draft.shot === "close" ? "h-full opacity-30" : "h-full"}>
              <Frame motif={picture?.motif ?? "city"} grade={project.grade} enhance={project.enhance} />
            </div>
            <div className={frame}>
              <Presenter look={draft.look} mouth={mouth} label={draft.speaker} />
            </div>
          </div>
          <p className="mt-3 text-sm text-pretty text-paper">{draft.line || "No line yet."}</p>
          <p className="text-xs text-mute">
            {draft.audioId ? "A recorded read is attached." : `About ${speakLength(draft.line || "word", draft.rate)}s spoken.`} The score room is still the music.
          </p>
        </div>
      </div>
      <aside className="flex w-full shrink-0 flex-col gap-3 lg:w-80">
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
