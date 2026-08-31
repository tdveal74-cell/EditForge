import type { Metadata } from "next";
import { BridgePanel } from "@/components/BridgePanel";

export const metadata: Metadata = { title: "MAM bridge" };

export default function Page() {
  return (
    <BridgePanel
      spec={{
        title: "MAM bridge",
        description:
          "Downloads a path-contract JSON with invented canonical paths. Not Drive, not S3, not Frame.io. /assets is the catalog; this file only names the tiers.",
        artifacts: ["paths"],
        engines: ["Google Drive", "Amazon S3", "Frame.io"],
        handoff: [
          { label: "Out", detail: "Canonical paths per asset — online, nearline, and archive tiers named separately." },
          { label: "Back", detail: "Checksums and tier location, so the catalog can say where a master really is." },
          { label: "Archive", detail: "3-2-1 enforced: two media types, one geo-separated copy. See docs/HARDWARE.md." },
          { label: "Gate", detail: "Nothing reaches cold archive without the /archive checklist complete." },
        ],
      }}
    />
  );
}
