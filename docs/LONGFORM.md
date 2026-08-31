# Long-form render

Gen models = short clips. Long-form = chapters → segments → stitch → grade → rubric → master.

## Tiers
| Tier | Max | Spine |
|------|-----|--------|
| Short doc | ~8 min | Light NLE + inserts |
| Episode | ~25 min | Chapter pipeline |
| Featurette | ~45 min | NLE primary |
| Feature | ~120 min | NLE + farm |

## API
`POST /api/longform/plan` — plans the chapters in the body. Rubric pass is read from a named cut in the store, never from `body.rubricPass`.

## UI
`/longform`
