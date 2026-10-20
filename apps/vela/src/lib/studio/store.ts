import { create } from "zustand";
import type { AvatarProfile } from "./avatar-reference";
import { createJSONStorage, persist } from "zustand/middleware";
import { setStepListener, startLoop, stopLoop } from "@/lib/studio/audio";
import { planFloor, type FloorMark, type FloorSeat, type FloorStep } from "@/lib/studio/floor";
import { applyVoiceBody, stopPerformance, syncPerformance } from "@/lib/studio/performance";
import {
  beatsToBoard,
  blankProject,
  clipAt,
  dialogueToCaptions,
  extractBeats,
  extractDialogue,
  extractScenes,
  formatHeadings,
  isProject,
  posterLayers,
  PRESET_ASPECT,
  projectDuration,
  scenesToClips,
  seedProjects,
  speakLength,
  templateLayers,
  tightenScript,
  uid,
  withStage,
  LOCATION_LABEL,
  LOCATION_MOTIF,
  PROP_LABEL,
  type Aspect,
  type BoardCard,
  type Clip,
  type Enhance,
  type Fill,
  type Layer,
  type Likeness,
  type Motif,
  type Preset,
  type Project,
  type PropKind,
  type Room,
  type Stage,
  type Take,
  type TitleCard,
  type TitleMotion,
  type TitleStyle,
} from "@/lib/studio/model";

const LIBRARY: Motif[] = ["rain", "lantern", "hands", "alley", "steam", "mic", "wave", "city"];

interface Studio {
  projects: Project[];
  activeId: string;
  room: Room;
  playhead: number;
  playing: boolean;
  scoreOn: boolean;
  scoreStep: number;
  selectedClipId: string | null;
  selectedLayerId: string | null;
  selectedTitleId: string | null;
  selectedPropId: string | null;
  exportOpen: boolean;
  notice: string | null;
  floorSeat: FloorSeat;
  floorLog: FloorMark[];
  floorBusy: boolean;
  runFloor: (order: string) => Promise<void>;
  setRoom: (room: Room) => void;
  setProject: (id: string) => void;
  setExportOpen: (open: boolean) => void;
  flash: (message: string) => void;
  createProject: () => void;
  duplicateProject: () => void;
  deleteProject: () => void;
  importProject: (value: unknown) => void;
  rename: (name: string) => void;
  setLogline: (logline: string) => void;
  setPreset: (preset: Preset) => void;
  setAspect: (aspect: Aspect) => void;
  setPlayhead: (time: number) => void;
  togglePlay: () => void;
  setPlaying: (playing: boolean) => void;
  selectClip: (id: string | null) => void;
  addPicture: () => void;
  addScoreClip: () => void;
  moveClip: (id: string, start: number) => void;
  setClipDuration: (id: string, duration: number) => void;
  setClipName: (id: string, name: string) => void;
  splitClip: () => void;
  deleteClip: () => void;
  duplicateClip: () => void;
  closeGaps: () => void;
  setGrade: (key: keyof Project["grade"], value: number) => void;
  setStage: (partial: Partial<Omit<Stage, "props">>) => void;
  addProp: (kind: PropKind) => void;
  placeStillCard: () => void;
  updateProp: (id: string, partial: Partial<Project["stage"]["props"][number]>) => void;
  deleteProp: () => void;
  selectProp: (id: string | null) => void;
  sendShot: () => void;
  setEnhance: (patch: Partial<Enhance>) => void;
  setEnhanceScale: (scale: 1 | 2) => void;
  setLikeness: (patch: Partial<Likeness>) => void;
  setAvatar: (profile: AvatarProfile, expectedProjectId: string) => boolean;
  saveTake: (take: Take) => void;
  deleteTake: (id: string) => void;
  placeVoice: (take: Take) => void;
  placeFx: (fx: { name: string; audioId: string; duration: number }) => void;
  rebuildCaptions: () => void;
  addCaption: () => void;
  setCaptionText: (id: string, text: string) => void;
  deleteCaption: (id: string) => void;
  toggleDrum: (voice: "kick" | "snare" | "hat" | "perc", index: number) => void;
  cycleNote: (index: number) => void;
  setBpm: (bpm: number) => void;
  setSwing: (swing: number) => void;
  toggleScore: () => void;
  selectLayer: (id: string | null) => void;
  addLayer: (kind: Layer["kind"]) => void;
  updateLayer: (id: string, partial: Partial<Layer>) => void;
  deleteLayer: () => void;
  applyTemplate: (kind: "podcast" | "launch" | "sports" | "thumb") => void;
  matchPosterTitle: () => void;
  selectTitle: (id: string) => void;
  updateTitle: (id: string, partial: Partial<TitleCard>) => void;
  addTitle: () => void;
  deleteTitle: () => void;
  placeTitle: () => void;
  addCard: (act: 1 | 2 | 3) => void;
  updateCard: (id: string, partial: Partial<BoardCard>) => void;
  moveCard: (id: string, dir: -1 | 1) => void;
  deleteCard: (id: string) => void;
  setScript: (script: string) => void;
  tighten: () => void;
  formatScenes: () => void;
  rebuildCut: () => void;
  rebuildBoard: () => void;
}

let noticeTimer: ReturnType<typeof setTimeout> | null = null;

function patch(set: (partial: Partial<Studio>) => void, get: () => Studio, recipe: (project: Project) => Project) {
  const { projects, activeId } = get();
  set({
    projects: projects.map((project) => (project.id === activeId ? recipe(project) : project)),
  });
}

const seeds = seedProjects();

export const useStudio = create<Studio>()(
  persist(
    (set, get) => ({
      projects: seeds,
      activeId: seeds[0]?.id ?? "night-market",
      room: "bay",
      playhead: 0,
      playing: false,
      scoreOn: false,
      scoreStep: 0,
      selectedClipId: "nm-1",
      selectedLayerId: null,
      selectedTitleId: "nm-title",
      selectedPropId: "nm-runner",
      exportOpen: false,
      notice: null,
      floorSeat: "floor",
      floorLog: [],
      floorBusy: false,
      setRoom: (room) => set({ room, exportOpen: false }),
      setProject: (id) =>
        set({
          activeId: id,
          selectedClipId: null,
          selectedLayerId: null,
          selectedPropId: null,
          playhead: 0,
          playing: false,
        }),
      setExportOpen: (exportOpen) => set({ exportOpen }),
      flash: (message) => {
        if (noticeTimer) clearTimeout(noticeTimer);
        set({ notice: message });
        noticeTimer = setTimeout(() => set({ notice: null }), 2400);
      },
      createProject: () => {
        const count = get().projects.length + 1;
        const project = blankProject(`Untitled ${count}`);
        set({
          projects: [project, ...get().projects],
          activeId: project.id,
          room: "script",
          playhead: 0,
          playing: false,
        });
        get().flash("New project. The script room is the front door.");
      },
      duplicateProject: () => {
        const current = active(get());
        const copy: Project = {
          ...structuredClone(current),
          id: uid("project"),
          name: `${current.name} copy`,
        };
        set({ projects: [copy, ...get().projects], activeId: copy.id });
        get().flash("Project duplicated.");
      },
      deleteProject: () => {
        const { projects, activeId } = get();
        if (projects.length < 2) {
          get().flash("Keep at least one project.");
          return;
        }
        const next = projects.filter((project) => project.id !== activeId);
        set({ projects: next, activeId: next[0]?.id ?? activeId, playing: false });
      },
      importProject: (value) => {
        if (!isProject(value)) {
          get().flash("That file is not a Vela project.");
          return;
        }
        const project: Project = withStage({ ...value, id: uid("project"), name: value.name || "Imported" });
        set({ projects: [project, ...get().projects], activeId: project.id, room: "bay" });
        get().flash(`Imported ${project.name}.`);
      },
      rename: (name) => patch(set, get, (project) => ({ ...project, name })),
      setLogline: (logline) => patch(set, get, (project) => ({ ...project, logline })),
      setPreset: (preset) =>
        patch(set, get, (project) => ({
          ...project,
          preset,
          aspect: PRESET_ASPECT[preset],
        })),
      setAspect: (aspect) => patch(set, get, (project) => ({ ...project, aspect })),
      setPlayhead: (time) => set({ playhead: Math.max(0, time) }),
      setPlaying: (playing) => set({ playing }),
      togglePlay: () => {
        const state = get();
        if (state.playing) {
          set({ playing: false });
          stopPerformance();
          return;
        }
        const duration = projectDuration(active(state));
        const playhead = state.playhead >= duration - 0.05 ? 0 : state.playhead;
        set({ playing: true, playhead });
        syncPerformance(active(get()), playhead, true);
      },
      selectClip: (selectedClipId) => set({ selectedClipId }),
      addPicture: () => {
        const project = active(get());
        const end = project.clips
          .filter((clip) => clip.track === 0)
          .reduce((max, clip) => Math.max(max, clip.start + clip.duration), 0);
        const motif = LIBRARY[project.clips.length % LIBRARY.length] ?? "city";
        const clip: Clip = {
          id: uid("clip"),
          name: motif[0]?.toUpperCase() + motif.slice(1),
          kind: "picture",
          track: 0,
          start: end,
          duration: 3,
          motif,
        };
        patch(set, get, (current) => ({ ...current, clips: [...current.clips, clip] }));
        set({ selectedClipId: clip.id, playhead: clip.start, room: "cut" });
      },
      addScoreClip: () => {
        const project = active(get());
        const bar = (60 / project.score.bpm) * 4;
        const clip: Clip = {
          id: uid("clip"),
          name: "Score loop",
          kind: "score",
          track: 2,
          start: get().playhead,
          duration: Number(bar.toFixed(2)),
          motif: "wave",
        };
        patch(set, get, (current) => ({ ...current, clips: [...current.clips, clip] }));
        set({ selectedClipId: clip.id, room: "cut" });
        get().flash("Loop dropped on the score track.");
      },
      moveClip: (id, start) =>
        patch(set, get, (project) => ({
          ...project,
          clips: project.clips.map((clip) =>
            clip.id === id ? { ...clip, start: Math.max(0, Number(start.toFixed(2))) } : clip,
          ),
        })),
      setClipDuration: (id, duration) =>
        patch(set, get, (project) => ({
          ...project,
          clips: project.clips.map((clip) =>
            clip.id === id ? { ...clip, duration: Math.max(0.25, duration) } : clip,
          ),
        })),
      setClipName: (id, name) =>
        patch(set, get, (project) => ({
          ...project,
          clips: project.clips.map((clip) => (clip.id === id ? { ...clip, name } : clip)),
        })),
      splitClip: () => {
        const state = get();
        const project = active(state);
        const clip =
          project.clips.find((item) => item.id === state.selectedClipId) ??
          clipAt(project.clips, 0, state.playhead);
        if (!clip) {
          state.flash("Select a clip to split.");
          return;
        }
        const at = state.playhead;
        if (at <= clip.start + 0.15 || at >= clip.start + clip.duration - 0.15) {
          state.flash("Park the playhead inside the clip.");
          return;
        }
        const right: Clip = {
          ...clip,
          id: uid("clip"),
          name: `${clip.name} B`,
          start: Number(at.toFixed(2)),
          duration: Number((clip.start + clip.duration - at).toFixed(2)),
        };
        patch(set, get, (current) => ({
          ...current,
          clips: current.clips.flatMap((item) =>
            item.id === clip.id
              ? [{ ...item, duration: Number((at - item.start).toFixed(2)) }, right]
              : [item],
          ),
        }));
        set({ selectedClipId: right.id });
      },
      deleteClip: () => {
        const id = get().selectedClipId;
        if (!id) return;
        patch(set, get, (project) => ({
          ...project,
          clips: project.clips.filter((clip) => clip.id !== id),
        }));
        set({ selectedClipId: null });
      },
      duplicateClip: () => {
        const id = get().selectedClipId;
        const clip = active(get()).clips.find((item) => item.id === id);
        if (!clip) return;
        const copy: Clip = {
          ...clip,
          id: uid("clip"),
          name: `${clip.name} copy`,
          start: Number((clip.start + clip.duration).toFixed(2)),
        };
        patch(set, get, (project) => ({ ...project, clips: [...project.clips, copy] }));
        set({ selectedClipId: copy.id });
      },
      closeGaps: () => {
        patch(set, get, (project) => {
          const pictures = project.clips
            .filter((clip) => clip.track === 0)
            .slice()
            .sort((a, b) => a.start - b.start);
          let cursor = 0;
          const starts = new Map<string, number>();
          for (const clip of pictures) {
            starts.set(clip.id, cursor);
            cursor += clip.duration;
          }
          return {
            ...project,
            clips: project.clips.map((clip) =>
              starts.has(clip.id) ? { ...clip, start: Number((starts.get(clip.id) ?? 0).toFixed(2)) } : clip,
            ),
          };
        });
        get().flash("Picture track closed up.");
      },
      setGrade: (key, value) =>
        patch(set, get, (project) => ({
          ...project,
          grade: { ...project.grade, [key]: value },
        })),
      setStage: (partial) =>
        patch(set, get, (project) => ({
          ...project,
          stage: { ...project.stage, ...partial },
        })),
      addProp: (kind) => {
        const prop = {
          id: uid("prop"),
          name: PROP_LABEL[kind],
          kind,
          x: 0,
          y: kind === "card" ? 24 : 0,
          z: 24,
          rotY: 0,
          scale: 1,
          pose: 50,
        };
        patch(set, get, (project) => ({
          ...project,
          stage: { ...project.stage, props: [...project.stage.props, prop] },
        }));
        set({ selectedPropId: prop.id });
      },
      placeStillCard: () => {
        const name = active(get()).name;
        const prop = {
          id: uid("prop"),
          name,
          kind: "card" as const,
          x: 48,
          y: 28,
          z: -16,
          rotY: -18,
          scale: 1.1,
          pose: 50,
        };
        patch(set, get, (project) => ({
          ...project,
          stage: { ...project.stage, props: [...project.stage.props, prop] },
        }));
        set({ selectedPropId: prop.id });
        get().flash("The still is a card on the stage, not a second poster.");
      },
      updateProp: (id, partial) =>
        patch(set, get, (project) => ({
          ...project,
          stage: {
            ...project.stage,
            props: project.stage.props.map((prop) => (prop.id === id ? { ...prop, ...partial } : prop)),
          },
        })),
      deleteProp: () => {
        const id = get().selectedPropId;
        if (!id) return;
        patch(set, get, (project) => ({
          ...project,
          stage: { ...project.stage, props: project.stage.props.filter((prop) => prop.id !== id) },
        }));
        set({ selectedPropId: null });
      },
      selectProp: (selectedPropId) => set({ selectedPropId }),
      sendShot: () => {
        const project = active(get());
        const pictures = project.clips.filter((clip) => clip.kind === "picture");
        const start = pictures.reduce((end, clip) => Math.max(end, clip.start + clip.duration), 0);
        const clip: Clip = {
          id: uid("clip"),
          name: `${LOCATION_LABEL[project.stage.location]} shot`,
          kind: "picture",
          track: 0,
          start,
          duration: 4,
          motif: LOCATION_MOTIF[project.stage.location],
        };
        patch(set, get, (current) => ({ ...current, clips: [...current.clips, clip] }));
        set({ selectedClipId: clip.id });
        get().flash("Shot added to the cut. The timeline did not change rooms.");
      },
      setEnhance: (next) =>
        patch(set, get, (project) => ({
          ...project,
          enhance: { ...project.enhance, ...next },
        })),
      setEnhanceScale: (scale) =>
        patch(set, get, (project) => ({
          ...project,
          enhance: { ...project.enhance, scale },
        })),
      setLikeness: (next) => {
        patch(set, get, (project) => ({
          ...project,
          likeness: { ...project.likeness, ...next },
        }));
        const likeness = active(get()).likeness;
        applyVoiceBody({ warmth: likeness.warmth, presence: likeness.presence, breath: likeness.breath });
      },
      setAvatar: (profile, expectedProjectId) => {
        if (get().activeId !== expectedProjectId) return false;
        const look = profile.looks.find((item) => item.id === profile.selectedLookId);
        if (!look) return false;
        patch(set, get, (project) => ({ ...project, avatar: profile, likeness: { ...project.likeness, plateId: look.assetId } }));
        return true;
      },
      saveTake: (take) =>
        patch(set, get, (project) => {
          const booth = project.booth ?? { takes: [], activeId: null };
          const takes = booth.takes.some((item) => item.id === take.id)
            ? booth.takes.map((item) => (item.id === take.id ? take : item))
            : [...booth.takes, take];
          return { ...project, booth: { takes, activeId: take.id } };
        }),
      deleteTake: (id) =>
        patch(set, get, (project) => {
          const takes = (project.booth?.takes ?? []).filter((item) => item.id !== id);
          return { ...project, booth: { takes, activeId: takes[0]?.id ?? null } };
        }),
      placeVoice: (take) => {
        const start = get().playhead;
        const clip: Clip = {
          id: uid("clip"),
          name: take.speaker || "Voice",
          kind: "voice",
          track: 1,
          start,
          duration: take.duration ?? speakLength(take.line, take.rate),
          motif: "mic",
          text: take.line,
          sub: take.speaker,
          look: take.look,
          shot: take.shot,
          audioId: take.audioId,
        };
        patch(set, get, (project) => {
          const booth = project.booth ?? { takes: [], activeId: null };
          const takes = booth.takes.some((item) => item.id === take.id)
            ? booth.takes.map((item) => (item.id === take.id ? take : item))
            : [...booth.takes, take];
          return { ...project, booth: { takes, activeId: take.id }, clips: [...project.clips, clip] };
        });
        set({ selectedClipId: clip.id });
        get().flash(take.audioId ? "The read is on the cut and will play with it." : "The line is on the cut. Press play to hear it.");
      },
      placeFx: (fx) => {
        const clip: Clip = {
          id: uid("clip"),
          name: fx.name,
          kind: "fx",
          track: 2,
          start: get().playhead,
          duration: fx.duration,
          motif: "wave",
          text: fx.name,
          audioId: fx.audioId,
        };
        patch(set, get, (project) => ({ ...project, clips: [...project.clips, clip] }));
        set({ selectedClipId: clip.id });
        get().flash("Sound is on the score track.");
      },
      runFloor: async (order) => {
        if (get().floorBusy) return;
        const steps = planFloor(order);
        if (!steps.length) {
          set({
            floorSeat: "floor",
            floorLog: [
              {
                id: uid("floor"),
                seat: "floor",
                grant: "Hold the floor.",
                yielded: true,
                note: "Ask to rebuild, tighten, pull captions, pull the board, block a shot, or drop the score.",
              },
            ],
          });
          return;
        }
        const quiet = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        set({ floorBusy: true, floorSeat: "floor", floorLog: [], room: "floor" });
        for (const step of steps) {
          const id = uid("floor");
          set({
            floorSeat: step.seat,
            floorLog: [...get().floorLog, { id, seat: step.seat, grant: step.grant, yielded: false, note: "" }],
          });
          if (!quiet) await wait(240);
          const note = runGrant(get(), step);
          set({
            room: "floor",
            floorSeat: "floor",
            floorLog: get().floorLog.map((mark) => (mark.id === id ? { ...mark, yielded: true, note } : mark)),
          });
        }
        set({ floorBusy: false, floorSeat: "floor" });
      },
      rebuildCaptions: () => {
        const project = active(get());
        const lines = extractDialogue(project.script);
        if (!lines.length) {
          get().flash("No character cues. Write NAME then the line under it.");
          return;
        }
        const captions = dialogueToCaptions(lines, projectDuration(project));
        patch(set, get, (current) => ({ ...current, captions }));
        set({ room: "cut" });
        get().flash(`${captions.length} captions placed from dialogue.`);
      },
      addCaption: () => {
        const start = Number(get().playhead.toFixed(2));
        const caption = { id: uid("cap"), start, end: start + 2, text: "New line" };
        patch(set, get, (project) => ({ ...project, captions: [...project.captions, caption] }));
      },
      setCaptionText: (id, text) =>
        patch(set, get, (project) => ({
          ...project,
          captions: project.captions.map((caption) => (caption.id === id ? { ...caption, text } : caption)),
        })),
      deleteCaption: (id) =>
        patch(set, get, (project) => ({
          ...project,
          captions: project.captions.filter((caption) => caption.id !== id),
        })),
      toggleDrum: (voice, index) =>
        patch(set, get, (project) => ({
          ...project,
          score: {
            ...project.score,
            drums: {
              ...project.score.drums,
              [voice]: project.score.drums[voice].map((on, i) => (i === index ? !on : on)),
            },
          },
        })),
      cycleNote: (index) =>
        patch(set, get, (project) => ({
          ...project,
          score: {
            ...project.score,
            melody: project.score.melody.map((note, i) => (i === index ? (note + 1) % 9 : note)),
          },
        })),
      setBpm: (bpm) =>
        patch(set, get, (project) => ({
          ...project,
          score: { ...project.score, bpm },
        })),
      setSwing: (swing) =>
        patch(set, get, (project) => ({
          ...project,
          score: { ...project.score, swing },
        })),
      toggleScore: () => {
        if (get().scoreOn) {
          stopLoop();
          set({ scoreOn: false });
          return;
        }
        void startLoop(() => active(get()).score);
        set({ scoreOn: true });
      },
      selectLayer: (selectedLayerId) => set({ selectedLayerId }),
      addLayer: (kind) => {
        const layer: Layer = {
          id: uid("layer"),
          name: kind === "type" ? "Type" : kind === "ring" ? "Ring" : kind === "bar" ? "Bar" : "Block",
          kind,
          x: 16,
          y: 20,
          w: kind === "bar" ? 68 : kind === "type" ? 68 : 36,
          h: kind === "bar" ? 4 : kind === "type" ? 16 : 28,
          rotate: 0,
          opacity: 100,
          fill: kind === "type" ? "paper" : "copper",
          text: kind === "type" ? "New line" : "",
          mask: "none",
          font: kind === "type" ? "display" : "sans",
        };
        patch(set, get, (project) => ({ ...project, layers: [...project.layers, layer] }));
        set({ selectedLayerId: layer.id });
      },
      updateLayer: (id, partial) =>
        patch(set, get, (project) => ({
          ...project,
          layers: project.layers.map((item) => (item.id === id ? { ...item, ...partial } : item)),
        })),
      deleteLayer: () => {
        const id = get().selectedLayerId;
        if (!id) return;
        patch(set, get, (project) => ({
          ...project,
          layers: project.layers.filter((item) => item.id !== id),
        }));
        set({ selectedLayerId: null });
      },
      applyTemplate: (kind) => {
        const project = active(get());
        patch(set, get, (current) => ({
          ...current,
          layers: templateLayers(kind, project.name),
        }));
        set({ selectedLayerId: null });
        get().flash("Template applied to this project’s still.");
      },
      matchPosterTitle: () => {
        const project = active(get());
        patch(set, get, (current) => ({
          ...current,
          layers: current.layers.map((item) =>
            item.kind === "type" && item.name === "Title" ? { ...item, text: project.name } : item,
          ),
        }));
      },
      selectTitle: (selectedTitleId) => set({ selectedTitleId }),
      updateTitle: (id, partial) =>
        patch(set, get, (project) => ({
          ...project,
          titles: project.titles.map((title) => (title.id === id ? { ...title, ...partial } : title)),
        })),
      addTitle: () => {
        const title: TitleCard = {
          id: uid("title"),
          text: "NEW TITLE",
          sub: "",
          style: "lower",
          motion: "rise",
        };
        patch(set, get, (project) => ({ ...project, titles: [...project.titles, title] }));
        set({ selectedTitleId: title.id });
      },
      deleteTitle: () => {
        const id = get().selectedTitleId;
        const titles = active(get()).titles;
        if (!id || titles.length < 2) {
          get().flash("Keep one title.");
          return;
        }
        const next = titles.filter((title) => title.id !== id);
        patch(set, get, (project) => ({ ...project, titles: next }));
        set({ selectedTitleId: next[0]?.id ?? null });
      },
      placeTitle: () => {
        const state = get();
        const title = active(state).titles.find((item) => item.id === state.selectedTitleId);
        if (!title) return;
        const clip: Clip = {
          id: uid("clip"),
          name: title.text,
          kind: "title",
          track: 1,
          start: Number(state.playhead.toFixed(2)),
          duration: title.style === "center" ? 2.5 : 3.5,
          motif: "title",
          text: title.text,
          sub: title.sub,
          style: title.style,
          motion: title.motion,
        };
        patch(set, get, (project) => ({ ...project, clips: [...project.clips, clip] }));
        set({ room: "cut", selectedClipId: clip.id });
        get().flash("Title placed on the cut.");
      },
      addCard: (act) => {
        const card: BoardCard = {
          id: uid("card"),
          act,
          title: "New beat",
          body: "What changes here?",
        };
        patch(set, get, (project) => ({ ...project, board: [...project.board, card] }));
      },
      updateCard: (id, partial) =>
        patch(set, get, (project) => ({
          ...project,
          board: project.board.map((card) => (card.id === id ? { ...card, ...partial } : card)),
        })),
      moveCard: (id, dir) =>
        patch(set, get, (project) => {
          const cards = project.board.slice();
          const index = cards.findIndex((card) => card.id === id);
          const swap = index + dir;
          const current = cards[index];
          const other = cards[swap];
          if (!current || !other || current.act !== other.act) return project;
          cards[index] = other;
          cards[swap] = current;
          return { ...project, board: cards };
        }),
      deleteCard: (id) =>
        patch(set, get, (project) => ({
          ...project,
          board: project.board.filter((card) => card.id !== id),
        })),
      setScript: (script) => patch(set, get, (project) => ({ ...project, script })),
      tighten: () => {
        patch(set, get, (project) => ({ ...project, script: tightenScript(project.script) }));
        get().flash("Filler words lifted.");
      },
      formatScenes: () => {
        patch(set, get, (project) => ({ ...project, script: formatHeadings(project.script) }));
        get().flash("Scene headings set in caps.");
      },
      rebuildCut: () => {
        const scenes = extractScenes(active(get()).script);
        if (!scenes.length) {
          get().flash("Add a heading like INT. ROOM - NIGHT.");
          return;
        }
        const pictures = scenesToClips(scenes);
        patch(set, get, (project) => ({
          ...project,
          clips: [...project.clips.filter((clip) => clip.track !== 0), ...pictures],
        }));
        set({ room: "cut", playhead: 0, selectedClipId: pictures[0]?.id ?? null });
        get().flash(`${pictures.length} scenes rebuilt the picture track.`);
      },
      rebuildBoard: () => {
        const beats = extractBeats(active(get()).script);
        if (!beats.length) {
          get().flash("No action lines to pull.");
          return;
        }
        const board = beatsToBoard(beats);
        patch(set, get, (project) => ({ ...project, board }));
        set({ room: "board" });
        get().flash(`${board.length} beats landed on the board.`);
      },
    }),
    {
      name: "vela-studio-v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({
        projects: state.projects,
        activeId: state.activeId,
        room: state.room,
      }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<Pick<Studio, "projects" | "activeId" | "room">> | undefined;
        if (!saved?.projects?.length || !saved.projects.every(isProject)) return current;
        const projects = saved.projects.map((project) => withStage(project));
        const activeId = projects.some((project) => project.id === saved.activeId)
          ? (saved.activeId as string)
          : projects[0]!.id;
        return {
          ...current,
          projects,
          activeId,
          room: saved.room ?? current.room,
        };
      },
    },
  ),
);

function active(state: Pick<Studio, "projects" | "activeId">): Project {
  return state.projects.find((project) => project.id === state.activeId) ?? state.projects[0]!;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runGrant(studio: Studio, step: FloorStep): string {
  const project = active(studio);
  if (step.grant === "Lift filler from the script.") {
    studio.tighten();
    return "Filler lifted.";
  }
  if (step.grant === "Set the scene headings.") {
    studio.formatScenes();
    return "Scene headings set.";
  }
  if (step.grant === "Rebuild the picture track.") {
    if (!extractScenes(project.script).length) return "No scene headings to rebuild.";
    studio.rebuildCut();
    return "Picture track rebuilt.";
  }
  if (step.grant === "Pull captions from the dialogue.") {
    if (!extractDialogue(project.script).length) return "No dialogue to caption.";
    studio.rebuildCaptions();
    return "Captions pulled.";
  }
  if (step.grant === "Pull beats onto the board.") {
    if (!extractBeats(project.script).length) return "No action lines for the board.";
    studio.rebuildBoard();
    return "Beats are on the board.";
  }
  if (step.grant === "Send the blocked shot to the cut.") {
    studio.sendShot();
    return "Shot added to the cut.";
  }
  studio.addScoreClip();
  return "Score loop dropped.";
}

export function useProject(): Project {
  return useStudio((state) => state.projects.find((project) => project.id === state.activeId) ?? state.projects[0]!);
}

setStepListener((scoreStep) => {
  if (useStudio.getState().scoreStep !== scoreStep) useStudio.setState({ scoreStep });
});

export type { Fill, TitleMotion, TitleStyle };
