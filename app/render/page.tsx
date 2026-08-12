import type { Metadata } from "next";
import { BridgePanel } from "@/components/BridgePanel";

export const metadata: Metadata = { title: "Render farm" };

export default function Page() {
  return (
    <BridgePanel
      spec={{
        title: "Render farm",
        description:
          "The worker encode queue. Plans are built on /jobs, /export, and /longform — the farm executes them after a human confirms.",
        engines: ["GPU encode nodes", "Hardware AV1 / HEVC", "Queue manager"],
        handoff: [
          { label: "Out", detail: "An ffmpeg plan with an idempotency key, never a command run on the spot." },
          { label: "Back", detail: "Encoded deliverable plus the job's terminal state — completed or failed with cause." },
          { label: "Scheduling", detail: "Long encodes belong here, not on a grading box. Suites iterate; the farm renders." },
          { label: "Gate", detail: "Export-class jobs require a recorded rubric pass before they are authorized." },
        ],
      }}
    />
  );
}
