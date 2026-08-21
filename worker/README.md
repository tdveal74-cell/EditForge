# EditForge Forge Worker

The Next.js app is the control plane. This process is the execution boundary
that runs on a GPU host and owns source assets, model invocation, FFmpeg
mastering, and result files.

It is deliberately dependency-light: the server uses Python's standard
library. AI engines remain isolated in their official environments and are
discovered through explicit paths.

## Required contract

```env
EDITFORGE_WORKER_TOKEN=replace-with-at-least-24-random-characters
EDITFORGE_WORKER_URL=http://127.0.0.1:8787
EDITFORGE_WORKER_DATA=/data/editforge
EDITFORGE_APP_ORIGIN=http://localhost:3000
```

Run:

```bash
python worker/forge_worker.py
```

The worker refuses real inference until the relevant official engine checkout,
weights, and explicit license acceptance are present:

```env
EDITFORGE_ENGINE_PYTHON=/opt/editforge/venv/bin/python
EDITFORGE_LIVEPORTRAIT_HOME=/opt/engines/LivePortrait
EDITFORGE_MUSETALK_HOME=/opt/engines/MuseTalk
EDITFORGE_LTX_HOME=/opt/engines/LTX-Video
EDITFORGE_REMOTION_HOME=/opt/editforge/render

EDITFORGE_ACCEPT_CHATTERBOX_LICENSE=true
EDITFORGE_ACCEPT_LIVEPORTRAIT_LICENSE=true
EDITFORGE_ACCEPT_MUSETALK_LICENSE=true
EDITFORGE_ACCEPT_LTX_LICENSE=true
```

Official engine surfaces:

- LivePortrait: `inference.py -s SOURCE -d DRIVING -o OUTPUT`
- MuseTalk 1.5: `python -m scripts.inference` with an isolated task YAML
- Chatterbox: `ChatterboxTTS.generate(..., audio_prompt_path=REFERENCE)`
- LTX-Video: official `inference.py` at a model-native vertical resolution
- FFmpeg: native 2160×3840, 24 fps, 48 kHz mastering and ordered collection concat

Model/software availability does not prove acceptable output. Each project owns
its human acceptance gate. Ascension requires Devon's full-motion proof; the
TSWS Microdrama uses Tee's creator-authored Grok Visuals cut as its accepted
continuity proof while keeping the long-form Season One package outside the
worker lane.
