import { DEFAULT_GRADE, gradeSummary, isRestraintGrade, type GradeParams } from "./grade";
import { RESTRAINT_RUBRIC, allRequiredPass } from "./restraint";
import { buildExportCommand, buildProxyCommand, canRun } from "./ffmpeg";
import { getCut, listCuts, probeStore } from "./store";
import { cancelJob, completeJob, createAndQueue, getJob, listJobs, pollJob, retryJob, submitJob } from "./jobstore";
import { PROVIDERS, hasCredentials } from "./providers";
import { idempotencyKeyFor } from "./idempotency";
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
      return {
        store: probe.backend,
        storeReachable: probe.reachable,
        storeError: probe.error,
        providers: PROVIDERS.map((p) => ({
          id: p.id,
          kind: p.kind,
          // Names and booleans only — never a credential value.
          credentialVar: p.envKey || undefined,
          credentialSet: p.envKey ? hasCredentials(p.id) : undefined,
          liveWired: p.id === "mock" || Boolean(p.endpoint),
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
      "Build an ffmpeg plan for a proxy or a master export. Returns the command and whether it is allowed to run. Export-class work is refused without a rubric pass — that refusal is the product working, not an error to route around.",
    inputSchema: obj(
      {
        kind: { type: "string", enum: ["proxy", "export"], description: "proxy or export" },
        inputPath: str("Source file path"),
        outputPath: str("Destination file path"),
        rubricPass: bool("Whether a rubric pass has been recorded for this cut"),
      },
      ["kind", "inputPath", "outputPath"]
    ),
    run: async (args) => {
      const kind = String(args.kind);
      const input = String(args.inputPath);
      const output = String(args.outputPath);
      const plan = kind === "export" ? buildExportCommand(input, output) : buildProxyCommand(input, output);
      const allowed = canRun(plan, Boolean(args.rubricPass));
      return {
        plan,
        allowed,
        reason: allowed ? undefined : "Master export requires a recorded rubric pass",
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
];

/** Tools a caller may see, given whether it authenticated. */
export function toolsFor(authenticated: boolean): Tool[] {
  return authenticated ? TOOLS : TOOLS.filter((t) => !t.mutating);
}

export function findTool(name: string, authenticated: boolean): Tool | undefined {
  return toolsFor(authenticated).find((t) => t.name === name);
}
