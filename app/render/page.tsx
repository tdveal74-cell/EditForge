import type { Metadata } from "next";
import { BridgePanel } from "@/components/BridgePanel";

export const metadata: Metadata = { title: "Render farm" };

export default function Page() {
  return (
    <BridgePanel
      spec={{
        title: "Render farm",
        description:
          "A handoff, not an engine. This page downloads the ffmpeg plan — it does not encode. The farm or a local worker runs the plan after a human confirms.",
        artifacts: ["plan"],
        engines: ["GPU encode nodes", "Hardware AV1 / HEVC", "Queue manager"],
        handoff: [
          { label: "Out", detail: "An ffmpeg plan JSON with an idempotency-ready command, never a command run on the spot." },
          { label: "Back", detail: "Encoded deliverable plus the job's terminal state — completed or failed with cause." },
          { label: "Scheduling", detail: "Long encodes belong on a worker, not on a grading box. Suites iterate; the farm renders." },
          { label: "Gate", detail: "Export-class jobs require a recorded rubric pass before they are authorized — the plan file itself says allowed: false when the cut has none." },
        ],
      }}
    />
  );
}
