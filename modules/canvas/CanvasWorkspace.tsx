"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { newProject, parseProject, topologicalNodes } from "./model";
import { TEMPLATES } from "./templates";
import {
  ASPECT_OPTIONS,
  NODE_KIND_LABEL,
  type GraphNode,
  type NodeKind,
  type Project,
  type LibraryAsset,
} from "./types";
import type { AgentReply } from "./agent";
import type { RenderItem } from "./render";
import { FileUploads, uploadFile } from "./FileUploads";
import { fileSize } from "./files";
import { SpeakReply, VoiceInput } from "./VoiceControls";

type Plan = {
  items: RenderItem[];
  confirmation: string;
  projectId: string;
  revision: number;
};
type Turn = {
  id: string;
  message: string;
  status: string;
  response?: AgentReply;
  error?: string;
};
type Saved = { id: string; name: string; updatedAt: number };
async function api(body: Record<string, unknown>) {
  const res = await fetch("/api/canvas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Canvas request failed.");
  return data;
}
function download(name: string, body: string) {
  const url = URL.createObjectURL(
    new Blob([body], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} className="canvas-modal" onCancel={onClose}>
      <header>
        <h2>{title}</h2>
        <button aria-label="Close dialog" onClick={onClose}>
          Close ×
        </button>
      </header>
      {children}
    </dialog>
  );
}
function Media({
  asset,
  className = "",
}: {
  asset: { url: string; kind: string; title: string };
  className?: string;
}) {
  return asset.kind === "file" ? (
    <div className="file-preview">
      <span className="eyebrow">Production file</span>
      <p>{asset.title}</p>
      <a href={asset.url} target="_blank" rel="noreferrer">
        Download original file ↗
      </a>
    </div>
  ) : asset.kind === "video" ? (
    <video
      className={className}
      src={asset.url}
      controls
      playsInline
      preload="metadata"
      aria-label={asset.title}
    />
  ) : asset.kind === "audio" ? (
    <audio
      className={className}
      src={asset.url}
      controls
      preload="none"
      aria-label={asset.title}
    />
  ) : (
    <Image
      className={className}
      src={asset.url}
      alt={asset.title}
      width={960}
      height={540}
      unoptimized
    />
  );
}

export function CanvasWorkspace({
  initial,
  savedId,
}: {
  initial: Project;
  savedId?: string;
}) {
  const [project, setProject] = useState(initial);
  const current = useRef(project);
  const [selected, setSelected] = useState<string | undefined>(
    initial.nodes[0]?.id,
  );
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<Saved[]>([]);
  const [view, setView] = useState<"graph" | "list">("graph");
  const [zoom, setZoom] = useState(0.72);
  const [tab, setTab] = useState<"agent" | "outputs" | "sequence">("agent");
  const [message, setMessage] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [configured, setConfigured] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [voiceConsent, setVoiceConsent] = useState(false);
  const [proposal, setProposal] = useState<AgentReply | null>(null);
  const [preview, setPreview] = useState<LibraryAsset | null>(null);
  const [connectFrom, setConnectFrom] = useState("");
  const [assetUrl, setAssetUrl] = useState("");
  const [newKind, setNewKind] = useState<NodeKind>("image");
  const [historyDepth, setHistoryDepth] = useState({ undo: 0, redo: 0 });
  const past = useRef<Project[]>([]);
  const future = useRef<Project[]>([]);
  const importer = useRef<HTMLInputElement>(null);
  const graph = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    id: string;
    px: number;
    py: number;
    x: number;
    y: number;
  } | null>(null);
  const node = project.nodes.find((n) => n.id === selected);
  const update = useCallback((fn: (p: Project) => Project) => {
    const old = current.current;
    const next = fn(old);
    past.current = [...past.current.slice(-29), old];
    future.current = [];
    setHistoryDepth({ undo: past.current.length, redo: 0 });
    current.current = next;
    setProject(next);
    setDirty(true);
    setNotice("");
  }, []);
  function changeNode(patch: Partial<GraphNode>) {
    update((p) => ({
      ...p,
      nodes: p.nodes.map((n) => (n.id === selected ? { ...n, ...patch } : n)),
    }));
  }
  async function act(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function persist() {
    const { project: p } = await api({
      action: "save",
      project: current.current,
    });
    current.current = p;
    setProject(p);
    setDirty(false);
    setSaved((all) => [
      { id: p.id, name: p.name, updatedAt: p.updatedAt },
      ...all.filter((s) => s.id !== p.id),
    ]);
    return p as Project;
  }
  async function load(id: string) {
    const res = await fetch(`/api/canvas?id=${encodeURIComponent(id)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setProject(data.project);
    current.current = data.project;
    setSelected(data.project.nodes[0]?.id);
    setDirty(false);
    past.current = [];
    future.current = [];
    setHistoryDepth({ undo: 0, redo: 0 });
    setNotice("Saved project loaded.");
  }
  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/canvas").then((r) => r.json()),
      savedId
        ? fetch(`/api/canvas?id=${encodeURIComponent(savedId)}`).then((r) =>
            r.json(),
          )
        : Promise.resolve(null),
    ])
      .then(([data, p]) => {
        if (!active) return;
        if (data.error) throw new Error(data.error);
        setSaved(data.projects);
        setConfigured(data.agentConfigured);
        if (p?.project) {
          setProject(p.project);
          current.current = p.project;
          setSelected(p.project.nodes[0]?.id);
        } else if (p?.error) setError(p.error);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [savedId]);
  useEffect(() => {
    let active = true;
    fetch(`/api/canvas/agent?projectId=${encodeURIComponent(project.id)}`)
      .then((r) => r.json())
      .then((data) => {
        if (active) setTurns(data.turns || []);
      })
      .catch(() => {
        if (active) setError("Conversation history could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, [project.id]);
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  useEffect(() => {
    if (
      busy ||
      dirty ||
      !project.nodes.some((n) => n.status === "running" && n.jobId)
    )
      return;
    let active = true;
    const t = setTimeout(() => {
      api({ action: "poll", projectId: project.id })
        .then((data) => {
          if (active) {
            setProject(data.project);
            current.current = data.project;
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    }, 7000);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [project, busy, dirty]);
  function undo(redo = false) {
    const stack = redo ? future : past;
    if (!stack.current.length) return;
    const next = stack.current.pop()!;
    (redo ? past : future).current.push(current.current);
    setHistoryDepth({ undo: past.current.length, redo: future.current.length });
    current.current = { ...next, revision: current.current.revision };
    setProject(current.current);
    setDirty(true);
  }
  function addNode() {
    const id = crypto.randomUUID();
    const n: GraphNode = {
      id,
      kind: newKind,
      x: 60 + (project.nodes.length % 4) * 320,
      y: 60 + Math.floor(project.nodes.length / 4) * 310,
      title: `New ${NODE_KIND_LABEL[newKind].toLowerCase()}`,
      prompt: "",
      aspectRatio: "9:16",
      duration: 6,
      status: "idle",
    };
    update((p) => ({ ...p, nodes: [...p.nodes, n] }));
    setSelected(id);
  }
  function duplicate() {
    if (!node) return;
    const id = crypto.randomUUID();
    update((p) => ({
      ...p,
      nodes: [
        ...p.nodes,
        {
          ...node,
          id,
          title: `${node.title} · new take`,
          x: node.x + 40,
          y: node.y + 60,
          jobId: undefined,
          assetUrl: undefined,
          status: "idle",
          error: undefined,
          example: false,
        },
      ],
      edges: [
        ...p.edges,
        ...p.edges
          .filter((e) => e.to === node.id)
          .map((e) => ({ ...e, id: crypto.randomUUID(), to: id })),
      ],
    }));
    setSelected(id);
  }
  function connect() {
    if (!node || !connectFrom) return;
    try {
      const edges = [
        ...project.edges,
        { id: crypto.randomUUID(), from: connectFrom, to: node.id },
      ];
      topologicalNodes({ ...project, edges });
      if (project.edges.some((e) => e.from === connectFrom && e.to === node.id))
        throw new Error("These nodes are already connected.");
      update((p) => ({ ...p, edges }));
      setConnectFrom("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function prepare(ids: string[]) {
    const p = await persist();
    const data = await api({
      action: "prepare",
      projectId: p.id,
      nodeIds: ids,
    });
    setPlan(data.plan);
    setVoiceConsent(false);
  }
  async function jobAction(action: string) {
    if (!node) return;
    await persist();
    const data = await api({ action, projectId: project.id, nodeId: node.id });
    setProject(data.project);
    current.current = data.project;
    setDirty(false);
    setNotice(
      action === "accept"
        ? "Output accepted into this project. Final delivery still requires review."
        : "Local tracking stopped. Provider billing may continue.",
    );
  }
  function addToSequence(asset: LibraryAsset) {
    if (asset.kind === "file") {
      setError(
        "This file is saved as a production document. Add a playable media output to the sequence.",
      );
      return;
    }
    update((p) => ({
      ...p,
      clips: [
        ...p.clips,
        {
          id: crypto.randomUUID(),
          assetId: asset.id,
          label: asset.title,
          duration:
            project.nodes.find((n) => n.assetUrl === asset.url)?.duration || 6,
        },
      ],
    }));
    setNotice(`${asset.title} added to the sequence.`);
  }
  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    await act("Agent is working", async () => {
      const p = await persist();
      const requestId = crypto.randomUUID();
      const text = message.trim();
      const res = await fetch("/api/canvas/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: p.id, message: text, requestId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Agent request failed.");
      if (!data.turn) throw new Error("No conversation receipt returned.");
      setTurns((all) => [
        ...all.filter((t) => t.id !== data.turn.id),
        data.turn,
      ]);
      setMessage("");
      if (data.turn.response?.action === "outputs") setTab("outputs");
    });
  }
  function selectTab(t: typeof tab) {
    setTab(t);
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  const width = Math.max(1280, ...project.nodes.map((n) => n.x + 310));
  const height = Math.max(680, ...project.nodes.map((n) => n.y + 280));
  return (
    <main className="canvas-shell" aria-busy={Boolean(busy)}>
      <section className="canvas-mast">
        <div>
          <p className="eyebrow">EditForge / production floor</p>
          <h1>
            Canvas
            <span className="live-dot" />
          </h1>
          <p>Shape the idea. Direct the work. Keep the good take.</p>
        </div>
        <div className="canvas-mast-links">
          <Link href="/jobs">Job receipts ↗</Link>
          <Link href="/hardware">System readiness ↗</Link>
        </div>
      </section>
      <div className="canvas-toolbar">
        <label className="project-name">
          Project
          <input
            value={project.name}
            maxLength={160}
            onChange={(e) => update((p) => ({ ...p, name: e.target.value }))}
            disabled={Boolean(busy)}
          />
        </label>
        <label>
          Saved projects
          <select
            value=""
            aria-label="Open saved project"
            disabled={Boolean(busy)}
            onChange={(e) => {
              const id = e.target.value;
              if (id)
                void act("Loading", async () => {
                  if (dirty) await persist();
                  await load(id);
                });
            }}
          >
            <option value="">Open a project…</option>
            {saved.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <div className="toolbar-actions">
          <button onClick={() => selectTab("outputs")}>Upload files</button>
          <span className="save-state">
            {busy ||
              (dirty
                ? "Unsaved changes"
                : project.revision
                  ? `Saved · revision ${project.revision}`
                  : "New project")}
          </span>
          <button
            disabled={Boolean(busy) || !historyDepth.undo}
            onClick={() => undo()}
          >
            Undo
          </button>
          <button
            disabled={Boolean(busy) || !historyDepth.redo}
            onClick={() => undo(true)}
          >
            Redo
          </button>
          <button
            className="primary"
            disabled={Boolean(busy)}
            onClick={() =>
              void act("Saving", async () => {
                await persist();
                setNotice("Project saved to EditForge.");
              })
            }
          >
            Save project
          </button>
        </div>
      </div>
      <div className="canvas-feedback" aria-live="polite">
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {notice && <p className="success">{notice}</p>}
      </div>
      <div className="canvas-workbench">
        <aside className="workflow-rail">
          <p className="eyebrow">Start with a workflow</p>
          <div className="workflow-list">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                aria-pressed={project.templateId === t.id}
                disabled={Boolean(busy)}
                onClick={() =>
                  void act("Opening workflow", async () => {
                    if (dirty) await persist();
                    const p = newProject(t.id);
                    setProject(p);
                    current.current = p;
                    setSelected(p.nodes[0]?.id);
                    setDirty(true);
                    past.current = [];
                    future.current = [];
                    setHistoryDepth({ undo: 0, redo: 0 });
                    setNotice(
                      "New workflow opened. Included media is labelled as example work.",
                    );
                  })
                }
              >
                <span>{t.name}</span>
                <small>{t.category}</small>
              </button>
            ))}
          </div>
          <div className="rail-note">
            <span className="eyebrow">A connected studio</span>
            <p>
              Every render gets a receipt. Every final output gets your review.
            </p>
            <Link href="/rubric">Open the rubric ↗</Link>
          </div>
          <details>
            <summary>Project files</summary>
            <button
              onClick={() =>
                download(`${project.id}.json`, JSON.stringify(project, null, 2))
              }
            >
              Export project JSON
            </button>
            <button
              disabled={Boolean(busy)}
              onClick={() => importer.current?.click()}
            >
              Import project JSON
            </button>
            <input
              ref={importer}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                void act("Importing", async () => {
                  if (file.size > 600000)
                    throw new Error("Project file exceeds 600 KB.");
                  const p = parseProject(JSON.parse(await file.text()));
                  if (dirty) await persist();
                  const imported = {
                    ...p,
                    id: crypto.randomUUID(),
                    revision: 0,
                    nodes: p.nodes.map((n) => ({
                      ...n,
                      jobId: undefined,
                      status: n.assetUrl
                        ? ("done" as const)
                        : ("idle" as const),
                    })),
                    name: `${p.name} · imported`,
                  };
                  setProject(imported);
                  current.current = imported;
                  setSelected(imported.nodes[0]?.id);
                  setDirty(true);
                });
                e.target.value = "";
              }}
            />
          </details>
        </aside>
        <section className="graph-column" aria-label="Production graph">
          <div className="graph-tools">
            <div className="segmented">
              <button
                aria-pressed={view === "graph"}
                onClick={() => setView("graph")}
              >
                Graph
              </button>
              <button
                aria-pressed={view === "list"}
                onClick={() => setView("list")}
              >
                Shot list
              </button>
            </div>
            <div className="graph-zoom">
              <button
                aria-label="Zoom out"
                disabled={zoom <= 0.35}
                onClick={() => setZoom((z) => Math.max(0.35, z - 0.1))}
              >
                −
              </button>
              <output>{Math.round(zoom * 100)}%</output>
              <button
                aria-label="Zoom in"
                disabled={zoom >= 1.4}
                onClick={() => setZoom((z) => Math.min(1.4, z + 0.1))}
              >
                +
              </button>
              <button
                onClick={() => {
                  setZoom(
                    Math.max(
                      0.35,
                      Math.min(
                        0.9,
                        (graph.current?.clientWidth || 900) / width,
                      ),
                    ),
                  );
                  graph.current?.scrollTo({ top: 0, left: 0 });
                }}
              >
                Fit
              </button>
            </div>
          </div>
          <div
            className={`graph-viewport ${view === "list" ? "list-view" : ""}`}
            ref={graph}
          >
            <div
              className="graph-sizing"
              style={
                view === "graph"
                  ? { width: width * zoom, height: height * zoom }
                  : undefined
              }
            >
              <div
                className="graph-plane"
                style={
                  view === "graph"
                    ? { width, height, transform: `scale(${zoom})` }
                    : undefined
                }
              >
                {view === "graph" && (
                  <svg
                    className="graph-edges"
                    width={width}
                    height={height}
                    aria-hidden="true"
                  >
                    {project.edges.map((e) => {
                      const a = project.nodes.find((n) => n.id === e.from),
                        b = project.nodes.find((n) => n.id === e.to);
                      if (!a || !b) return null;
                      return (
                        <path
                          key={e.id}
                          d={`M ${a.x + 270} ${a.y + 90} C ${a.x + 320} ${a.y + 90}, ${b.x - 50} ${b.y + 90}, ${b.x} ${b.y + 90}`}
                        />
                      );
                    })}
                  </svg>
                )}
                {project.nodes.map((n, i) => (
                  <article
                    key={n.id}
                    className={`graph-node node-${n.kind} ${selected === n.id ? "selected" : ""}`}
                    style={
                      view === "graph" ? { left: n.x, top: n.y } : undefined
                    }
                  >
                    <button
                      className="node-handle"
                      aria-label={`Select ${n.title}`}
                      aria-pressed={selected === n.id}
                      onClick={() => setSelected(n.id)}
                      onPointerDown={(e) => {
                        if (busy || view !== "graph") return;
                        drag.current = {
                          id: n.id,
                          px: e.clientX,
                          py: e.clientY,
                          x: n.x,
                          y: n.y,
                        };
                        e.currentTarget.setPointerCapture(e.pointerId);
                      }}
                      onPointerMove={(e) => {
                        const d = drag.current;
                        if (!d || d.id !== n.id || view !== "graph") return;
                        const next = {
                          ...current.current,
                          nodes: current.current.nodes.map((x) =>
                            x.id === n.id
                              ? {
                                  ...x,
                                  x: Math.max(
                                    0,
                                    d.x + (e.clientX - d.px) / zoom,
                                  ),
                                  y: Math.max(
                                    0,
                                    d.y + (e.clientY - d.py) / zoom,
                                  ),
                                }
                              : x,
                          ),
                        };
                        current.current = next;
                        setProject(next);
                        setDirty(true);
                      }}
                      onPointerUp={() => {
                        drag.current = null;
                      }}
                      onPointerCancel={() => {
                        drag.current = null;
                      }}
                    >
                      <span>
                        {String(i + 1).padStart(2, "0")} /{" "}
                        {NODE_KIND_LABEL[n.kind]}
                      </span>
                      <span className={`node-status status-${n.status}`}>
                        {n.example
                          ? "Example"
                          : n.status === "done"
                            ? "Accepted"
                            : n.status === "validating"
                              ? "Review"
                              : n.status}
                      </span>
                    </button>
                    <button
                      className="node-body"
                      onClick={() => setSelected(n.id)}
                      aria-label={`Edit ${n.title}`}
                    >
                      <h3>{n.title}</h3>
                      {n.assetUrl && n.assetKind === "image" ? (
                        <Image
                          src={n.assetUrl}
                          alt={n.title}
                          width={270}
                          height={130}
                          unoptimized
                        />
                      ) : (
                        <p>
                          {n.prompt || "Add your direction in the inspector."}
                        </p>
                      )}
                      <footer>
                        <span>
                          {n.kind === "voice" ? "Dialogue" : n.aspectRatio}
                        </span>
                        <span>
                          {n.kind === "video"
                            ? `${n.duration || 6}s`
                            : n.kind === "output"
                              ? "Human review"
                              : n.assetKind === "audio"
                                ? "Audio ready"
                                : "Open inspector ↗"}
                        </span>
                      </footer>
                    </button>
                  </article>
                ))}
              </div>
            </div>
          </div>
          <div className="graph-bottom">
            <div>
              <label className="sr-only" htmlFor="new-kind">
                New node type
              </label>
              <select
                id="new-kind"
                value={newKind}
                onChange={(e) => setNewKind(e.target.value as NodeKind)}
              >
                {Object.entries(NODE_KIND_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <button
                disabled={Boolean(busy) || project.nodes.length >= 60}
                onClick={addNode}
              >
                + Add node
              </button>
            </div>
            <button
              className="primary"
              disabled={
                Boolean(busy) ||
                !project.nodes.some(
                  (n) =>
                    ["image", "video", "voice"].includes(n.kind) && !n.jobId,
                )
              }
              onClick={() =>
                void act("Preparing render", () =>
                  prepare(
                    project.nodes
                      .filter(
                        (n) =>
                          ["image", "video", "voice"].includes(n.kind) &&
                          !n.jobId,
                      )
                      .slice(0, 12)
                      .map((n) => n.id),
                  ),
                )
              }
            >
              Review render plan ↗
            </button>
          </div>
        </section>
        <aside className="node-inspector">
          <p className="eyebrow">Inspector</p>
          {node ? (
            <>
              <h2>{NODE_KIND_LABEL[node.kind]} direction</h2>
              <fieldset disabled={Boolean(busy)}>
                <label>
                  Title
                  <input
                    value={node.title}
                    maxLength={160}
                    onChange={(e) => changeNode({ title: e.target.value })}
                  />
                </label>
                <label>
                  {node.kind === "voice"
                    ? "Spoken dialogue"
                    : "Creative direction"}
                  <textarea
                    value={node.prompt}
                    maxLength={6000}
                    rows={6}
                    disabled={Boolean(node.jobId)}
                    onChange={(e) => changeNode({ prompt: e.target.value })}
                  />
                </label>
                <div className="field-pair">
                  <label>
                    Format
                    <select
                      value={node.aspectRatio}
                      disabled={Boolean(node.jobId)}
                      onChange={(e) =>
                        changeNode({
                          aspectRatio: e.target
                            .value as GraphNode["aspectRatio"],
                        })
                      }
                    >
                      {ASPECT_OPTIONS.map((a) => (
                        <option key={a}>{a}</option>
                      ))}
                    </select>
                  </label>
                  {["video", "voice"].includes(node.kind) && (
                    <label>
                      Seconds
                      <input
                        type="number"
                        min="1"
                        max="15"
                        value={node.duration || 6}
                        disabled={Boolean(node.jobId)}
                        onChange={(e) =>
                          changeNode({ duration: Number(e.target.value) })
                        }
                      />
                    </label>
                  )}
                </div>
                {node.kind === "voice" && (
                  <label>
                    Authorized voice ID
                    <input
                      placeholder="Studio default"
                      value={node.voiceId || ""}
                      disabled={Boolean(node.jobId)}
                      onChange={(e) => changeNode({ voiceId: e.target.value })}
                    />
                  </label>
                )}
                {node.assetUrl && (
                  <>
                    <Media
                      asset={{
                        url: node.assetUrl,
                        kind: node.assetKind || "image",
                        title: node.title,
                      }}
                      className="inspector-media"
                    />
                    <a
                      className="text-link"
                      href={node.assetUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open output ↗
                    </a>
                    <button
                      onClick={() => {
                        const asset = project.assets.find(
                          (a) => a.url === node.assetUrl,
                        );
                        if (asset) addToSequence(asset);
                      }}
                    >
                      Add output to sequence
                    </button>
                  </>
                )}
                {node.error && <p className="error">{node.error}</p>}
                {node.jobId && (
                  <p className="receipt">
                    <Link href="/jobs">Job receipt ↗</Link>
                    <small>{node.jobId}</small>
                  </p>
                )}
                {["image", "video", "voice"].includes(node.kind) &&
                  !node.jobId && (
                    <button
                      className="primary full"
                      onClick={() =>
                        void act("Preparing render", () => prepare([node.id]))
                      }
                    >
                      Render this {NODE_KIND_LABEL[node.kind].toLowerCase()}
                    </button>
                  )}
                {node.status === "validating" && (
                  <button
                    className="primary full"
                    onClick={() =>
                      void act("Accepting output", () => jobAction("accept"))
                    }
                  >
                    Accept this output
                  </button>
                )}
                {node.status === "running" && node.jobId && (
                  <button
                    onClick={() =>
                      void act("Stopping tracking", () => jobAction("cancel"))
                    }
                  >
                    Stop tracking job
                  </button>
                )}
                <details>
                  <summary>
                    Connections ·{" "}
                    {project.edges.filter((e) => e.to === node.id).length}
                  </summary>
                  {project.edges
                    .filter((e) => e.to === node.id)
                    .map((e) => (
                      <div className="connection" key={e.id}>
                        <span>
                          {project.nodes.find((n) => n.id === e.from)?.title}
                        </span>
                        <button
                          aria-label={`Disconnect ${project.nodes.find((n) => n.id === e.from)?.title}`}
                          onClick={() =>
                            update((p) => ({
                              ...p,
                              edges: p.edges.filter((x) => x.id !== e.id),
                            }))
                          }
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  <label>
                    Connect from
                    <select
                      value={connectFrom}
                      onChange={(e) => setConnectFrom(e.target.value)}
                    >
                      <option value="">Choose a node…</option>
                      {project.nodes
                        .filter((n) => n.id !== node.id)
                        .map((n) => (
                          <option key={n.id} value={n.id}>
                            {n.title}
                          </option>
                        ))}
                    </select>
                  </label>
                  <button disabled={!connectFrom} onClick={connect}>
                    Add connection
                  </button>
                </details>
                {node.kind === "image" && !node.jobId && (
                  <details>
                    <summary>Use an existing reference</summary>
                    <label>
                      HTTPS image or studio asset URL
                      <input
                        value={assetUrl}
                        onChange={(e) => setAssetUrl(e.target.value)}
                        placeholder="https://…"
                      />
                    </label>
                    <button
                      disabled={!assetUrl}
                      onClick={() => {
                        try {
                          const asset: LibraryAsset = {
                            id: crypto.randomUUID(),
                            url: assetUrl,
                            kind: "image",
                            title: node.title,
                            prompt: node.prompt,
                            aspectRatio: node.aspectRatio,
                            createdAt: Date.now(),
                          };
                          const next = {
                            ...project,
                            nodes: project.nodes.map((n) =>
                              n.id === node.id
                                ? {
                                    ...n,
                                    assetUrl,
                                    assetKind: "image" as const,
                                    status: "done" as const,
                                    example: false,
                                  }
                                : n,
                            ),
                            assets: [...project.assets, asset],
                          };
                          parseProject(next);
                          update(() => next);
                          setAssetUrl("");
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      Use reference image
                    </button>
                  </details>
                )}
                <div className="node-actions">
                  <button onClick={duplicate}>Duplicate as new take</button>
                  <button
                    disabled={Boolean(node.jobId && node.status === "running")}
                    onClick={() => {
                      update((p) => ({
                        ...p,
                        nodes: p.nodes.filter((n) => n.id !== node.id),
                        edges: p.edges.filter(
                          (e) => e.to !== node.id && e.from !== node.id,
                        ),
                      }));
                      setSelected(
                        project.nodes.find((n) => n.id !== node.id)?.id,
                      );
                    }}
                  >
                    Remove node
                  </button>
                </div>
              </fieldset>
            </>
          ) : (
            <p>Select a node to edit its direction and outputs.</p>
          )}
        </aside>
      </div>
      <section className="canvas-bottom" ref={bottom}>
        <div
          className="canvas-tabs"
          role="tablist"
          aria-label="Production tools"
        >
          {(["agent", "outputs", "sequence"] as const).map((t) => (
            <button
              key={t}
              id={`tab-${t}`}
              role="tab"
              aria-selected={tab === t}
              aria-controls={`panel-${t}`}
              onClick={() => selectTab(t)}
            >
              {t === "agent"
                ? "Floor Agent"
                : t === "outputs"
                  ? `Outputs · ${project.assets.length}`
                  : `Sequence · ${project.clips.length}`}
            </button>
          ))}
        </div>
        <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
          {tab === "agent" && (
            <div className="agent-layout">
              <div className="agent-intro">
                <span className="eyebrow">Your production partner</span>
                <h2>
                  Talk it through.
                  <br />
                  Then make it real.
                </h2>
                <p>
                  Plan scenes, direct a new take, or ask for the outputs. The
                  agent works with your saved graph and actual job receipts.
                </p>
                <span
                  className={`agent-connection ${configured ? "ready" : ""}`}
                >
                  {configured
                    ? "Live agent configured"
                    : "Agent connection needed"}
                </span>
                <p className="small">
                  Render requests open a confirmation. You approve the take
                  before the next step.
                </p>
              </div>
              <div className="agent-conversation">
                <div className="agent-messages" aria-live="polite">
                  {!turns.length && (
                    <div className="agent-empty">
                      <p>What are we making?</p>
                      <div className="prompt-chips">
                        {[
                          "Plan a two-scene micro drama with a held ending.",
                          "Render the ready stills in this graph.",
                          "Show me the outputs and what needs review.",
                        ].map((s) => (
                          <button key={s} onClick={() => setMessage(s)}>
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {turns.map((t) => (
                    <div key={t.id} className="agent-turn">
                      <div className="human-message">
                        <span>You</span>
                        <p>{t.message}</p>
                      </div>
                      <div className="agent-message">
                        <span>Floor Agent</span>
                        <p>
                          {t.error ||
                            t.response?.reply ||
                            (t.status === "pending"
                              ? "Response pending. Reload conversation to recover the receipt."
                              : "No response returned.")}
                        </p>
                        {t.response && (
                          <div className="agent-actions">
                            <SpeakReply text={t.response.reply} />
                            {t.response.action === "plan" && (
                              <button
                                className="primary"
                                onClick={() => setProposal(t.response!)}
                              >
                                Review proposed graph
                              </button>
                            )}
                            {t.response.action === "render" && (
                              <button
                                className="primary"
                                disabled={Boolean(busy)}
                                onClick={() =>
                                  void act("Preparing agent render", () =>
                                    prepare(t.response!.nodeIds!),
                                  )
                                }
                              >
                                Review & render jobs
                              </button>
                            )}
                            {t.response.action === "outputs" && (
                              <button onClick={() => setTab("outputs")}>
                                Open actual outputs
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <form onSubmit={ask}>
                  <label htmlFor="agent-message">Message the Floor Agent</label>
                  <textarea
                    id="agent-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={6000}
                    placeholder="Tell me the scene, the feeling, and what you need delivered…"
                    rows={3}
                  />
                  <div className="agent-compose">
                    <VoiceInput
                      disabled={Boolean(busy)}
                      onError={setError}
                      onTranscript={(text) => {
                        setMessage((s) => [s, text].filter(Boolean).join(" "));
                        setNotice(
                          "Transcript ready. Edit it, then send to the Floor Agent.",
                        );
                      }}
                    />
                    <button
                      className="primary"
                      type="submit"
                      disabled={Boolean(busy) || !message.trim()}
                    >
                      {busy === "Agent is working"
                        ? "Thinking…"
                        : "Send message ↗"}
                    </button>
                  </div>
                </form>
                <button
                  className="conversation-reload"
                  disabled={Boolean(busy)}
                  onClick={() =>
                    void act("Loading conversation", async () => {
                      const res = await fetch(
                        `/api/canvas/agent?projectId=${project.id}`,
                      );
                      const data = await res.json();
                      if (!res.ok) throw new Error("Conversation unavailable.");
                      setTurns(data.turns || []);
                    })
                  }
                >
                  Reload conversation
                </button>
              </div>
            </div>
          )}
          {tab === "outputs" && (
            <div className="output-panel">
              <FileUploads
                disabled={Boolean(busy)}
                onError={setError}
                onUpload={async (file, progress) => {
                  setBusy("Saving files");
                  setError("");
                  try {
                    const p = await persist();
                    const data = await uploadFile(
                      file,
                      p.id,
                      p.revision!,
                      progress,
                    );
                    setProject(data.project);
                    current.current = data.project;
                    setDirty(false);
                    setNotice(`${file.name} saved to this project.`);
                  } finally {
                    setBusy("");
                  }
                }}
              />
              <div className="panel-heading">
                <div>
                  <h2>The takes, all in one place.</h2>
                  <p>
                    Generated media stays in review until you accept it.
                    Included workflow images are examples.
                  </p>
                </div>
                <button
                  disabled={Boolean(busy) || !project.revision}
                  onClick={() =>
                    void act("Checking jobs", async () => {
                      if (dirty) await persist();
                      const data = await api({
                        action: "poll",
                        projectId: project.id,
                      });
                      setProject(data.project);
                      current.current = data.project;
                    })
                  }
                >
                  Refresh job outputs
                </button>
              </div>
              {!project.assets.length ? (
                <p className="empty">
                  Your first output will appear here when a render returns
                  media.
                </p>
              ) : (
                <div className="output-grid">
                  {project.assets.map((a) => (
                    <article key={a.id}>
                      <button
                        className="asset-preview"
                        onClick={() => setPreview(a)}
                        aria-label={`Preview ${a.title}`}
                      >
                        {a.kind === "image" ? (
                          <Image
                            src={a.url}
                            alt={a.title}
                            width={480}
                            height={270}
                            unoptimized
                          />
                        ) : (
                          <span className="media-glyph">
                            {a.kind === "video"
                              ? "▶"
                              : a.kind === "audio"
                                ? "♫"
                                : "↧"}
                          </span>
                        )}
                      </button>
                      <div>
                        <span className="eyebrow">
                          {a.uploaded
                            ? "Uploaded file"
                            : a.id.startsWith("job-")
                              ? "Generated output"
                              : "Reference / example"}{" "}
                          · {a.kind}
                        </span>
                        <h3>{a.title}</h3>
                        {a.size && <p className="small">{fileSize(a.size)}</p>}
                        <div className="asset-actions">
                          {a.kind !== "file" && (
                            <button onClick={() => addToSequence(a)}>
                              + Add to sequence
                            </button>
                          )}
                          <a href={a.url} target="_blank" rel="noreferrer">
                            Open ↗
                          </a>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
          {tab === "sequence" && (
            <div className="sequence-panel">
              <div className="panel-heading">
                <div>
                  <h2>Give the story its rhythm.</h2>
                  <p>
                    Order the shots, set durations, then hand the assembly to
                    EditForge. Dialogue is placed over the preceding picture
                    shot.
                  </p>
                </div>
                <div>
                  <button
                    disabled={!project.clips.length}
                    onClick={() =>
                      download(
                        `${project.id}-assembly.json`,
                        JSON.stringify(
                          {
                            name: project.name,
                            assets: project.assets,
                            sequence: project.clips,
                            reviewRequired: true,
                          },
                          null,
                          2,
                        ),
                      )
                    }
                  >
                    Download assembly
                  </button>
                  <button
                    className="primary"
                    disabled={Boolean(busy) || !project.clips.length}
                    onClick={() =>
                      void act("Creating studio cut", async () => {
                        const p = await persist();
                        const data = await api({
                          action: "handoff",
                          projectId: p.id,
                        });
                        setNotice(
                          `Studio cut created: ${data.cut.title}. Open Projects for the saved cut and review.`,
                        );
                      })
                    }
                  >
                    Create studio cut ↗
                  </button>
                  <Link href="/projects">Open Projects ↗</Link>
                </div>
              </div>
              {!project.clips.length ? (
                <p className="empty">
                  Add a still, motion take or dialogue output to begin.
                </p>
              ) : (
                <ol className="sequence-list">
                  {project.clips.map((c, i) => {
                    const a = project.assets.find((a) => a.id === c.assetId)!;
                    return (
                      <li key={c.id}>
                        <span className="sequence-number">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <button
                          className="sequence-thumb"
                          onClick={() => setPreview(a)}
                          aria-label={`Preview sequence clip ${i + 1}`}
                        >
                          {a.kind === "image" ? (
                            <Image
                              src={a.url}
                              alt=""
                              width={100}
                              height={60}
                              unoptimized
                            />
                          ) : (
                            <span>{a.kind === "video" ? "▶" : "♫"}</span>
                          )}
                        </button>
                        <div className="sequence-label">
                          <strong>{c.label}</strong>
                          <small>
                            {a.kind === "audio"
                              ? "Dialogue track"
                              : "Picture track"}
                          </small>
                        </div>
                        <label>
                          Seconds
                          <input
                            aria-label={`Duration of clip ${i + 1}`}
                            type="number"
                            min=".1"
                            max="600"
                            step=".1"
                            value={c.duration}
                            onChange={(e) =>
                              update((p) => ({
                                ...p,
                                clips: p.clips.map((x) =>
                                  x.id === c.id
                                    ? { ...x, duration: Number(e.target.value) }
                                    : x,
                                ),
                              }))
                            }
                          />
                        </label>
                        <button
                          disabled={i === 0}
                          aria-label={`Move clip ${i + 1} earlier`}
                          onClick={() =>
                            update((p) => {
                              const clips = [...p.clips];
                              [clips[i - 1], clips[i]] = [
                                clips[i],
                                clips[i - 1],
                              ];
                              return { ...p, clips };
                            })
                          }
                        >
                          ↑
                        </button>
                        <button
                          disabled={i === project.clips.length - 1}
                          aria-label={`Move clip ${i + 1} later`}
                          onClick={() =>
                            update((p) => {
                              const clips = [...p.clips];
                              [clips[i + 1], clips[i]] = [
                                clips[i],
                                clips[i + 1],
                              ];
                              return { ...p, clips };
                            })
                          }
                        >
                          ↓
                        </button>
                        <button
                          aria-label={`Remove clip ${i + 1}`}
                          onClick={() =>
                            update((p) => ({
                              ...p,
                              clips: p.clips.filter((x) => x.id !== c.id),
                            }))
                          }
                        >
                          Remove
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
              <p className="sequence-foot">
                Assembly handoff carries the real media manifest. Final master
                export remains behind the studio rubric.
              </p>
            </div>
          )}
        </div>
      </section>
      {plan && (
        <Modal
          title="Confirm the render"
          onClose={() => {
            if (!busy) setPlan(null);
          }}
        >
          <p>
            This submits {plan.items.length} paid provider request
            {plan.items.length === 1 ? "" : "s"}. Review the exact prompts and
            providers below. Rates are set by your provider accounts.
          </p>
          <div className="render-plan">
            {plan.items.map((i) => (
              <article key={i.nodeId}>
                <div>
                  <h3>{i.title}</h3>
                  <span>
                    {i.provider} · {i.aspect}
                    {i.kind !== "image" ? ` · ${i.duration}s` : ""}
                  </span>
                </div>
                <p>{i.prompt}</p>
                {i.reference && (
                  <small>
                    Connected image will be sent as the motion reference.
                  </small>
                )}
                {i.reason && <p className="error">{i.reason}</p>}
              </article>
            ))}
          </div>
          {plan.items.some((i) => i.kind === "voice") && (
            <label className="consent">
              <input
                type="checkbox"
                checked={voiceConsent}
                onChange={(e) => setVoiceConsent(e.target.checked)}
              />
              I am authorized to use the selected voice for this production.
            </label>
          )}
          <div className="modal-actions">
            {plan.items.some((i) => !i.ready) &&
              plan.items.some((i) => i.ready) && (
                <button
                  disabled={Boolean(busy)}
                  onClick={() =>
                    void act("Preparing ready nodes", () =>
                      prepare(
                        plan.items.filter((i) => i.ready).map((i) => i.nodeId),
                      ),
                    )
                  }
                >
                  Review only ready nodes
                </button>
              )}
            <button onClick={() => setPlan(null)} disabled={Boolean(busy)}>
              Back to graph
            </button>
            <button
              className="primary"
              disabled={
                Boolean(busy) ||
                plan.items.some((i) => !i.ready) ||
                (!voiceConsent && plan.items.some((i) => i.kind === "voice"))
              }
              onClick={() =>
                void act("Submitting confirmed jobs", async () => {
                  const data = await api({
                    action: "render",
                    projectId: plan.projectId,
                    nodeIds: plan.items.map((i) => i.nodeId),
                    confirmation: plan.confirmation,
                    voiceConsent,
                  });
                  setProject(data.project);
                  current.current = data.project;
                  setDirty(false);
                  setPlan(null);
                  setNotice(
                    "Job receipts saved. Outputs will appear here as providers finish.",
                  );
                })
              }
            >
              {busy || "Confirm paid render"}
            </button>
          </div>
        </Modal>
      )}
      {proposal && (
        <Modal
          title="Review the proposed workflow"
          onClose={() => setProposal(null)}
        >
          <p>
            Accepting creates a new project, preserving the current graph and
            its outputs.
          </p>
          <ol className="proposal-list">
            {proposal.nodes?.map((n) => (
              <li key={n.id}>
                <strong>{n.title}</strong>
                <span>
                  {NODE_KIND_LABEL[n.kind]} · {n.aspectRatio}
                </span>
                <p>{n.prompt}</p>
              </li>
            ))}
          </ol>
          <div className="modal-actions">
            <button onClick={() => setProposal(null)}>
              Keep current graph
            </button>
            <button
              className="primary"
              disabled={Boolean(busy)}
              onClick={() =>
                void act("Applying plan", async () => {
                  if (dirty) await persist();
                  const p = {
                    ...newProject("micro-drama"),
                    name: `${project.name} · agent plan`,
                    nodes: proposal.nodes!,
                    edges: proposal.edges!,
                    assets: [],
                    clips: [],
                  };
                  setProject(p);
                  current.current = p;
                  setSelected(p.nodes[0]?.id);
                  setDirty(true);
                  past.current = [];
                  future.current = [];
                  setHistoryDepth({ undo: 0, redo: 0 });
                  setProposal(null);
                  setNotice(
                    "Agent plan applied to a new project. Review prompts before rendering.",
                  );
                })
              }
            >
              Use this workflow
            </button>
          </div>
        </Modal>
      )}
      {preview && (
        <Modal title={preview.title} onClose={() => setPreview(null)}>
          <Media asset={preview} className="modal-media" />
          {preview.excerpt && (
            <pre className="document-preview">{preview.excerpt}</pre>
          )}
          <div className="modal-actions">
            {preview.kind !== "file" && (
              <button
                onClick={() => {
                  addToSequence(preview);
                  setPreview(null);
                }}
              >
                Add to sequence
              </button>
            )}
            <a href={preview.url} target="_blank" rel="noreferrer">
              Open original output ↗
            </a>
          </div>
        </Modal>
      )}
    </main>
  );
}
