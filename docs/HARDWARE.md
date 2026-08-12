# EditForge Hardware Reference — AAA Flagship

Reference **classes**, not SKUs — procurement buys the current generation of each class.
Canonical data lives in `lib/hardware.ts` (rendered at `/hardware`, covered by
`lib/hardware.test.ts`). This doc adds the tier fallbacks and rationale.

## Tiers

| Tier | Meaning |
|------|---------|
| **Flagship** | The suite spec a AAA finishing house signs off on. Default for new builds. |
| **Standard** | Full capability with proxies/longer renders. Acceptable for edit-only seats. |
| **Minimum** | Functional floor for review/planning seats. Never for color sign-off. |

## Suites (flagship tier)

### Editorial
- Apple-silicon Ultra-class or Threadripper PRO-class workstation, 128 GB.
- Media engine with dual hardware decoders or 24 GB+ discrete GPU.
- NVMe scratch (7 GB/s class), 25GbE to shared storage.
- Dual 27″ 5K displays + client monitor via 12G-SDI I/O card.
- *Standard fallback:* 64 GB, 10GbE, single 5K + client feed. Proxy workflow.

### Color
- Threadripper PRO-class dual-GPU Resolve build, 256 GB ECC, 2× 24 GB+ GPUs.
- 12G-SDI DeckLink-class output into a calibrated chain.
- **Grade-1 HDR mastering display (1000-nit class)** + bias lighting + panel surface.
- Law: grades are never approved on the GUI viewer. No minimum tier exists for sign-off.

### Sound
- Mac Studio-class DAW host, dedicated DSP, 32+ channel Thunderbolt interface (<2 ms RTL).
- Treated room, calibrated 5.1/7.1 with Atmos-ready option, LUFS metering.
- Mix law: dialogue anchor −16 LUFS short-form, −23 LUFS broadcast.

### VFX / 3D
- High-core-count CPU, 48 GB-class GPU, 192 GB RAM, local NVMe cache, 25GbE.
- Heavy sims farm out; the box exists for lookdev iteration speed.

### AI media
- Provider-cloud first (gen video, voice, avatar run on provider infrastructure).
- Local node: 24 GB+ VRAM for upscale/interpolation/enhancement passes, 128 GB, 10GbE.

## Shared infrastructure

| Lane | Spec | Role |
|------|------|------|
| Online storage | All-NVMe shared array, 25/100GbE spine, project-per-volume | Active cuts, dailies, conform |
| Nearline | High-capacity HDD array + NVMe cache | Completed projects pre-archive |
| Cold archive | LTO-9-class tape pairs + geo-separated object copy | Masters + originals, **3-2-1 enforced** |
| Render farm | GPU encode nodes, hardware AV1/HEVC, queue-managed | Transcode, stitch, deliverable matrix |
| Network | 25GbE suites, 100GbE spine, 10GbE floor | Shared-storage editing, no local copies |
| Review I/O | 12G-SDI + HDMI 2.1 client feeds, frame-accurate remote streams | Director/client review |

## Rules

1. **Monitoring is part of the spec.** A suite without its stated monitoring chain is a
   different (lower) tier, whatever the tower cost.
2. **Storage is 3-2-1 or it is not archived.** Two media types, one off-site.
3. **The farm renders; suites iterate.** Long encodes on a grading box is a scheduling bug.
4. **AI media is cloud-first.** Local GPUs enhance; providers generate. Keys live in env,
   never in the repo (`.env.example`).
