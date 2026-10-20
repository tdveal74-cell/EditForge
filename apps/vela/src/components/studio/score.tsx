import { Pause, Play } from "lucide-react";
import { Btn, Kicker, Slider } from "@/components/studio/controls";
import { NOTE_NAMES } from "@/lib/studio/model";
import { useProject, useStudio } from "@/lib/studio/store";

const VOICES = [
  { id: "kick", label: "Kick" },
  { id: "snare", label: "Snare" },
  { id: "hat", label: "Hat" },
  { id: "perc", label: "Perc" },
] as const;

export function ScoreRoom() {
  const project = useProject();
  const scoreOn = useStudio((state) => state.scoreOn);
  const scoreStep = useStudio((state) => state.scoreStep);
  const toggleScore = useStudio((state) => state.toggleScore);
  const toggleDrum = useStudio((state) => state.toggleDrum);
  const cycleNote = useStudio((state) => state.cycleNote);
  const setBpm = useStudio((state) => state.setBpm);
  const setSwing = useStudio((state) => state.setSwing);
  const addScoreClip = useStudio((state) => state.addScoreClip);
  const { score } = project;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-3 md:p-6">
      <div>
        <h1 className="font-display text-4xl">Score</h1>
        <p className="mt-2 max-w-xl text-pretty text-mute">
          A one-bar bed lives with the picture. Audition it here, then drop the loop on the cut. No bounce, no second app.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Btn tone="copper" onClick={toggleScore}>
          {scoreOn ? <Pause className="size-4" /> : <Play className="size-4" />}
          {scoreOn ? "Stop" : "Play loop"}
        </Btn>
        <Btn onClick={addScoreClip}>Drop on cut</Btn>
        <span className="text-sm text-mute tabular-nums">{score.bpm} bpm</span>
      </div>

      <div className="grid gap-3 rounded-lg border border-line bg-panel p-3 sm:grid-cols-2">
        <Slider label="Tempo" min={60} max={160} value={score.bpm} onChange={setBpm} />
        <Slider label="Swing" min={0} max={60} value={score.swing} onChange={setSwing} />
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-line bg-panel p-3">
        <Kicker>Drums</Kicker>
        {VOICES.map((voice) => (
          <div key={voice.id} className="flex flex-col gap-1">
            <span className="text-xs text-mute">{voice.label}</span>
            <div className="grid grid-cols-8 gap-1">
              {score.drums[voice.id].map((on, index) => (
                <button
                  key={`${voice.id}-${index}`}
                  type="button"
                  aria-pressed={on}
                  aria-label={`${voice.label} step ${index + 1}`}
                  onClick={() => toggleDrum(voice.id, index)}
                  className={`min-h-11 rounded-sm border text-xs tabular-nums ${
                    on ? "border-copper bg-copper text-copper-ink" : "border-line bg-ink text-mute"
                  } ${scoreOn && scoreStep === index ? "outline outline-2 outline-paper" : ""}`}
                >
                  {index + 1}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-line bg-panel p-3">
        <Kicker>Melody</Kicker>
        <p className="text-sm text-mute">Tap a step to climb the scale. A dash is a rest.</p>
        <div className="grid grid-cols-8 gap-1">
          {score.melody.map((note, index) => (
            <button
              key={`note-${index}`}
              type="button"
              onClick={() => cycleNote(index)}
              className={`min-h-11 rounded-sm border text-sm ${
                note ? "border-copper bg-raise text-paper" : "border-line bg-ink text-mute"
              } ${scoreOn && scoreStep === index ? "outline outline-2 outline-copper" : ""}`}
            >
              {NOTE_NAMES[note] ?? "–"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
