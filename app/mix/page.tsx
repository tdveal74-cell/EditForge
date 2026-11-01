import type { Metadata } from "next";
import { getAudioLaw } from "@/lib/audiostore";
import { MixDesk } from "./MixDesk";

export const metadata: Metadata = { title: "Mix bridge" };

export default async function Page() {
  const levels = await getAudioLaw();
  return (
    <MixDesk
      initialLevels={levels}
      artifacts={["session", "stems"]}
      notice="Not Fairlight, not Pro Tools, not a mixer. This desk realises the stored /audio ladder — it does not renegotiate it."
    />
  );
}
