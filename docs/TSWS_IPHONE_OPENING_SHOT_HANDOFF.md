# TSWS Episode 1: iPhone opening shot handoff

**Status:** draft work order for a 12-second picture proof. No video provider submission, charge, approved plate, or master is claimed. This is the first twelve seconds of the locked Episode 1 Beat 1, whose full duration is thirty seconds. The private locked script and approved identity sheets govern if a description conflicts.

## What Tee can do on iPhone

1. Open this handoff on the iPhone for `TSWS-S01E01-SH001` and inspect the provider cost before approving any paid generation. The EditForge manifest stores a paid-submit gate; it does not connect to OpenArt yet.
2. In OpenArt, select an image-to-video or text-to-video model available on the account. Use the prompt below for one approximately five-second trial plate. If the provider cannot deliver 1920×1080 at 24 fps, retain the original and let EditForge conform a review copy. Record the actual model, settings, credit cost, output dimensions, duration, and job ID.
3. Download the result to iPhone Files and retain the OpenArt job ID. Transfer the file to the private EditForge work directory as `media/TSWS-S01E01-SH001.mp4` once a verified transfer path is available. Review the plate on the iPhone against the checks below. A generated file is **pending** until a named human QC receipt passes.
4. Only after SH001 passes, prepare `SH002`, the next seven seconds in the same geography. Use the SH001 last frame as a continuity reference if the chosen provider supports it. Approve its charge separately.

## SH001 prompt package

**Goal:** five-second opening city plate, no dialogue or character performance. A city at blue hour, neither night nor evening. Rooftops over a stone street. Distant pedestrians move naturally; each wears a calm, plausible face mask rather than a theatrical costume. Light arrives from low off-frame with no visible source. Fine constant grain, restrained 1970s British contemporary texture, deep void and sparse warm light, 40 mm equivalent, patient stable camera, ample negative space. No one looks into the lens. End on geography that can connect to a third-floor window across the street.

**Avoid:** unapproved lead-character faces, front-lit portraits, smiles, direct lens contact, horror-mask design, extra glowing threads, Anahata green, title text, logos, watermarks, camera whip, or music. The opening sound bed and gold-thread beat are built downstream, so do not rely on model-generated audio or a model-generated thread.

**References:** No lead-character identity sheet is needed for SH001 because its `characters` list is empty. Use the approved style pack only if the provider account has a private reference upload. Do not upload the locked script PDF, consent records, or identity sheets to a provider for this environment-only shot.

**Production ask:** One five-second 16:9 plate. Prefer 1920×1080 and 24 fps when available. If the provider only offers another frame rate or size, preserve the source and note it; EditForge's QC import requires a conformed 1920×1080 review copy long enough for 120 frames. No master export from this step.

## iPhone review: pass or regenerate

| Check | Pass criterion |
| --- | --- |
| Environment | Blue-hour city and stone street read clearly; no named city landmark is invented as canon. |
| Masks and motion | Distant pedestrians move plausibly; masks are ordinary and restrained. |
| Camera | Stable patient motion, legible negative space, no accidental close-up or lens contact. |
| Canon VFX | No Anahata green or extra gold threads. Their placements belong to later finishing. |
| Continuity | Last frame can lead toward the rooftop/window geography of SH002. |
| Rights and identity | No unapproved recognizable face, logo, or watermark. |
| Technical | Downloaded file opens on iPhone; file duration, dimensions, and source settings recorded. |

After Tee marks the plate pass, the existing `receipt-template` command provides the nine-check QC record. The import/receipt and silent assembly can be run by EditForge's worker; the current repository has a CLI for that contract, but no phone upload UI or OpenArt API connector has been verified. This handoff therefore supports a manual provider and file transfer pilot, not a claim of end-to-end automation.

## Full pipeline boundary

OpenArt may expose Seedance, Kling, and Wan as model choices in one account. Confirm the exact model and cost at the moment of the shot. ElevenLabs is for later dialogue takes, after the selected voice IDs and consent scope pass verification. EditForge can prepare previews and QC on the VPS. DaVinci Resolve, Fusion, and Fairlight require a separate supported editing workstation or finishing collaborator for the full canonical master. The iPhone remains the review and approval surface.
