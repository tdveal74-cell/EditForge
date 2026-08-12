import type { Metadata } from "next";
import { BridgePanel } from "@/components/BridgePanel";

export const metadata: Metadata = { title: "Mix bridge" };

export default function Page() {
  return (
    <BridgePanel
      spec={{
        title: "Mix bridge",
        description:
          "Stem sheet and loudness targets for the mix stage. The hierarchy set on /audio is law — the mix realises it, it does not renegotiate it.",
        artifacts: ["stems"],
        engines: ["Fairlight", "Pro Tools", "Atmos renderer"],
        handoff: [
          { label: "Out", detail: "Stem sheet: VO, primary SFX, music bed, ambience — split at the hierarchy boundaries." },
          { label: "Targets", detail: "Dialogue anchor −16 LUFS short-form, −23 LUFS broadcast; true peak −1 dBTP." },
          { label: "Back", detail: "Printed stems plus a mixdown matched to the picture lock." },
          { label: "Gate", detail: "Loudness audit runs before the rubric; a failing mix blocks master export." },
        ],
      }}
    />
  );
}
