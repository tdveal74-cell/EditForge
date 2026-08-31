# Gauntlet Law — All Builds

**Status:** Operating law  
**Scope:** Every product surface across Meta Supreme, EditForge, solid-octo-potato, psycle, and future repos

---

## The rule

1. **Flagship is the floor, not the ceiling.**  
   Navy / Amber / Surface tokens, restraint, honesty marks, human gates, Chromebook-first fluid layout — these are minimum entry requirements, not stretch goals.

2. **The 99 gauntlet loop is mandatory.**  
   No surface ships as “good enough” at flagship compliance alone. It is audited, pressure-tested, and raised until it clears a ~99 bar against the product’s real competitors and operator use.

3. **Media products must speak media.**  
   Creation and review surfaces put previews, results, and frames at the center. Forms serve media; media does not decorate forms.

4. **Honesty is non-negotiable.**  
   Simulated / mock output is always labeled. Live is never implied when the path is mock. Rubric and consent gates stay code, not copy.

5. **Mobile is a product surface.**  
   Priority operator actions must work as a deliberate mobile experience, not only as scaled desktop.

---

## Gauntlet checklist (run on every major surface)

- [ ] Flagship tokens only — no invented brand colors
- [ ] Amber sparse (≤ one primary accent fill per view + focus rings)
- [ ] Simulated / plan / live states labeled correctly
- [ ] Human gate or rubric preserved where effects ship
- [ ] Media (if any) is primary visual language
- [ ] Mobile: priority actions reachable without desktop assumptions
- [ ] Chromebook-first fluid layout; no blur; no wasted screen
- [ ] Reading/decision flow answers the operator’s job in under 30s
- [ ] Empty and error states are calm and specific
- [ ] Reduced motion honored

**Pass condition:** Would this surface hold next to Artlist / Runway / OpenArt (or the relevant category leader) without looking like an internal tool?

If no → continue the loop.

---

## EditForge current score (living)

Honest recut after Round 2 (2026-08-31). A fresh independent critic scored **honesty 74/100 LOSE** against the Round-1 tree. Round-1 file claims (Ready ≠ Live, landing wired-only, EDL-only NLE, no blur, mobile nav, stock as licensed index) still hold. The Round-1 **~80 overall** does not.

This table is the critic’s 74, plus notes on what Round 2 actually closed. It is not 80. It is not 99. It is not 100.

| Surface | Score | Note |
|---------|-------|------|
| Landing | ~76 | Working-surfaces count (not “Ready modules”). Still a control-plane hero, not a competitor landing. |
| Studio hub | ~76 | Taxonomy copy: Ready = does work; Board = sample; Bridge = file. Map is still a directory. |
| Gen video | ~84 | One stage; mock default; STRENGTHS no longer sell motion-brush/restyle/extend as wired. |
| Voice | ~85 | Listen stage is the JobRunner result. Consent gate held. |
| Avatar | ~85 | Stage unified. Sample briefs are draft, not ready. |
| Captions / titles / presets / audio | ~74 | Self-labeled Board. Emit SRT/VTT, spec, preset, audio-law files. Not product editors. |
| Script / pipeline / archive | ~70 | Recategorized Board. Sample beats, static stage map, empty checklist. |
| Stock | ~80 | Licensed index, not Artlist search. |
| Review | ~86 | Player first; portrait fit; seekable notes. |
| Dailies | ~87 | Contact sheet + mobile approve/reject. |
| JobRunner | ~88 | Gates on wired/credential/settings/store; mock labeled; amber only when billable. |
| Mobile nav | ~80 | Priority strip + More. |
| Bridges | ~78 | File handoff wrappers (EDL / stems / shots / paths / ffmpeg-plan). Not engines. |
| **Overall** | **74** | Critic floor. Round 2 closed the named honesty gaps. Did not earn 80. |

Update this table as surfaces clear higher bars. Do not recut upward without a fresh critic.

---

## Round ledger

### Round 1 — 2026-08-31 (`gauntlet/to-100`, `a75aae1`)

Critics this round: honesty **68/100**, live visual (vercel.app) **81/100**. Living table claimed **~80**. A later independent critic scored **74** and rejected 80.

Shipped (still holds):

- Operational hubs never say Live. Ready / Board / Bridge / AI media only.
- Landing does not name unwired providers as output. Stats have units. No backdrop-blur.
- Mobile nav: three priority links + More. Header cannot overflow ~390px.
- JobRunner: mock default; live submit disabled when unwired, credential missing, settings missing, or artifact store required and absent. Amber fill only when a live run is actually billable.
- NLE handoff is CMX3600 EDL only (no AAF/XML claim).
- Render farm downloads an ffmpeg-plan JSON. Bridges stay checked only because they emit files.
- Health: control-plane vs self-host surfaced on studio, jobs, JobRunner.
- Review portrait fit; dailies approved state; rubric empty-state; stock calm loading; jobs loading without fake cut names.

Not claimed: Kling/Veo/Seedream wires, live clone, Vercel executionReady, Artlist search.

Gap the 74 critic named: Ready still meant a page exists. Landing counted 16 Ready modules. script / pipeline / archive wore Ready. Boards were only four surfaces. Gen-video sold motion-brush/restyle/extend. Plan picker defaulted to Runway beside JobRunner mock. Sample pages spoke CapCut/Fairlight. SAMPLE_AVATARS used status ready. Gen-video well was a studio reference clip.

### Round 2 — 2026-08-31 (`gauntlet/to-100`)

Incoming critic: honesty **74/100 LOSE**. Overall recut to **74**, not 80.

Shipped:

- Ready taxonomy: script, pipeline, archive are Board. Landing counts “Working surfaces”, not “Ready modules”. Studio copy: Ready means the surface does work; Ready is never Live.
- Captions / titles / presets / audio / script / archive self-label Board and emit files (SRT/VTT, title spec, preset pack, audio law, beats JSON, checklist). Copy no longer claims CapCut / Fairlight as this product. Archive boxes start empty.
- Gen-video / voice / avatar: one JobResultStage. No studio reference clip as output. Plan picker and JobRunner share mock as default. Runway strengths: text-to-video only; motion brush / restyle / extend not wired.
- SAMPLE_AVATARS are draft, not ready.
- README / layout / COMPLETION no longer claim AAA flagship / Ultra Meta Supreme / studio-OS code-complete.
- mix / mam / render / vfx-engine remain BridgePanel file-handoff wrappers, labeled as destinations not live engines.

Not claimed: Kling/Veo/Seedream wires, live clone, Artlist search, AAF/XML, a 80 or 100 overall.

Largest remaining gap: Ready still covers thin working surfaces (collab, hardware, timeline sketch). Boards emit files but are not editors. Bridges are thin wrappers. No fresh visual critic this round. Not 99.
