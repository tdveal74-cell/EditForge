# HeyGen compatibility audit — 2026-10-20

Status: repository migration prepared; production audit partially blocked. No paid generation, production edits, activation, publication, identity changes, or voice cloning performed.

## Verified findings

The October 19 email (Gmail message 1a1552e91b2d26e1) explicitly names October 31, 2026 as the migration deadline. Official comparison documentation also lists November 1 retirement but supplies an October 31 Sunset header. Complete migration and tests before October 31.

Read-only inspection on srv1936193 counted **185 n8n workflows, 56 active**. Every active workflow had a matching workflow_history record; the scan of those active-version node definitions found **zero literal api.heygen.com references**. Current entity definitions were scanned independently. There are **nine v2 HTTP nodes across three archived, inactive probes**. No v1 HeyGen call was found. This is a static definition inventory, not a day of runtime traffic or proof that dynamic URLs and external gateways never call HeyGen.

TQO FINAL V5, qEkGOUsNyVaRAmm6, was active with draft and active version both 679ba514-0645-4d53-8e68-d9c41b91ad48. Its HeyGen text references are in Build Movie, Plan Presenter Segments, and Presenter: Write Shot List; no direct HeyGen request node is present. TQO 90 Final Review draft Tqo90Draft261019A is inactive.

The October 6 repository receipt describes avatar draft 206299ba using v3 and manual execution 2221. This is historical evidence only: today's database retains one TQO history record, and the historical draft was not available for fresh inspection. Do not publish that old draft or claim it remains the current unpublished version.

## Endpoint inventory

All external paths below are under https://api.heygen.com. Node-level IDs, names, methods, and current states are in n8n-endpoints.json.

| Consumer | Method / endpoint | Authentication | Classification / action |
| --- | --- | --- | --- |
| EditForge lib/provider-registry.ts | POST /v3/videos; GET /v3/videos/{id} | X-Api-Key from HEYGEN_API_KEY | Implemented v3 generation adapter; unchanged. Deployment on srv1936199 unverified. |
| EditForge credential setup | GET /v2/avatars | X-Api-Key | Confirmed legacy setup dependency; migrated on this branch to /v3/avatars/looks, using look.id as avatar_id. |
| EditForge credential setup | GET /v2/voices | X-Api-Key | Confirmed legacy setup dependency; migrated to /v3/voices, separately enumerating public and private voices. |
| Archived n8n y7PCEQcNaSQb6c7i | GET /v2/avatars (2 nodes); GET /v2/user/remaining_quota (2 nodes) | Stored httpHeaderAuth | Historical credential probes; leave archived. Rebuild on v3 if ever reused. |
| Archived n8n ONWxd5HtuLZ6loM3 | GET /v2/user/remaining_quota (2 nodes); GET /v2/avatar/{id}/details (2 nodes) | Stored httpHeaderAuth | Historical read probes; leave archived. Revalidate look/group semantics if reused. |
| Archived n8n qCSPJ1naaB1NdcFQ | GET /v2/voices (1 node), GET /v3/voices, GET /v3/users/me | Stored httpHeaderAuth | Mixed-version read probe; leave archived. |
| Archived n8n experiments | POST /v3/videos; POST /v3/avatars; GET /v3/users/me; GET and DELETE /v3/avatars/looks/{id}; GET /v3/avatars/looks; GET /v3/avatars/groups | Stored httpHeaderAuth | Historical v3 experiments; untouched, not certified for reuse. /v3/avatars/groups differs from current documented /v3/avatars group route. |
| Inactive TEMP engine test z1D6UyO95VOmDfsh | GET /v3/users/me; POST /v3/videos | Stored httpHeaderAuth | Inactive, not archived; no migration needed and not executed. |
| TSWS September 4 packet | Avatar IV preparation, uploads, cloning, photo avatars, motion tests | No concrete HTTP implementation in packet | Historical production plan, not proof of API version or current approval. |
| EditForge private provider/server.mjs | Internal /v1/lipsync routes to Runway; /v1/voice to ElevenLabs | Provider-specific configuration | These are not HeyGen v1 endpoints. No HeyGen migration applied. |

n8n credential values were not decrypted. Its authentication *type* is verified; actual stored header name and current validity are not independently verified. Source mappings for the Python setup and TypeScript render adapter directly specify X-Api-Key.

Repository scan: EditForge at 1f1ddd3c2ed4db5e285d4bf1932244a1b0c38aad, plus default-branch Meta-Supreme-Apex-Genesis- paths n8n, deploy, services, scripts. No executable api.heygen.com calls were found in those Meta-Supreme directories. Historical comments and documents are not classified as deployments.

On srv1936193, bounded source-file scans of /opt/tsws (1 file), /opt/tsws-render-worker (4), /opt/tqo-render-worker (7), /opt/tsws-artcraft-repair-20261020 (20) found no literal HeyGen URL. These scans excluded dependencies, binaries, environment files, and files over 5 MB.

## Change and regression evidence

The setup migration changes only catalog discovery. The existing generation adapter, approved mappings, consent registry, workflow state, script, canon, and spend controls are unchanged.

v3 returns a data array and opaque next_token. The helper now reads every page, URL-encodes cursors, and refuses incomplete, repeated, malformed, or excessively long pagination. The avatar picker lists renderable looks, not character groups. Voice discovery includes private clones because v3 defaults to public voices. An exact ID still must match the returned catalog; no default voice fallback was introduced. Selection failures do not overwrite existing bindings.

Tests were written first: the legacy implementation failed six assertions/subtests for v3 endpoint and pagination expectations. After the migration:

- Python setup suite: **17 passed**. Mocked HTTP covers v3 look selection, multiple pages and cursor encoding, private/public voices, malformed/cyclic cursors, 401/403/429/500 safe refusal, no automatic error retries, exact-ID selection, private writes, and preservation of existing bindings after lookup failure.
- Full npm test: **506 application tests passed across 46 files**, plus **19 worker/provider tests passed**. Existing mocked HeyGen tests cover explicit avatar/voice IDs, authentication, submission ID extraction, asynchronous pending/processing/completed/failed handling, and status URL selection.
- Existing job tests exercise idempotency, retry, rubric acceptance, authenticated spend confirmation, and failure propagation. Existing private-provider tests exercise Runway motion/lip sync and consent/scope controls.
- TypeScript no-emit check passed; git diff --check passed.

Limits: there is no identified active HeyGen avatar-creation, voice-cloning, or dedicated /v3/lipsyncs adapter to migrate. Archived experiments were not refactored or executed. Mock tests establish transport and control behavior, **not** identity fidelity, natural motion, consent completion at HeyGen, or perceptual lip synchronization. No new avatar/clone or paid visual acceptance test was run. Those remain explicit production acceptance work if the avatar lane is later enabled.

## Account and access obstacles

The connected HeyGen read-only current-user call succeeded for Terrance's account. It reported subscription plan free, wallet null, and credit figures null. That does not establish a payable balance, production API entitlement, or validity of the separate stored n8n/EditForge credentials. No purchase or generation attempted.

srv1936199 was listed online, but two read-only Desktop Commander commands timed out. Its deployed EditForge revision, installed setup script, environment bindings, gateway adapters and any host-only TSWS integrations therefore remain **unverified**. Reconnect that device and inspect its deployment before declaring the estate migration complete.

The live n8n MCP administration surface was not exposed in this session; database inspection was read-only through the authorized connected host. No n8n workflow was executed just to test access.

## Review and production boundary

Review and merge this branch separately. Do not deploy or run the interactive setup automatically; it changes saved identity selections only after a human chooses. Before any later production change: inspect srv1936199, retain the deployed baseline, compare its adapter to the reviewed revision, test read-only v3 catalogs using its own credential without exposing it, confirm the existing approved look and voice IDs, and retain the spend and human review gates. Roll back by restoring the prior deployed revision; no production changes were made here.

No current canon was inferred from the September packet. Its voice/upload blockers and outdated setting/framing rules cannot override later canon or user decisions.

## Sources

- [Original notice](https://mail.google.com/mail/u/?authuser=tdveal74%40gmail.com#all/1a1552e91b2d26e1)
- [TSWS historical packet](https://drive.google.com/file/d/1na0r7XdN0GVTAKNfsWraOXNNdFq3XRN4/view)
- [Earlier audit receipt](https://github.com/tdveal74-cell/Meta-Supreme-Apex-Genesis-/blob/main/docs/devon/SYS_OPS_show-registry-steps-one-and-two_v1_2026-10-06-1612.md)
- [Official migration mapping](https://developers.heygen.com/endpoint-version-comparison)
- [Renderable look catalog](https://developers.heygen.com/reference/list-avatar-looks)
- [Voice catalog and pagination](https://developers.heygen.com/reference/list-voices)

