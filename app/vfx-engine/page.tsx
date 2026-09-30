import type { Metadata } from "next";
import { BridgePanel } from "@/components/BridgePanel";

export const metadata: Metadata = { title: "VFX engine bridge" };

export default function Page() {
  return (
    <BridgePanel
      spec={{
        title: "VFX engine bridge",
        description:
          "Downloads a compositor node graph (Loaders, Merges, Saver) plus a shot package. Not Fusion, not After Effects, not a running comp. The tracking board stays on /vfx.",
        artifacts: ["graph", "shots"],
        engines: ["Fusion", "After Effects", "Houdini / Blender"],
        handoff: [
          { label: "Out", detail: "Node graph JSON: one Loader per plate, a Merge chain, a Saver. Frame ranges, not pixels." },
          { label: "Back", detail: "Rendered EXR sequence or pre-comp, conformed to the plate's colour space." },
          { label: "Farm", detail: "Heavy sims and final renders queue to the farm; the artist box is for lookdev." },
          { label: "Gate", detail: "Comp lands inside the restraint envelope — no hero look introduced downstream." },
        ],
      }}
    />
  );
}
