import { useEffect, useState } from "react";
import {
  Aperture,
  AudioLines,
  Box,
  Cable,
  Clapperboard,
  Download,
  Image,
  Kanban,
  LayoutDashboard,
  Megaphone,
  Mic,
  ScrollText,
  Type,
} from "lucide-react";
import { Bay } from "@/components/studio/bay";
import { BoardRoom } from "@/components/studio/board";
import { BoothRoom } from "@/components/studio/booth-room";
import { CutRoom } from "@/components/studio/cut";
import { EnhanceRoom } from "@/components/studio/enhance-room";
import { ExportSheet } from "@/components/studio/export-sheet";
import { FloorRoom } from "@/components/studio/floor-room";
import { McpRoom } from "@/components/studio/mcp-room";
import { ScoreRoom } from "@/components/studio/score";
import { ScriptRoom } from "@/components/studio/script-room";
import { StageRoom } from "@/components/studio/stage-room";
import { StillRoom } from "@/components/studio/still";
import { TitleRoom } from "@/components/studio/titles";
import { stopLoop } from "@/lib/studio/audio";
import { stopPerformance, syncPerformance } from "@/lib/studio/performance";
import { projectDuration, type Room } from "@/lib/studio/model";
import { useStudio } from "@/lib/studio/store";

const ROOMS: { id: Room; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "bay", label: "Bay", icon: LayoutDashboard },
  { id: "cut", label: "Cut", icon: Clapperboard },
  { id: "score", label: "Score", icon: AudioLines },
  { id: "still", label: "Still", icon: Image },
  { id: "stage", label: "Stage", icon: Box },
  { id: "enhance", label: "Enhance", icon: Aperture },
  { id: "title", label: "Title", icon: Type },
  { id: "board", label: "Board", icon: Kanban },
  { id: "script", label: "Script", icon: ScrollText },
  { id: "booth", label: "Booth", icon: Mic },
  { id: "floor", label: "Floor", icon: Megaphone },
  { id: "mcp", label: "MCP", icon: Cable },
];

export function Studio() {
  const room = useStudio((state) => state.room);
  const notice = useStudio((state) => state.notice);
  const exportOpen = useStudio((state) => state.exportOpen);

  useEffect(() => {
    void useStudio.persist.rehydrate();
    return () => stopLoop();
  }, []);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const state = useStudio.getState();
      if (!state.playing) return;
      const dt = (now - last) / 1000;
      last = now;
      const project = state.projects.find((item) => item.id === state.activeId) ?? state.projects[0]!;
      const duration = projectDuration(project);
      const next = state.playhead + dt;
      if (next >= duration) {
        state.setPlayhead(duration);
        state.setPlaying(false);
        stopPerformance();
        return;
      }
      state.setPlayhead(next);
      syncPerformance(project, next, true);
      frame = requestAnimationFrame(tick);
    };
    const unsub = useStudio.subscribe((state, prev) => {
      if (state.playing && !prev.playing) {
        last = performance.now();
        frame = requestAnimationFrame(tick);
      }
      if (!state.playing && prev.playing) {
        cancelAnimationFrame(frame);
        stopPerformance();
      }
    });
    if (useStudio.getState().playing) frame = requestAnimationFrame(tick);
    return () => {
      unsub();
      cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) {
        return;
      }
      const state = useStudio.getState();
      if (event.code === "Space") {
        event.preventDefault();
        if (state.room === "score") state.toggleScore();
        else state.togglePlay();
      }
      if ((event.key === "s" || event.key === "S") && state.room === "cut") {
        event.preventDefault();
        state.splitClip();
      }
      if (event.key === "Backspace" || event.key === "Delete") {
        if (state.room === "cut") state.deleteClip();
        if (state.room === "still") state.deleteLayer();
        if (state.room === "stage") state.deleteProp();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-ink text-paper">
      <Header />
      <div className="flex min-h-0 flex-1">
        <Rail />
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto pb-20 md:pb-0">
          {room === "bay" && <Bay />}
          {room === "cut" && <CutRoom />}
          {room === "score" && <ScoreRoom />}
          {room === "still" && <StillRoom />}
          {room === "stage" && <StageRoom />}
          {room === "enhance" && <EnhanceRoom />}
          {room === "title" && <TitleRoom />}
          {room === "board" && <BoardRoom />}
          {room === "script" && <ScriptRoom />}
          {room === "booth" && <BoothRoom />}
          {room === "floor" && <FloorRoom />}
          {room === "mcp" && <McpRoom />}
        </main>
      </div>
      <MobileNav />
      {exportOpen && <ExportSheet />}
      {notice && (
        <div className="pointer-events-none fixed bottom-24 left-1/2 z-50 max-w-xs -translate-x-1/2 rounded-md border border-line bg-panel px-3 py-2 text-center text-sm text-paper md:bottom-6">
          {notice}
        </div>
      )}
    </div>
  );
}

function Header() {
  const projects = useStudio((state) => state.projects);
  const activeId = useStudio((state) => state.activeId);
  const setProject = useStudio((state) => state.setProject);
  const setExportOpen = useStudio((state) => state.setExportOpen);
  const setRoom = useStudio((state) => state.setRoom);
  const scoreOn = useStudio((state) => state.scoreOn);

  return (
    <header className="flex shrink-0 items-center gap-2 border-b border-line bg-panel px-3 py-2 md:gap-3 md:px-4">
      <button type="button" onClick={() => setRoom("bay")} className="flex min-h-11 items-center gap-2">
        <span className="relative inline-block h-5 w-5 bg-copper" aria-hidden="true">
          <span className="absolute top-0 right-0 h-2 w-2 bg-panel" />
        </span>
        <span className="font-display text-2xl leading-none tracking-tight">Vela</span>
      </button>
      <label className="min-w-0 flex-1">
        <span className="sr-only">Project</span>
        <select
          value={activeId}
          onChange={(event) => setProject(event.target.value)}
          className="h-11 w-full truncate rounded-md border border-line bg-ink px-2 text-sm text-paper outline-none focus:border-copper"
        >
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </label>
      {scoreOn && <span className="hidden text-xs text-copper sm:inline">Score live</span>}
      <button
        type="button"
        onClick={() => setExportOpen(true)}
        className="inline-flex min-h-11 items-center gap-2 rounded-md bg-copper px-3 text-sm font-medium text-copper-ink"
      >
        <Download className="size-4" aria-hidden="true" />
        <span className="hidden sm:inline">Package</span>
      </button>
    </header>
  );
}

function Rail() {
  const room = useStudio((state) => state.room);
  const setRoom = useStudio((state) => state.setRoom);
  const scoreOn = useStudio((state) => state.scoreOn);
  return (
    <nav className="hidden w-24 shrink-0 flex-col gap-1 overflow-y-auto border-r border-line bg-panel p-2 md:flex lg:w-44" aria-label="Rooms">
      {ROOMS.map((item) => {
        const Icon = item.icon;
        const on = room === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setRoom(item.id)}
            className={`flex min-h-11 items-center gap-2 rounded-md px-2 text-left text-sm ${
              on ? "bg-raise text-paper" : "text-mute hover:text-paper"
            }`}
          >
            <Icon className={`size-4 shrink-0 ${item.id === "score" && scoreOn ? "text-copper" : ""}`} aria-hidden="true" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function MobileNav() {
  const room = useStudio((state) => state.room);
  const setRoom = useStudio((state) => state.setRoom);
  const [open, setOpen] = useState(false);
  const more = room === "title" || room === "board" || room === "script" || room === "mcp" || room === "stage" || room === "enhance" || room === "booth" || room === "floor";
  const primary = ROOMS.filter((item) => item.id === "bay" || item.id === "cut" || item.id === "score" || item.id === "still");
  const extra = ROOMS.filter((item) => item.id === "stage" || item.id === "enhance" || item.id === "title" || item.id === "board" || item.id === "script" || item.id === "booth" || item.id === "floor" || item.id === "mcp");
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-panel md:hidden" aria-label="Rooms">
      {open && (
        <div className="absolute right-2 bottom-full mb-2 w-44 rounded-md border border-line bg-raise p-1">
          {extra.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              on={room === item.id}
              onClick={() => {
                setRoom(item.id);
                setOpen(false);
              }}
            />
          ))}
        </div>
      )}
      <div className="grid grid-cols-5">
        {primary.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            on={room === item.id}
            stacked
            onClick={() => {
              setOpen(false);
              setRoom(item.id);
            }}
          />
        ))}
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className={`flex min-h-14 flex-col items-center justify-center gap-1 text-xs ${more || open ? "text-paper" : "text-mute"}`}
        >
          <span className="text-sm leading-none">+</span>
          More
        </button>
      </div>
    </nav>
  );
}

function NavButton({
  item,
  on,
  onClick,
  stacked,
}: {
  item: (typeof ROOMS)[number];
  on: boolean;
  onClick: () => void;
  stacked?: boolean;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-11 items-center gap-2 px-3 text-sm ${stacked ? "min-h-14 flex-col justify-center gap-1 px-1 text-xs" : "w-full rounded-md"} ${
        on ? "text-paper" : "text-mute"
      }`}
    >
      <Icon className="size-4" aria-hidden="true" />
      {item.label}
    </button>
  );
}
