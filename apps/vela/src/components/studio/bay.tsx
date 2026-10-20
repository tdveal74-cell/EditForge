import { Btn, Field } from "@/components/studio/controls";
import { Frame } from "@/components/studio/frame";
import { projectDuration, fmt, type Project } from "@/lib/studio/model";
import { useProject, useStudio } from "@/lib/studio/store";

export function Bay() {
  const project = useProject();
  const projects = useStudio((state) => state.projects);
  const setProject = useStudio((state) => state.setProject);
  const setRoom = useStudio((state) => state.setRoom);
  const createProject = useStudio((state) => state.createProject);
  const duplicateProject = useStudio((state) => state.duplicateProject);
  const deleteProject = useStudio((state) => state.deleteProject);
  const rename = useStudio((state) => state.rename);
  const setLogline = useStudio((state) => state.setLogline);
  const rebuildCut = useStudio((state) => state.rebuildCut);
  const rebuildCaptions = useStudio((state) => state.rebuildCaptions);
  const rebuildBoard = useStudio((state) => state.rebuildBoard);
  const addScoreClip = useStudio((state) => state.addScoreClip);
  const importProject = useStudio((state) => state.importProject);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 md:p-6">
      <div className="max-w-2xl">
        <h1 className="font-display text-4xl text-balance text-paper md:text-5xl">One project. Every room.</h1>
        <p className="mt-3 max-w-xl text-pretty text-mute">
          Apple Creator Studio rents you six apps and a subscription. Vela keeps the cut, the score, the still, the title, the board, and the script in one file, and it speaks MCP so an agent can work the same project.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {projects.map((item) => (
          <ProjectCard key={item.id} project={item} active={item.id === project.id} onOpen={() => setProject(item.id)} />
        ))}
      </div>

      <section className="grid gap-4 rounded-lg border border-line bg-panel p-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="flex flex-col gap-3">
          <Field label="Title" value={project.name} onChange={rename} />
          <Field label="Logline" value={project.logline} onChange={setLogline} multiline />
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Stat label="Picture" value={String(project.clips.filter((clip) => clip.kind === "picture").length)} />
            <Stat label="Runtime" value={fmt(projectDuration(project))} />
            <Stat label="Tempo" value={`${project.score.bpm}`} />
            <Stat label="Board" value={String(project.board.length)} />
          </dl>
        </div>
        <div className="flex flex-col gap-2">
          <Btn tone="copper" onClick={() => setRoom("cut")}>
            Open the cut
          </Btn>
          <Btn onClick={createProject}>New project</Btn>
          <Btn onClick={duplicateProject}>Duplicate</Btn>
          <Btn onClick={deleteProject}>Delete</Btn>
          <label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md border border-line bg-raise px-3 text-sm text-paper">
            Import .vela.json
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                try {
                  importProject(JSON.parse(await file.text()) as unknown);
                } catch {
                  useStudio.getState().flash("Could not read that file.");
                }
              }}
            />
          </label>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl">From the script, not from another app</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <Btn onClick={rebuildCut}>Rebuild cut from scene headings</Btn>
          <Btn onClick={rebuildCaptions}>Captions from dialogue</Btn>
          <Btn onClick={rebuildBoard}>Board from action lines</Btn>
          <Btn onClick={addScoreClip}>Drop the score loop on the cut</Btn>
          <Btn onClick={() => setRoom("mcp")}>Open MCP</Btn>
          <Btn onClick={() => setRoom("stage")}>Block on the stage</Btn>
          <Btn onClick={() => setRoom("enhance")}>Enhance the picture</Btn>
          <Btn onClick={() => setRoom("booth")}>Hear a line</Btn>
          <Btn onClick={() => setRoom("floor")}>Open the floor</Btn>
        </div>
        <p className="text-sm text-pretty text-mute">
          This is a connected room, not a finishing suite. It will not replace multicam, a full mix, or a broadcast online. It will keep a short, a reel, and its poster from drifting apart.
        </p>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-ink px-3 py-2">
      <dt className="text-xs text-mute">{label}</dt>
      <dd className="tabular-nums text-paper">{value}</dd>
    </div>
  );
}

function ProjectCard({ project, active, onOpen }: { project: Project; active: boolean; onOpen: () => void }) {
  const pictures = project.clips.filter((clip) => clip.kind === "picture").slice(0, 4);
  const strip = pictures.length ? pictures : project.clips.slice(0, 4);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`overflow-hidden rounded-lg border text-left ${active ? "border-copper" : "border-line"} bg-panel`}
    >
      <div className="flex h-24">
        {strip.map((clip) => (
          <div key={clip.id} className="min-w-0 flex-1">
            <Frame motif={clip.motif} />
          </div>
        ))}
        {strip.length === 0 && <div className="h-full flex-1 bg-raise" />}
      </div>
      <div className="flex flex-col gap-1 px-3 py-3">
        <span className="font-display text-2xl leading-none">{project.name}</span>
        <span className="line-clamp-2 text-sm text-pretty text-mute">{project.logline}</span>
        <span className="text-xs text-mute">
          {project.aspect} · {project.preset}
        </span>
      </div>
    </button>
  );
}
