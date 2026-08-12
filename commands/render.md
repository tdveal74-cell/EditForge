---
description: Submit provider media work (voice, avatar, generative video) through the EditForge gates
---

Submit the media work described below through the EditForge studio.

Before submitting anything:

1. Call `editforge_status` and report which providers could actually bill.
2. State plainly whether this run will cost money. If it will, say so and get
   confirmation first — do not submit a billable job on your own initiative.
3. Default to provider `mock` when the user has not asked for a real render.

After submitting, poll with `drive_job` until the job settles. Then:

- `validating` means the provider finished and **a human has not accepted it**.
  Report it as awaiting acceptance, never as done.
- A `mock` job produced no media. Say that, every time. Do not describe a mock
  run in language that would read as a delivered render.
- On failure, report the recorded reason and whether a retry is likely to help.
  A missing credential will fail identically on every retry.

$ARGUMENTS
