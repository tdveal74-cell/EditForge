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

Honest recut after Round 6 (2026-08-31). A fresh independent critic scored **honesty 79/100 LOSE** against frozen Round-5 HEAD `3cda75e`. Do not rubber-stamp 78. Product depth vs category leaders remains the wall (~50).

This table is the critic’s **79**, plus notes on what this round actually closed. It is not a win. Gen / voice / avatar were not deepened this round.

| Surface | Score | Note |
|---------|-------|------|
| Landing | ~76 | Control plane. Captions, titles, audio, and longform persist; other boards still seed. |
| Studio hub | ~76 | Directory of working surfaces, boards, and bridges — not one NLE. |
| Gen video | ~74 | One stage; mock default; text-to-video only. Not Runway-the-product. Not deepened this round. |
| Voice | ~74 | Listen stage is the JobRunner result. Consent gate held. Not deepened this round. |
| Avatar | ~74 | Stage unified. Sample briefs are draft, not ready. Not deepened this round. |
| Captions / titles / presets / audio | ~78 | Captions overlay the reference clip and persist. Titles type in motion on the frame and persist. Audio ladder stored. Not a live captioner / After Effects / Fairlight. |
| Script / pipeline / archive | ~74 | Board editors. Still not a running pipeline or live archive. |
| Timeline / collab / hardware / longform | ~74 | Sketch stays read-only (not an NLE). Longform hydrates stored chapters. Hardware is Reference, not a Bridge. |
| Stock | ~79 | Licensed index, not Artlist search. |
| Review | ~86 | Player first; portrait fit; seekable notes. |
| Dailies | ~87 | Contact sheet + mobile approve/reject. |
| JobRunner | ~88 | Gates on wired/credential/settings/store; mock labeled; amber only when billable. |
| Mobile nav | ~79 | Priority strip + More. |
| Bridges | ~73 | Mix desk renders getAudioLaw(); still Bridge, not Operational. Other four remain BridgePanel wrappers. Not Fairlight / Drive / Fusion. |
| **Overall** | **79** | Critic floor on `3cda75e`. Captions/titles/longform persist. Mix shows the stored ladder. Leftover lies recut. Product depth vs leaders remains the wall. |

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

Largest remaining gap (closed in Round 3 taxonomy, still true as product): Boards emit files but are not editors. Bridges are thin wrappers. No fresh visual critic this round. Not 99.

### Round 3 — 2026-08-31 (`gauntlet/to-100`)

Incoming critic on `1cf6596`: honesty **76/100 LOSE**. Do not rubber-stamp 74. Do not recut to 80.

Shipped:

- Timeline, collab, hardware, and longform recategorized Board. Pages self-label. Timeline is a read-only assembly sketch, not an NLE. Collab is a role-agreement board; per-role auth is not code. Hardware is reference classes, not a live inventory. Longform is a sample stitch plan; the page checkbox is not a recorded ship gate.
- Landing dropped “Flagship Studio OS” / “Post-production OS” / “one operating surface.” Hero is a control plane. Working-surfaces count from `workingSurfaces()` only.
- Pipeline emits a stage-map JSON. VFX eyebrow is Board (tracker, not a compositor).
- COMPLETION no longer `[x]` Boards as Operational and no longer says code-complete. `docs/STUDIO_OS.md` and `REPOSITORY_STATUS.md` recut the Flagship / code-complete chrome.
- mix / mam / vfx-engine copy and the downloaded files themselves: not Fairlight, not Drive/S3/Frame.io, not Fusion.
- Overall **76**. No 80. No 100.

Not claimed: Kling/Veo/Seedream wires, live clone, Artlist search, AAF/XML, per-role auth, a live hardware inventory, an NLE on /timeline, editors on Boards.

Largest remaining gap: Boards emit files but are not editors. Bridges remain thin wrappers. Remaining Ready surfaces include indexes (assets, export matrix). No fresh visual critic. Not 99.

### Round 4 — 2026-08-31 (`gauntlet/to-100`)

Incoming critic on frozen `76f67ab`: honesty **77/100 LOSE**. Round 3 claims held. Do not rubber-stamp 76. Do not recut to 80. Shipping 80 needs product depth, not another relabel.

Shipped:

- Board editors: captions add/remove cues then emit SRT/VTT; titles/presets/audio/script/pipeline/archive/longform edit then emit. Timeline stays a read-only sketch (not an NLE) and emits the sketch file. VFX tracker emits the board.
- mix / mam / vfx-engine emit useful artifacts: mix session dump, catalog export, compositor node graph. NLE EDL and render ffmpeg-plan held. MAM no longer encodes a fake `/archive` checklist gate. Still Bridge, not Operational. Not Fairlight / Drive / Fusion.
- Remaining Ready indexes recut: assets and export are Board. Assets copy no longer claims bytes live on Drive/S3 behind /mam. Export no longer speaks “Resolve deliver + CapCut format matrix.” Encode queue stays on /jobs.
- Overall **77**. No 80. No 100.

Not claimed: Kling/Veo/Seedream wires, live clone, Artlist search, AAF/XML, per-role auth, a live hardware inventory, Premiere/Fairlight/Fusion/DaVinci, a public-host recut.

Largest remaining gap: Boards are file editors, not media products next to CapCut/Resolve. Bridges are still wrappers that emit files. Working surfaces no longer count the two indexes; product depth vs leaders is still the wall under 80. No fresh visual critic this round. Not 99.

### Round 5 — 2026-08-31 (`gauntlet/to-100`)

Incoming critic on frozen `6d30c0f`: honesty **78/100 LOSE**. Round 4 file claims held. Do not rubber-stamp 77. Do not recut to 80. Shipping 80 needs product depth vs CapCut/Resolve/Fairlight, not another relabel.

Shipped:

- `/audio` edits persist; `/mix` session dump and stem sheet realise the stored ladder, not the `AUDIO_HIERARCHY` constant.
- `/api/longform/plan` plans the edited chapters. Rubric pass is read from a named cut; `body.rubricPass` is ignored.
- Export radio selection is written into the downloaded matrix (`selected`).
- OPERATOR / MCP / skills / health / FLAGSHIP_SPEC recut leftover Studio OS / `ultra-meta-supreme-flagship-aaa` chrome.
- Nav files Hardware under Reference, not Bridges. Color studioRole is envelope + still preview, not a Resolve bridge.
- Pipeline stage cards no longer print CapCut/Resolve as `ref:`.
- Honesty tests fail `isLiveWired("mock")`, longform ignoring edits, audio/mix drift, Hardware-as-Bridge, leftover OS chrome, pipeline CapCut refs.
- Overall **78**. No 80. No 100.

Not claimed: Kling/Veo/Seedream wires, live clone, Artlist search, AAF/XML, per-role auth, a live hardware inventory, Premiere/Fairlight/Fusion/DaVinci, a public-host recut, product depth next to category leaders.

Largest remaining gap: Product depth vs CapCut / Resolve / Fairlight / Frame.io. Fourteen Boards are still sample-seeded file editors. Five Bridges are still wrappers. Public vercel.app is unre-cut. Not 99.

### Round 6 — 2026-08-31 (`gauntlet/to-100`)

Incoming critic on frozen `3cda75e`: honesty **79/100 LOSE**. Named leftover wiring held. Product depth vs leaders is the wall. Do not rubber-stamp 78.

Shipped:

- Captions, titles, and longform persist through store + API, same pattern as /audio. Captions overlay the studio reference clip. Titles preview is type in motion (Web Animations + CSS) on the frame. Longform hydrates stored chapters.
- Mix is a Bridge desk of getAudioLaw() — not a 24-line BridgePanel, not Fairlight, not Operational. Session/stems still realise that copy.
- Audio persist is awaited with an error surface. getAudioLaw no longer silently substitutes AUDIO_HIERARCHY after a real store. PUT /api/audio then GET /api/handoff session is tested.
- Landing / README / STUDIO_OS recut "Boards are samples." Studio recut "one surface." toneFor no longer maps ready/live to done. FLAGSHIP_SPEC title recut. Nav Create leads with working surfaces, not Pipeline/Timeline. COMPLETION no longer checks DEVON long-form routing while /longform is a Board.
- Living overall **79**. Gen / voice / avatar recut off the previous overclaim; those lanes were not deepened.

Not claimed: Kling/Veo/Seedream wires, live clone, Artlist search, AAF/XML, per-role auth, a live hardware inventory, Premiere/Fairlight/Fusion/DaVinci, a public-host recut, product depth next to category leaders.

Largest remaining gap: Product depth vs category leaders (~50). Ten Boards still seed. Four Bridges remain wrappers. Public vercel.app is unre-cut (main, not this SHA).
