import type { Metadata } from "next";
import { BridgePanel } from "@/components/BridgePanel";

export const metadata: Metadata = { title: "VFX engine bridge" };

export default function Page() {
  return (
    <BridgePanel
      spec={{
        title: "VFX engine bridge",
        description:
          "Shot packages out to comp and 3D. The tracking board stays on /vfx — this bridge only moves the work.",
        artifacts: ["shots"],
        engines: ["Fusion", "After Effects", "Houdini / Blender"],
        handoff: [
          { label: "Out", detail: "Shot package: plates, camera data, frame range, and the shot ID from the board." },
          { label: "Back", detail: "Rendered EXR sequence or pre-comp, conformed to the plate's colour space." },
          { label: "Farm", detail: "Heavy sims and final renders queue to the farm; the artist box is for lookdev." },
          { label: "Gate", detail: "Comp lands inside the restraint envelope — no hero look introduced downstream." },
        ],
      }}
    />
  );
}
