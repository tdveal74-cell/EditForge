import { DEFAULT_GRADE, gradeSummary, isRestraintGrade, type GradeParams } from "./grade";
import { RESTRAINT_RUBRIC, allRequiredPass } from "./restraint";
import { buildExportCommand, buildProxyCommand, canRun } from "./ffmpeg";
import { getCut, listCuts, probeStore } from "./store";
import { cancelJob, completeJob, createAndQueue, getJob, listJobs, pollJob, retryJob, submitJob } from "./jobstore";
import { PROVIDERS, credentialKeysFor, hasCredentials, providerReadiness } from "./providers";
import { artifactStoreConfigured } from "./artifacts";
import { listSourceAssets, sourceCatalogConfigured } from "./source-catalog";
import { idempotencyKeyFor } from "./idempotency";
import { listRolls, reviewRoll, selectForCut } from "./dailies";
import { addShot, listShots, setShotStatus, shotsForCut } from "./vfxboard";
import { SHOT_STATUSES, isShotStatus } from "./vfxShot";
import {
  LOUDNESS_TARGETS,
  TIMEBASES,
  buildEDL,
  buildPathContract,
  buildShotPackage,
  buildStemSheet,
  slug,
  type Timebase,
} from "./handoff";
import { SAMPLE_TIMELINE } from "./timeline";
import type { JobKind } from "./jobs";
import { getProject, listProjects, saveProject } from "@/modules/canvas/server-store";
import { newProject } from "@/modules/canvas/model";
import { renderPlan } from "@/modules/canvas/render";
import { TEMPLATES } from "@/modules/canvas/templates";
import { addAsset, addStock, listAssets, listStock } from "./catalog";
import { commandNeedsRubric, validateEditCommand, type EditCommand } from "./editing";
import {
  acceptEditCommand,
  cancelEditExecution,
  getEditExecution,
  listEditExecutions,
  markDispatchFailed,
  markDispatched,
  recordWorkerReceipt,
} from "./editstore";
import { cancelWorker, dispatchToWorker, pollWorker } from "./edit-worker";
import { POST as planGenVideoRoute } from "@/app/api/gen-video/plan/route";
import { POST as planVoiceRoute } from "@/app/api/voice/plan/route";
import { POST as planAvatarRoute } from "@/app/api/avatar/plan/route";

/** The planners are pure and live in their routes; call them rather than copy them. */
async function viaPlanner(handler: (req: Request) => Promise<Response>, body: Record<string, unknown>) {
  const res = await handler(
    new Request("http://editforge.local/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
  return res.json();
}

/**
 * EditForge as an MCP server.
 *
 * The studio's judgment — the restraint envelope, the rubric gate, the spend
 * boundary — is the part worth exposing to an assistant. So the tools here are
 * not a thin REST mirror: the read tools answer questions, and the write tools
 * go through the same gates the UI does. Nothing here can bypass `authorizeJob`
 * or the provider boundary.
 */

export const PROTOCOL_VERSION = "2025-06-18";
export const SERVER_INFO = { name: "editforge", version: "1.0.0" };

/**
 * Revisions this server can speak. Nothing here uses a feature that differs
 * between them — it is plain tool listing and calling — so a client pinned to
 * an older revision is answered in its own version rather than being handed a
 * newer one it may refuse.
 */
const SUPPORTED_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];

export function negotiateVersion(requested?: unknown): string {
  const asked = typeof requested === "string" ? requested : "";
  return SUPPORTED_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSION;
}

export type Tool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /** Write tools require a configured token; without one they are not offered. */
  mutating?: boolean;
  /**
   * Reads that expose private data are gated too. Not every gated tool is a
   * write: the source catalogue is metadata about media the studio deliberately
   * does not publish, and `/api/sources` already answers it with a 401. Marking
   * it `mutating` would have gated it correctly and described it wrongly.
   */
  privileged?: boolean;
  run: (args: Record<string, never> & Record<string, unknown>) => Promise<unknown>;
};

const obj = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});

const str = (description: string) => ({ type: "string", description });
const num = (description: string) => ({ type: "number", description });
const bool = (description: string) => ({ type: "boolean", description });

const MEDIA_KINDS: JobKind[] = ["gen-video", "voice", "avatar"];

export const TOOLS: Tool[] = [
  {
    name: "editforge_status",
    description:
      "Health of the EditForge studio: which durable store is active and reachable, and which providers could actually run live work right now. Call this first when something is not behaving as expected.",
    inputSchema: obj({}),
    run: async () => {
      const probe = await probeStore();
      const artifactStore = artifactStoreConfigured();
      return {
        store: probe.backend,
        storeReachable: probe.reachable,
        storeError: probe.error,
        // Providers that answer with the media itself have nowhere to put it
        // without this, so a voice run refuses when it is false.
        artifactStore,
        providers: PROVIDERS.map((p) => {
          const readiness = providerReadiness(p, { artifactStore });
          return {
            id: p.id,
            kind: p.kind,
            // Names and booleans only — never a credential value.
            credentialVar: p.envKey || undefined,
            credentialVars: credentialKeysFor(p),
            credentialSet: p.envKey ? hasCredentials(p.id) : undefined,
            // Asks whether the provider's API shape is actually implemented, not
            // merely whether a base URL string was filled in. The old check read
            // `Boolean(p.endpoint)` and so reported Runway and ElevenLabs as live
            // while every submit to either was malformed — the status was the
            // last place you would have learned the live path did not work.
            liveWired: readiness.wired,
            // The further env this provider still needs before a live run is
            // accepted. An avatar render refused for a missing look id reads as
            // a credential problem until this says otherwise.
            settingsMissing: readiness.settingsMissing,
            readyToRun: p.id === "mock" || readiness.ready,
          };
        }),
      };
    },
  },
  {
    name: "check_restraint_grade",
    description:
      "Judge colour grade parameters against the EditForge restraint envelope. Returns whether the grade is within the envelope and a human summary. Use before recommending any grade — EditForge protects the image rather than restaging it.",
    inputSchema: obj({
      exposure: num("-0.5 to 0.5"),
      contrast: num("-0.5 to 0.5"),
      saturation: num("-0.5 to 0.5"),
      temperature: num("-0.5 to 0.5"),
      vignette: num("0 to 0.5; allowed further than the signed parameters"),
    }),
    run: async (args) => {
      const g: GradeParams = { ...DEFAULT_GRADE };
      for (const k of Object.keys(DEFAULT_GRADE) as (keyof GradeParams)[]) {
        if (typeof args[k] === "number") g[k] = args[k] as number;
      }
      return { params: g, withinEnvelope: isRestraintGrade(g), summary: gradeSummary(g) };
    },
  },
  {
    name: "restraint_rubric",
    description:
      "The EditForge restraint rubric. Called with no arguments it returns the checklist; called with results it reports whether the cut passes. A master export is blocked until every required check passes.",
    inputSchema: obj({
      results: {
        type: "object",
        description: "Map of check id to boolean, e.g. {\"subtle-grade\": true}",
        additionalProperties: { type: "boolean" },
      },
    }),
    run: async (args) => {
      const checks = RESTRAINT_RUBRIC;
      const results = (args.results ?? null) as Record<string, boolean> | null;
      if (!results) return { checks, note: "Pass a results map to evaluate a cut against these." };
      const missing = checks.filter((c) => c.required && results[c.id] === undefined).map((c) => c.id);
      return {
        checks,
        passed: allRequiredPass(results),
        missing,
        failing: checks.filter((c) => results[c.id] === false).map((c) => c.id),
      };
    },
  },
  {
    name: "list_sources",
    description:
      "Inventory the private source media mounted into the studio: name, editforge-source URI, SHA-256, byte length, and modified time. Metadata only — never media bytes. Bind an edit command to the sha256 of the exact asset; a filename that looks like a hash is not the content hash.",
    privileged: true,
    inputSchema: obj({}),
    run: async () => {
      // Say "not configured" rather than throwing. A studio with no media
      // mounted is a normal deployment, not a failure, and the caller needs to
      // tell that apart from a catalogue it is simply not allowed to read.
      if (!sourceCatalogConfigured()) {
        return { configured: false, assets: [], reason: "EDITFORGE_SOURCE_MEDIA_DIR is not set on this server" };
      }
      return { configured: true, assets: await listSourceAssets() };
    },
  },
  {
    name: "plan_transcode",
    description:
      "Build an ffmpeg plan for a proxy or a master export. Returns the command and whether it is allowed to run. An export must name the cut whose recorded rubric decision authorises it; the refusal is the product working, not an error to route around.",
    inputSchema: obj(
      {
        kind: { type: "string", enum: ["proxy", "export"], description: "proxy or export" },
        inputPath: str("Source file path"),
        outputPath: str("Destination file path"),
        cutId: str("The cut whose recorded rubric decision authorises an export. Required for export."),
      },
      ["kind", "inputPath", "outputPath"]
    ),
    run: async (args) => {
      const kind = String(args.kind);
      const input = String(args.inputPath);
      const output = String(args.outputPath);
      const plan = kind === "export" ? buildExportCommand(input, output) : buildProxyCommand(input, output);

      if (kind !== "export") {
        return { plan, allowed: true, reason: "Proxy — ungated. Run after human confirm" };
      }

      // Read the decision, never accept it. This tool used to take a
      // `rubricPass` boolean and hand it to `canRun`, which meant an assistant
      // could authorise its own master export by asserting the cut had passed —
      // the same hole the HTTP route had, on the surface an assistant actually
      // drives.
      const cutId = String(args.cutId || "").trim();
      if (!cutId) {
        return {
          plan,
          allowed: false,
          reason: "Blocked: an export must name the cut whose rubric decision authorises it",
        };
      }

      const cut = await getCut(cutId);
      if (!cut) {
        return { plan, allowed: false, reason: `Blocked: no cut "${cutId}" in the store` };
      }

      const allowed = canRun(plan, Boolean(cut.rubricPass));
      return {
        plan,
        allowed,
        cut: { id: cut.id, title: cut.title, rubricPass: Boolean(cut.rubricPass) },
        reason: allowed
          ? `Authorised by the recorded rubric pass on "${cut.title}" — run after human confirm`
          : `Blocked: "${cut.title}" has no recorded rubric pass`,
      };
    },
  },
  {
    name: "list_cuts",
    description: "Every cut in the studio's durable store, with status and rubric state.",
    inputSchema: obj({}),
    run: async () => ({ cuts: await listCuts() }),
  },
  {
    name: "get_cut",
    description: "One cut by id.",
    inputSchema: obj({ id: str("Cut id") }, ["id"]),
    run: async (args) => {
      const cut = await getCut(String(args.id));
      return cut ? { cut } : { error: `No cut with id ${String(args.id)}` };
    },
  },
  {
    name: "list_jobs",
    description: "Provider jobs in the durable store, with their lifecycle state, provider, and mode (mock or live).",
    inputSchema: obj({}),
    run: async () => ({ jobs: await listJobs() }),
  },
  {
    name: "get_job",
    description: "One job by id, including its error and attempt count if it has failed.",
    inputSchema: obj({ id: str("Job id") }, ["id"]),
    run: async (args) => {
      const job = await getJob(String(args.id));
      return job ? { job } : { error: `No job with id ${String(args.id)}` };
    },
  },
  {
    name: "submit_media_job",
    description:
      "Create a media job and hand it to a provider. THIS CAN SPEND MONEY when the provider has credentials configured — call editforge_status first and prefer provider 'mock' unless the user has asked for a real render. Submitting the same brief twice returns the original job rather than starting a second render.",
    mutating: true,
    inputSchema: obj(
      {
        kind: { type: "string", enum: MEDIA_KINDS, description: "gen-video, voice, or avatar" },
        prompt: str("The brief sent to the provider"),
        provider: str("Provider id; 'mock' runs offline and never bills"),
        label: str("Human-readable name for the job record"),
        requiresRubricPass: bool("Set for master-class work; refuses without a passing rubric decision"),
      },
      ["kind", "prompt"]
    ),
    run: async (args) => {
      const kind = String(args.kind) as JobKind;
      if (!MEDIA_KINDS.includes(kind)) return { error: `kind must be one of ${MEDIA_KINDS.join(", ")}` };
      const prompt = String(args.prompt ?? "").trim();
      if (!prompt) return { error: "prompt required" };

      const provider = String(args.provider ?? "mock");
      const label = String(args.label ?? `${kind} render`);
      // Derived, not random: a repeated call with the same brief is one job.
      const idempotencyKey = idempotencyKeyFor(kind, { prompt, provider });

      try {
        const job = await createAndQueue({
          kind,
          label,
          note: "Queued via MCP",
          idempotencyKey,
          requiresRubricPass: Boolean(args.requiresRubricPass),
        });
        if (job.status !== "queued") return { job, deduped: true };
        const submitted = await submitJob(job.id, { provider, prompt });
        return { job: submitted ?? job };
      } catch (err) {
        // The rubric gate refusing is a legitimate answer, not a crash.
        return { error: (err as Error).message };
      }
    },
  },
  {
    name: "drive_job",
    description:
      "Advance a job: poll it against its provider, accept a validated result, retry a failure, or cancel. Illegal transitions are refused — the state machine is the authority on what can happen next.",
    mutating: true,
    inputSchema: obj(
      {
        id: str("Job id"),
        action: { type: "string", enum: ["poll", "complete", "retry", "cancel"], description: "What to do" },
      },
      ["id", "action"]
    ),
    run: async (args) => {
      const id = String(args.id);
      const action = String(args.action);
      const fns = { poll: pollJob, complete: completeJob, retry: retryJob, cancel: cancelJob };
      if (!(action in fns)) return { error: `action must be one of ${Object.keys(fns).join(", ")}` };
      try {
        const job = await fns[action as keyof typeof fns](id);
        return job ? { job } : { error: `No job with id ${id}` };
      } catch (err) {
        return { error: (err as Error).message };
      }
    },
  },
  {
    name: "list_dailies",
    description:
      "Day rolls and the review decision recorded against each — approved, rejected, or not yet reviewed, plus which cut a roll has been let into.",
    inputSchema: obj({}),
    run: async () => ({ rolls: await listRolls() }),
  },
  {
    name: "review_daily",
    description:
      "Record an approve or reject decision on a day roll, with an optional reason. Rejecting also removes the roll from any cut it had entered.",
    mutating: true,
    inputSchema: obj(
      {
        id: str("Roll id"),
        decision: { type: "string", enum: ["approve", "reject"], description: "The decision to record" },
        note: str("Why — kept with the decision"),
      },
      ["id", "decision"]
    ),
    run: async (args) => {
      const decision = String(args.decision);
      if (decision !== "approve" && decision !== "reject") {
        return { error: 'decision must be "approve" or "reject"' };
      }
      const roll = await reviewRoll(
        String(args.id),
        decision,
        args.note === undefined ? undefined : String(args.note)
      );
      return roll ? { roll } : { error: `No roll with id ${String(args.id)}` };
    },
  },
  {
    name: "select_daily_for_cut",
    description:
      "Put a day roll into a cut. Refused unless an approval is recorded against that roll — the refusal is the product working, not an error to route around. The decision is read from the store, so asserting a status here does nothing.",
    mutating: true,
    inputSchema: obj({ id: str("Roll id"), cutId: str("Cut to select it into") }, ["id", "cutId"]),
    run: async (args) => {
      const cutId = String(args.cutId);
      if (!(await getCut(cutId))) return { error: `No cut with id ${cutId}` };

      const result = await selectForCut(String(args.id), cutId);
      return result.ok
        ? { roll: result.roll, allowed: true }
        : { allowed: false, reason: result.reason, status: result.status };
    },
  },
  {
    name: "list_vfx_shots",
    description: "The VFX shot board — every shot, its status, engine, and the cut it belongs to.",
    inputSchema: obj({ cutId: str("Only shots filed against this cut") }),
    run: async (args) => {
      const cutId = args.cutId ? String(args.cutId) : "";
      return { shots: cutId ? await shotsForCut(cutId) : await listShots() };
    },
  },
  {
    name: "move_vfx_shot",
    description:
      "Move a shot's status on the board, or add a shot to it. A duplicate id is refused rather than merged — the id is the conform key between the board, the shot package, and the compositor's filename.",
    mutating: true,
    inputSchema: obj(
      {
        action: { type: "string", enum: ["status", "add"], description: "Move an existing shot, or add one" },
        id: str("Shot id, e.g. VFX_040"),
        status: { type: "string", enum: [...SHOT_STATUSES], description: "Required for a status move" },
        desc: str("What the shot is — required when adding"),
        engine: str("Where the comp happens"),
        cutId: str("Cut this shot belongs to"),
        note: str("Note kept against the move"),
      },
      ["action", "id"]
    ),
    run: async (args) => {
      const id = String(args.id);

      if (String(args.action) === "add") {
        const result = await addShot({
          id,
          desc: String(args.desc ?? ""),
          engine: String(args.engine ?? ""),
          cutId: args.cutId ? String(args.cutId) : undefined,
        });
        return result.ok ? { shot: result.shot } : { error: result.reason };
      }

      const status = String(args.status ?? "");
      if (!isShotStatus(status)) return { error: `status must be one of ${SHOT_STATUSES.join(", ")}` };
      const shot = await setShotStatus(id, status, args.note === undefined ? undefined : String(args.note));
      return shot ? { shot } : { error: `No shot with id ${id}` };
    },
  },
  {
    name: "build_handoff",
    description:
      "Build the artifact that crosses an engine bridge for a cut: a CMX3600 EDL for picture conform, a stem sheet for the mix, a shot package for comp, or the storage path contract. Returns the file's text — an assistant can hand it straight to whoever is conforming. Read-only: nothing here spends money or changes a cut.",
    inputSchema: obj(
      {
        kind: {
          type: "string",
          enum: ["edl", "stems", "shots", "paths"],
          description: "Which artifact to build",
        },
        cutId: str("The cut the artifact describes"),
        fps: {
          type: "number",
          enum: [...TIMEBASES],
          description: "Timebase for edl and shots. Whole-number rates only — 23.976 and 29.97 need drop-frame arithmetic this does not compute.",
        },
        target: {
          type: "string",
          enum: LOUDNESS_TARGETS.map((t) => t.id),
          description: "Delivery target for the stem sheet",
        },
      },
      ["kind", "cutId"]
    ),
    run: async (args) => {
      const cutId = String(args.cutId);
      const cut = await getCut(cutId);
      if (!cut) return { error: `No cut with id ${cutId}` };

      // Same refusal as the HTTP route: a timebase we do not compute correctly
      // is declined rather than coerced into one that drifts.
      let fps: Timebase = 25;
      if (args.fps !== undefined) {
        const n = Number(args.fps);
        if (!TIMEBASES.includes(n as Timebase)) {
          return { error: `fps must be one of ${TIMEBASES.join(", ")}` };
        }
        fps = n as Timebase;
      }

      const clips = cut.clips ?? SAMPLE_TIMELINE;
      const assemblySource = cut.clips ? "cut assembly" : "sample assembly";

      switch (String(args.kind)) {
        case "edl":
          return {
            filename: `${slug(cut.title) || cut.id}_${fps}fps.edl`,
            assemblySource,
            content: buildEDL({ title: `${cut.title} (${assemblySource})`, clips, fps }),
          };

        case "stems": {
          const target = LOUDNESS_TARGETS.find((t) => t.id === String(args.target ?? "shortform"));
          if (!target) {
            return { error: `target must be one of ${LOUDNESS_TARGETS.map((t) => t.id).join(", ")}` };
          }
          return {
            filename: `${slug(cut.title) || cut.id}_stems_${target.id}.csv`,
            assemblySource,
            content: buildStemSheet({ title: cut.title, clips, target }),
          };
        }

        case "shots":
          return {
            filename: `${slug(cut.title) || cut.id}_shots.json`,
            assemblySource,
            content: buildShotPackage({
              title: cut.title,
              clips,
              fps,
              colorSpace: "ACEScct",
              board: await shotsForCut(cut.id),
            }),
          };

        case "paths":
          return {
            filename: `${slug(cut.title) || cut.id}_paths.json`,
            content: buildPathContract({ cutId: cut.id, title: cut.title }),
          };

        default:
          return { error: "kind must be one of edl, stems, shots, paths" };
      }
    },
  },
  {
    name: "canvas_list_projects",
    description:
      "Canvas department (editforge.online/canvas): the saved shot graph projects, newest first, and the templates a new project can start from. Micro Drama is the series template.",
    privileged: true,
    inputSchema: obj({}),
    run: async () => ({
      projects: (await listProjects()).map(({ id, name, templateId, updatedAt, revision }) => ({
        id,
        name,
        templateId,
        updatedAt,
        revision,
      })),
      templates: TEMPLATES.map(({ id, name, category, tagline }) => ({ id, name, category, tagline })),
    }),
  },
  {
    name: "canvas_get_project",
    description:
      "One Canvas project in full: its nodes (brief, still, motion, look, dialogue, output), the edges connecting them, library assets and the cut sequence. Save changes with canvas_save_project, passing back the revision you read.",
    privileged: true,
    inputSchema: obj({ id: str("Project id") }, ["id"]),
    run: async (args) => {
      const project = await getProject(String(args.id));
      return project ? { project } : { error: `No Canvas project with id ${String(args.id)}` };
    },
  },
  {
    name: "canvas_create_project",
    description:
      "Start a Canvas project from a template, with the brief written into its brief node. Nothing renders and nothing is spent: generation happens only when a signed-in person renders from the Canvas page.",
    mutating: true,
    inputSchema: obj(
      {
        templateId: str("Template id from canvas_list_projects, e.g. micro-drama"),
        name: str("Project name; defaults to the template name"),
        brief: str("The brief for the brief node, under 6,000 characters"),
      },
      ["templateId"]
    ),
    run: async (args) => {
      const templateId = String(args.templateId);
      if (!TEMPLATES.some((t) => t.id === templateId)) {
        return { error: `templateId must be one of ${TEMPLATES.map((t) => t.id).join(", ")}` };
      }
      const draft = newProject(templateId, args.brief === undefined ? undefined : String(args.brief));
      const name = args.name === undefined ? "" : String(args.name).trim();
      if (name) draft.name = name;
      try {
        return { project: await saveProject(draft) };
      } catch (err) {
        return { error: (err as Error).message };
      }
    },
  },
  {
    name: "canvas_save_project",
    description:
      "Save a whole Canvas project: edit what canvas_get_project returned and send it back with the same revision. A project changed since you read it is refused rather than overwritten; read it again and reapply. Validation is the same as the Canvas page: at most 60 nodes and 120 edges. Saving never renders or spends.",
    mutating: true,
    inputSchema: obj({ project: { type: "object", description: "The full project, including id and revision" } }, ["project"]),
    run: async (args) => {
      try {
        const saved = await saveProject(args.project as never);
        return { project: saved };
      } catch (err) {
        return { error: (err as Error).message };
      }
    },
  },
  {
    name: "canvas_render_plan",
    description:
      "Preview what rendering some Canvas nodes would do: per node, the provider, the prompt with its connected context, duration, aspect, and whether it is ready or why not. Read-only. There is no render tool here on purpose: paid generation from Canvas is started by a signed-in person on the Canvas page.",
    privileged: true,
    inputSchema: obj(
      {
        projectId: str("Project id"),
        nodeIds: { type: "array", items: { type: "string" }, description: "1 to 12 still, motion or dialogue node ids" },
      },
      ["projectId", "nodeIds"]
    ),
    run: async (args) => {
      const project = await getProject(String(args.projectId));
      if (!project) return { error: `No Canvas project with id ${String(args.projectId)}` };
      const raw: unknown = args.nodeIds;
      const ids = Array.isArray(raw) ? raw.map(String) : [];
      try {
        const { items, projectId, revision } = renderPlan(project, ids);
        return { projectId, revision, items };
      } catch (err) {
        return { error: (err as Error).message };
      }
    },
  },
  {
    name: "list_edits",
    description:
      "Edit executions on the edit worker: each DEVON edit command, its status (accepted, dispatched, running, validating, completed, failed, cancelled) and its receipt.",
    privileged: true,
    inputSchema: obj({}),
    run: async () => ({ executions: await listEditExecutions() }),
  },
  {
    name: "get_edit",
    description: "One edit execution by command id. Set poll to ask the edit worker for a fresh receipt first.",
    privileged: true,
    inputSchema: obj({ id: str("Command id"), poll: bool("Ask the worker for the latest receipt") }, ["id"]),
    run: async (args) => {
      const id = String(args.id);
      let execution = await getEditExecution(id);
      if (!execution) return { error: `No edit execution with id ${id}` };
      if (args.poll === true && execution.workerJobId) {
        const receipt = await pollWorker(execution.workerJobId);
        if (receipt) execution = (await recordWorkerReceipt(id, receipt)) ?? execution;
      }
      return { execution };
    },
  },
  {
    name: "submit_edit",
    description:
      "Send one edit command (schema editforge.edit-command.v1) to the edit worker: trim, split, reorder, captions, audio mix, grade, titles, voice, assemble an episode, derive a short, render a preview. The command must carry Tee's approval id and, for his likeness or voice, consentRecorded. A master render is refused unless the cut has a recorded rubric pass, which only Tee records. Resubmitting the same commandId returns the original execution rather than running it twice. Synthesis and full-motion operations can spend money.",
    mutating: true,
    inputSchema: obj({ command: { type: "object", description: "The full edit command, schema editforge.edit-command.v1" } }, ["command"]),
    run: async (args) => {
      const issues = validateEditCommand(args.command);
      if (issues.some((issue) => issue.severity === "error")) {
        return { error: "invalid edit command", issues, executed: false };
      }
      const command = args.command as unknown as EditCommand;
      if (commandNeedsRubric(command)) {
        const cut = await getCut(command.cutId);
        if (!cut?.rubricPass) {
          return { error: `master render blocked: cut ${command.cutId} has no recorded rubric pass`, executed: false };
        }
      }
      try {
        const accepted = await acceptEditCommand(command);
        if (accepted.deduped) return { execution: accepted.execution, deduped: true, executed: false };
        const dispatched = await dispatchToWorker(accepted.execution);
        if (!dispatched.ok) {
          return { error: dispatched.error, execution: await markDispatchFailed(command.commandId, dispatched.error), executed: false };
        }
        return { execution: await markDispatched(command.commandId, dispatched.workerJobId), deduped: false, executed: true };
      } catch (err) {
        return { error: (err as Error).message, executed: false };
      }
    },
  },
  {
    name: "drive_edit",
    description: "Cancel an edit execution, or retry one that failed. Other transitions are refused.",
    mutating: true,
    inputSchema: obj(
      { id: str("Command id"), action: { type: "string", enum: ["cancel", "retry"], description: "What to do" } },
      ["id", "action"]
    ),
    run: async (args) => {
      const id = String(args.id);
      const existing = await getEditExecution(id);
      if (!existing) return { error: `No edit execution with id ${id}` };
      try {
        if (args.action === "cancel") {
          if (existing.workerJobId) await cancelWorker(existing.workerJobId);
          return { execution: await cancelEditExecution(id) };
        }
        if (args.action === "retry") {
          if (existing.status !== "failed") return { error: `cannot retry ${existing.status} execution` };
          const dispatched = await dispatchToWorker(existing);
          if (!dispatched.ok) return { error: dispatched.error, execution: await markDispatchFailed(id, dispatched.error) };
          return { execution: await markDispatched(id, dispatched.workerJobId), executed: true };
        }
        return { error: "action must be cancel or retry" };
      } catch (err) {
        return { error: (err as Error).message };
      }
    },
  },
  {
    name: "list_assets",
    description: "The studio's asset catalog: every filed asset with its type, tags and location.",
    inputSchema: obj({}),
    run: async () => ({ assets: await listAssets() }),
  },
  {
    name: "add_asset",
    description: "File an asset in the catalog. A name already in the catalog is refused rather than duplicated.",
    mutating: true,
    inputSchema: obj(
      {
        name: str("Filename"),
        type: str("Asset type, as the catalog defines it"),
        tags: { type: "array", items: { type: "string" }, description: "Search tags" },
        location: str("Where the file lives"),
      },
      ["name", "type"]
    ),
    run: async (args) => {
      const tags: unknown = args.tags;
      const result = await addAsset({
        name: String(args.name ?? ""),
        type: String(args.type ?? ""),
        tags: Array.isArray(tags) ? tags.map(String) : undefined,
        location: args.location === undefined ? undefined : String(args.location),
      });
      return result.ok ? { asset: result.item } : { error: result.reason };
    },
  },
  {
    name: "list_stock",
    description: "The stock library: licensed music, SFX and footage, each with its licence note.",
    inputSchema: obj({}),
    run: async () => ({ stock: await listStock() }),
  },
  {
    name: "add_stock",
    description: "File a stock item. A licence note is required; it travels with the item to archive.",
    mutating: true,
    inputSchema: obj(
      {
        kind: str("Stock kind, as the library defines it"),
        title: str("Title"),
        mood: str("Mood"),
        durationSec: num("Duration in seconds"),
        licenseNote: str("Licence terms"),
      },
      ["kind", "title", "licenseNote"]
    ),
    run: async (args) => {
      const result = await addStock({
        kind: String(args.kind ?? ""),
        title: String(args.title ?? ""),
        mood: args.mood === undefined ? undefined : String(args.mood),
        durationSec: typeof args.durationSec === "number" ? args.durationSec : undefined,
        licenseNote: String(args.licenseNote ?? ""),
      });
      return result.ok ? { stock: result.item } : { error: result.reason };
    },
  },
  {
    name: "plan_gen_video",
    description: "Plan a generated video shot: provider choice, readiness, duration, aspect and quality bar. Read-only; nothing is submitted.",
    inputSchema: obj({
      prompt: str("The shot brief"),
      provider: str("Preferred provider"),
      durationSec: num("2 to 10 seconds"),
      aspect: str("Aspect ratio"),
      quality: { type: "string", enum: ["draft", "social", "broadcast-intent"], description: "Quality bar" },
      mode: str("text-to-video or image-to-video"),
    }),
    run: async (args) => viaPlanner(planGenVideoRoute, args),
  },
  {
    name: "plan_voice",
    description: "Plan a voice line: which voice, estimated length, and whether the voice lane is ready. Read-only; nothing is synthesized.",
    inputSchema: obj({ text: str("The line"), voiceId: str("Voice id") }),
    run: async (args) => viaPlanner(planVoiceRoute, args),
  },
  {
    name: "plan_avatar",
    description: "Plan an avatar or talking head render: the flow and the settings it needs. Read-only; nothing is rendered.",
    inputSchema: obj({ prompt: str("The brief"), designSource: str("Design source") }),
    run: async (args) => viaPlanner(planAvatarRoute, args),
  },
  {
    name: "ship_to_n8n",
    description:
      "Hand an approved master to n8n: writes one render row and one Pending publishing slot per platform, which V5's repurpose lane drops into each platform's folder at 9:00 or 21:00 New York once the slot's time has passed. Call this ONLY after Tee has said ship in the thread, and put who approved it and when in approvedBy. This does not post anything itself. Resending the same frameId updates its rows rather than duplicating them.",
    mutating: true,
    inputSchema: obj(
      {
        frameId: str("Asset id: lane code, date, slug, e.g. TQO-2026-09-24-first-cut"),
        outputUrl: str("https URL of the approved master that n8n can download"),
        brand: {
          type: "string",
          enum: ["The Quiet Operator", "The Shadow We Share", "NCO Forge", "Ascension Caudex"],
          description: "The lane's brand",
        },
        approvedBy: str("Who said ship, and when"),
        modelUsed: str("Provider or model that made the master"),
        qcNotes: str("What was checked"),
        slots: {
          type: "array",
          description: "1 to 12 platforms",
          items: {
            type: "object",
            properties: {
              platform: str("YouTube, YouTube Shorts, TikTok, Instagram, Facebook, LinkedIn, X, Threads, Pinterest, Newsletter, Community, Blog or Podcast"),
              scheduledFor: str("ISO 8601 time the slot becomes due"),
              caption: str("Approved caption"),
            },
            required: ["platform", "scheduledFor"],
            additionalProperties: false,
          },
        },
      },
      ["frameId", "outputUrl", "brand", "approvedBy", "slots"]
    ),
    run: async (args) => {
      const token = process.env.EDITFORGE_MCP_TOKEN?.trim();
      if (!token) return { error: "EDITFORGE_MCP_TOKEN is not set on this server, so n8n cannot authenticate the handoff." };
      const url = process.env.EDITFORGE_N8N_HANDOFF_URL?.trim() || "https://n8n.editforge.online/webhook/bot-handoff";
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(args),
          signal: AbortSignal.timeout(20000),
        });
        const text = await res.text();
        let body: unknown = text;
        try {
          body = JSON.parse(text);
        } catch {
          // n8n answers plain text for some refusals; pass it through as is.
        }
        return res.ok ? { handedOff: true, status: res.status, n8n: body } : { error: `n8n answered HTTP ${res.status}`, n8n: body };
      } catch (err) {
        return { error: `could not reach n8n: ${(err as Error).name}` };
      }
    },
  },
];

/** Tools a caller may see, given whether it authenticated. */
export function toolsFor(authenticated: boolean): Tool[] {
  return authenticated ? TOOLS : TOOLS.filter((t) => !t.mutating && !t.privileged);
}

export function findTool(name: string, authenticated: boolean): Tool | undefined {
  return toolsFor(authenticated).find((t) => t.name === name);
}
