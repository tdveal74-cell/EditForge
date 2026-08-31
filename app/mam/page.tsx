import type { Metadata } from "next";
import { BridgePanel } from "@/components/BridgePanel";

export const metadata: Metadata = { title: "MAM bridge" };

export default function Page() {
  return (
    <BridgePanel
      spec={{
        title: "MAM bridge",
        description:
          "Downloads a catalog export of names and filed paths from /assets. Not Drive, not S3, not Frame.io. The /archive board is a sample checklist — this file does not enforce it and does not move media.",
        artifacts: ["catalog"],
        engines: ["Google Drive", "Amazon S3", "Frame.io"],
        handoff: [
          { label: "Out", detail: "Catalog export: filename, type, tags, and the path an operator filed — invented tiers, not a live connection." },
          { label: "Back", detail: "Nothing comes back. This file does not talk to Drive, S3, or Frame.io." },
          { label: "Archive", detail: "3-2-1 is house law in docs/HARDWARE.md. This file does not move a copy." },
          { label: "Gate", detail: "The /archive board is a sample checklist. This file does not enforce it." },
        ],
      }}
    />
  );
}
