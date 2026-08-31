export type HardwareTier = "flagship" | "standard" | "minimum";

export type HardwareStation = {
  id: string;
  dept: string;
  label: string;
  tier: HardwareTier;
  compute: string;
  memory: string;
  gpu: string;
  io: string;
  monitoring: string;
  notes: string;
};

export type InfraLane = {
  id: string;
  label: string;
  spec: string;
  role: string;
};

export const HARDWARE_STATIONS: HardwareStation[] = [
  {
    id: "editorial-flagship",
    dept: "Editorial",
    label: "Editorial suite",
    tier: "flagship",
    compute: "Apple-silicon Ultra-class or Threadripper PRO-class workstation",
    memory: "128 GB unified / ECC",
    gpu: "Dual-decoder media engine or 24 GB+ discrete GPU",
    io: "NVMe scratch (7 GB/s class) + 25GbE to shared storage",
    monitoring: "Dual 27″ 5K editorial displays + client monitor via 12G-SDI I/O card",
    notes: "Cuts 8K raw multicam without proxy; proxies still generated for remote review.",
  },
  {
    id: "color-flagship",
    dept: "Color",
    label: "Grading suite",
    tier: "flagship",
    compute: "Threadripper PRO-class, dual-GPU Resolve build",
    memory: "256 GB ECC",
    gpu: "2× 24 GB+ discrete GPUs (one dedicated to viewer)",
    io: "12G-SDI DeckLink-class output, calibrated signal chain",
    monitoring: "Grade-1 HDR mastering display (1000-nit class), bias lighting, panel control surface",
    notes: "Reference chain is calibrated end-to-end; grades are never approved on the GUI viewer.",
  },
  {
    id: "sound-flagship",
    dept: "Sound",
    label: "Mix stage",
    tier: "flagship",
    compute: "Mac Studio-class DAW host + dedicated DSP",
    memory: "64 GB",
    gpu: "Integrated (video playback only)",
    io: "Thunderbolt audio interface, 32+ channel, sub-2ms round trip",
    monitoring: "Treated room, 5.1/7.1 calibrated monitors + Atmos-ready option, LUFS metering",
    notes: "Mix law: dialogue anchor −16 LUFS short-form, −23 LUFS broadcast deliverables.",
  },
  {
    id: "vfx-flagship",
    dept: "VFX",
    label: "VFX / 3D box",
    tier: "flagship",
    compute: "High-core-count CPU + top-tier CUDA GPU",
    memory: "192 GB",
    gpu: "48 GB-class GPU for sim + render",
    io: "Local NVMe cache array, 25GbE",
    monitoring: "Color-managed 4K reference-adjacent display",
    notes: "Heavy sims farm out; the box is for lookdev and iteration speed.",
  },
  {
    id: "ai-media-flagship",
    dept: "AI Media",
    label: "AI media node",
    tier: "flagship",
    compute: "GPU inference node (local) + provider API lanes (cloud)",
    memory: "128 GB",
    gpu: "24 GB+ VRAM for local upscale/interp; gen-video runs on provider cloud",
    io: "10GbE minimum to MAM",
    monitoring: "Standard editorial display",
    notes: "Voice/avatar/gen-video are provider-cloud first; local GPU handles enhancement passes.",
  },
];

export const INFRA_LANES: InfraLane[] = [
  {
    id: "storage-online",
    label: "Online storage",
    spec: "All-NVMe shared array, 25/100GbE spine, project-per-volume",
    role: "Active cuts, dailies, conform media",
  },
  {
    id: "storage-nearline",
    label: "Nearline",
    spec: "High-capacity HDD array with NVMe cache tier",
    role: "Completed projects awaiting archive decision",
  },
  {
    id: "storage-archive",
    label: "Cold archive",
    spec: "LTO-9-class tape pairs + geo-separated object storage copy",
    role: "Masters, camera originals, 3-2-1 rule enforced",
  },
  {
    id: "render-farm",
    label: "Render farm",
    spec: "GPU encode nodes with hardware AV1/HEVC encoders, queue-managed",
    role: "Transcode, stitch, deliverable matrix renders",
  },
  {
    id: "network",
    label: "Network",
    spec: "25GbE to suites, 100GbE spine, 10GbE floor minimum",
    role: "Shared-storage editing without local media copies",
  },
  {
    id: "review",
    label: "Review I/O",
    spec: "12G-SDI + HDMI 2.1 client feeds, frame-accurate remote review streams",
    role: "Director/client review sessions, in-room and remote",
  },
];

export function stationsByDept(): Record<string, HardwareStation[]> {
  const map: Record<string, HardwareStation[]> = {};
  for (const s of HARDWARE_STATIONS) {
    (map[s.dept] ||= []).push(s);
  }
  return map;
}

export function flagshipCoverage(): { depts: string[]; complete: boolean } {
  const depts = [...new Set(HARDWARE_STATIONS.filter((s) => s.tier === "flagship").map((s) => s.dept))];
  const required = ["Editorial", "Color", "Sound", "VFX", "AI Media"];
  return { depts, complete: required.every((d) => depts.includes(d)) };
}

/** Reference classes as a file. Not a live inventory. */
export function buildHardwareReference(
  stations: HardwareStation[] = HARDWARE_STATIONS,
  lanes: InfraLane[] = INFRA_LANES,
): string {
  return (
    JSON.stringify(
      {
        kind: "hardware-reference",
        notice:
          "Reference classes as a file. Not a live inventory, not SKUs, not a procurement catalog.",
        stations: stations.map((s) => ({
          id: s.id,
          dept: s.dept,
          label: s.label,
          tier: s.tier,
          compute: s.compute,
          memory: s.memory,
          gpu: s.gpu,
          io: s.io,
          monitoring: s.monitoring,
          notes: s.notes,
        })),
        infrastructure: lanes,
      },
      null,
      2,
    ) + "\n"
  );
}
