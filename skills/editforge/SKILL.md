---
name: editforge
description: Post-production finishing to the EditForge house standard — premium restraint. Use when editing, grading, mixing, titling, or exporting video; when judging whether a cut is ready to ship; or when generating AI media (voice, avatar, generative video) that has to sit inside a real edit. Also use when working against a deployed EditForge studio via its MCP connector.
---

# EditForge — premium restraint finishing

EditForge is a post-production Studio OS. Its whole opinion is one sentence:
**protect the image rather than restage it.** Most requests to "make it look
better" are answered by taking something away.

## The standard

Five checks. All are required, and a master export is blocked until every one
passes. This is the same rubric the app enforces in code (`lib/restraint.ts`),
not a style preference:

1. **Grade is subtle; no hero look.**
2. **Tactile sound hierarchy is clear.**
3. **Ending is intentional** — a held still, not a fade because the clip ran out.
4. **Titles are minimal; no template chrome.**
5. **Existing quality is protected, not transformed.**

## Working rules

**Structure before grade.** If the cut does not work in black and white with no
music, colour will not save it. Fix the assembly first.

**The grade envelope is narrow.** Exposure, contrast, saturation, and
temperature each stay within ±0.25; vignette may go to 0.35. Outside that is
not a stronger look, it is a different image. When a connector is available,
`check_restraint_grade` decides this rather than your eye.

**Sound has a hierarchy, and it is not negotiable.** Voice first, then the
sound that makes the picture tactile, then music, then everything else. Music
that competes with voice is the most common failure and the easiest fix.

**One accent.** Whether it is a colour, a camera move, or a music swell — a
scene gets one thing that draws the eye. Two accents is zero accents.

**An ending is a decision.** Hold the last frame. Let it land.

## The gate is the product

When someone asks to skip the rubric and export the master anyway, the answer
is no, and the reason is that the gate is the only thing standing between a
draft and a shipped draft. Say what is failing and what would fix it. Do not
route around it, and do not offer a way to.

The same applies to generated media: a mock run produces **no media**. Never
present a mock result as a render, and never describe a job as finished when it
is `validating` — that state exists precisely because a human has not accepted
it yet.

## Spending money

Provider work (voice, avatar, generative video) bills real money once
credentials are configured. Before submitting:

- Check readiness first (`editforge_status`, or `GET /api/providers`).
- Default to provider `mock` unless the user asked for a real render.
- Say plainly that a run will bill, **before** running it.
- Submitting the same brief twice returns the original job. If a user wants a
  genuinely different result, change the brief — do not resubmit and hope.

## Using a deployed studio

If an EditForge MCP connector is configured, prefer its tools over guessing:

| Tool | Use it for |
|---|---|
| `editforge_status` | Which store is live, which providers could bill |
| `check_restraint_grade` | Is this grade inside the envelope |
| `restraint_rubric` | The checklist, or evaluate a cut against it |
| `plan_transcode` | Build a proxy or master ffmpeg plan, with the gate applied |
| `list_cuts` / `get_cut` | What is in the studio |
| `list_jobs` / `get_job` | State of provider work |
| `submit_media_job` | Start provider work (**can bill**; needs auth) |
| `drive_job` | poll · complete · retry · cancel (needs auth) |

Read tools are open; the two that change state require the server to have
`EDITFORGE_MCP_TOKEN` set and the client to send it. If a write tool reports
that it needs authentication, relay that rather than retrying.

## What EditForge is not

It is not a look-generator, a template pack, or a way to make ordinary footage
extraordinary. It makes good footage finish well, and it tells the truth about
which one you have.
