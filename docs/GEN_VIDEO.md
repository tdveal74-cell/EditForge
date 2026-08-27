# Generative video quality bar

UI `/gen-video` · plan `POST /api/gen-video/plan` · execution `POST /api/jobs`
with `kind: "gen-video"`.

| Tier | Use |
|------|-----|
| draft | Internal explore |
| social | Shorts / Reels after rubric |
| broadcast-intent | Highest scrutiny + disclosure; rubric pass required before the run is authorized |

## Providers

| Provider | Env | Live path |
|---|---|---|
| Runway | `RUNWAY_API_KEY` (or `RUNWAYML_API_SECRET`) | **Implemented** — `POST /v1/text_to_video`, `GET /v1/tasks/{id}`, API version `2024-11-06` |
| Kling | `KLING_API_KEY` | Not implemented — refuses rather than pretends |
| Veo | `VEO_API_KEY` | Not implemented |
| Seedream | `SEEDREAM_API_KEY` | Not implemented |
| Mock | — | Always available; real lifecycle, no media, no spend |

`/api/providers` reports `wired` per provider, so an unimplemented one is visible
before it is picked rather than after it refuses.

## What Runway accepts

Text-to-video renders **16:9 or 9:16** at **2–10 seconds**. The studio brief
speaks in aspects and seconds and the boundary translates: `16:9 → 1280:720`,
`9:16 → 720:1280`. Anything outside that is refused before the call, because a
provider 400 costs a round trip to learn what a local check already knows.

Options the provider does not define are dropped rather than forwarded — Runway
rejects a body carrying unknown fields.

## Stock
`/stock` · `ARTLIST_API_KEY` / `EPIDEMIC_API_KEY` — index only, no execution
boundary yet.

## Law
Gen is not a free pass. Restraint grade + rubric before master. Disclose AI media
when required.
