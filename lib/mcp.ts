import { DEFAULT_GRADE, gradeSummary, isRestraintGrade, type GradeParams } from "./grade";
import { RESTRAINT_RUBRIC, allRequiredPass } from "./restraint";
import { buildExportCommand, buildProxyCommand, canRun } from "./ffmpeg";
import { getCut, listCuts, probeStore } from "./store";
import { cancelJob, completeJob, createAndQueue, getJob, listJobs, pollJob, retryJob, submitJob } from "./jobstore";
import { PROVIDERS, hasCredentials, isLiveWired } from "./providers";
import { spendPolicyFromEnv } from "./spend-policy";
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
      const policy = spendPolicyFromEnv();
      const spendEnabled =
        policy.mode === "controlled" &&
        policy.billingEnabled &&
        policy.totalBudgetUsd > policy.spentUsd &&
        policy.perJobLimitUsd > 0;
      return {
        store: probe.backend,
        storeReachable: probe.reachable,
        storeError: probe.error,
        spendPolicy: {
          mode: policy.mode,
          billingEnabled: policy.billingEnabled,
          remainingBudgetUsd: Math.max(0, policy.totalBudgetUsd - policy.spentUsd),
          perJobLimitUsd: policy.perJobLimitUsd,
        },
        providers: PROVIDERS.map((p) => ({
          id: p.id,
          kind: p.kind,
          // Names and booleans only — never a credential value.
          credentialVar: p.envKey || undefined,
          credentialSet: p.envKey ? hasCredentials(p.id) : undefined,
          // Asks whether the provider's API shape is actually implemented, not
          // merely whether a base URL string was filled in. The old check read
          // `Boolean(p.endpoint)` and so reported Runway and ElevenLabs as live
          // while every submit to either was malformed — the status was the
          // last place you would have learned the live path did not work.
          liveWired: isLiveWired(p.id),
          spendEligible:
            p.id !== "mock" &&
            spendEnabled &&
            isLiveWired(p.id) &&
            hasCredentials(p.id) &&
            (p.rateEnvKey
              ? Number.isFinite(Number(process.env[p.rateEnvKey])) &&
                Number(process.env[p.rateEnvKey]) > 0
              : true),
        })),
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
];

/** Tools a caller may see, given whether it authenticated. */
export function toolsFor(authenticated: boolean): Tool[] {
  return authenticated ? TOOLS : TOOLS.filter((t) => !t.mutating);
}

export function findTool(name: string, authenticated: boolean): Tool | undefined {
  return toolsFor(authenticated).find((t) => t.name === name);
}
