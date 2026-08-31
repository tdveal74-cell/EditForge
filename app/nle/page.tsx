import type { Metadata } from "next";
import { BridgePanel } from "@/components/BridgePanel";

export const metadata: Metadata = { title: "NLE bridge" };

export default function Page() {
  return (
    <BridgePanel
      spec={{
        title: "NLE bridge",
        description:
          "Handoff to the edit suite. EditForge tracks the cut and its status; the binary timeline stays in the NLE. This page downloads a CMX3600 EDL — it does not run Resolve, Premiere, or Final Cut.",
        artifacts: ["edl"],
        engines: ["DaVinci Resolve", "Premiere Pro", "Final Cut Pro"],
        handoff: [
          { label: "Out", detail: "CMX3600 EDL, picture only, plus the cut ID. Audio conforms from the mix stem sheet." },
          { label: "Back", detail: "Locked timeline reference and a render path for the deliverable matrix." },
          { label: "Media", detail: "Shared-storage paths, never copies — proxies generated for remote review only." },
          { label: "Gate", detail: "Rubric decision stays in EditForge; the NLE cannot mark a cut shipped." },
        ],
      }}
    />
  );
}
