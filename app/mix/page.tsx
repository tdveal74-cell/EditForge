import type { Metadata } from "next";
import { BridgePanel } from "@/components/BridgePanel";

export const metadata: Metadata = { title: "Mix bridge" };

export default function Page() {
  return (
    <BridgePanel
      spec={{
        title: "Mix bridge",
        description:
          "Downloads a mix session dump (ladder, clips per stem, loudness) and a stem sheet CSV. Not Fairlight, not Pro Tools, not a mixer. The hierarchy on /audio is law — this file realises it.",
        artifacts: ["session", "stems"],
        engines: ["Fairlight", "Pro Tools", "Atmos renderer"],
        handoff: [
          { label: "Out", detail: "Mix session JSON plus stem sheet: VO, primary SFX, music bed, ambience — split at the hierarchy boundaries." },
          { label: "Targets", detail: "Dialogue anchor −16 LUFS short-form, −23 LUFS broadcast; true peak −1 dBTP." },
          { label: "Back", detail: "Printed stems plus a mixdown matched to the picture lock." },
          { label: "Gate", detail: "Loudness audit is the mixer's; this file does not print a mix." },
        ],
      }}
    />
  );
}
