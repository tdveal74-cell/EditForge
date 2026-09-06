# Flagship hardware and delivery targets

These are engineering targets, not claims about the visitor’s device or current
VPS. Current resource state must come from live infrastructure receipts.

| Tier                  | Target                                                   | Experience rule                                                                               |
| --------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Chromebook baseline   | 4 logical cores, 8 GB RAM, integrated graphics           | One active video decoder, no WebGL requirement, compressed H.264 motion, no blur-heavy chrome |
| Mobile baseline       | Current Safari or Chromium, 390 × 844 reference viewport | Poster-first media, touch targets at least 44 px, independently stacked layout                |
| Editorial workstation | 8+ CPU cores, 16+ GB RAM                                 | Larger workspace and previews, same server-authoritative jobs                                 |

## Browser budgets

- Landing motion excerpts are under 500 KB each at 432 × 768.
- No motion file preloads before it becomes relevant.
- Uploads stream with a 100 MB per-file boundary.
- Media responses support byte ranges for seeking.
- Canvas caps each project at 60 nodes, 120 edges, 120 assets and 120 clips.
- Floor Agent input caps at 6,000 characters and 30 requests per project/hour.

## Render infrastructure targets

- Web service: 2 CPU cores and 2 GB RAM minimum for normal control-plane load;
  4 GB is preferred when storing 100 MB uploads locally.
- Artifact storage: persistent volume with free-space monitoring. Keep twice the
  largest expected concurrent upload batch free.
- Worker: one render process by default. Increase only with measured resources.
- GPU rendering remains an adapter concern. The web plane stays usable without
  a GPU worker.
- Redis REST is preferred for multi-instance coordination. File storage is for
  one web instance with a persistent volume.
