import { Btn, Kicker } from "@/components/studio/controls";
import { extractScenes, wordCount } from "@/lib/studio/model";
import { useProject, useStudio } from "@/lib/studio/store";

export function ScriptRoom() {
  const project = useProject();
  const setScript = useStudio((state) => state.setScript);
  const tighten = useStudio((state) => state.tighten);
  const formatScenes = useStudio((state) => state.formatScenes);
  const rebuildCut = useStudio((state) => state.rebuildCut);
  const rebuildCaptions = useStudio((state) => state.rebuildCaptions);
  const rebuildBoard = useStudio((state) => state.rebuildBoard);
  const scenes = extractScenes(project.script);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-3 md:p-6">
      <div>
        <h1 className="font-display text-4xl">Script</h1>
        <p className="mt-2 text-pretty text-mute">
          Headings become picture. A name on its own line, then the spoken line, becomes a caption. Action lines become board cards.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Btn onClick={formatScenes}>Format headings</Btn>
        <Btn onClick={tighten}>Tighten filler</Btn>
        <Btn tone="copper" onClick={rebuildCut}>
          Rebuild cut
        </Btn>
        <Btn onClick={rebuildCaptions}>Captions</Btn>
        <Btn onClick={rebuildBoard}>Board</Btn>
      </div>
      <div className="flex gap-4 text-xs text-mute tabular-nums">
        <span>{wordCount(project.script)} words</span>
        <span>{scenes.length} scenes</span>
      </div>
      <label className="flex flex-col gap-2">
        <Kicker>Pages</Kicker>
        <textarea
          value={project.script}
          onChange={(event) => setScript(event.target.value)}
          spellCheck
          className="min-h-[24rem] w-full resize-y rounded-lg border border-line bg-panel p-4 font-sans text-base leading-relaxed text-paper outline-none focus:border-copper"
        />
      </label>
    </div>
  );
}
