from __future__ import annotations

import json
from pathlib import Path
import sys


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: chatterbox_cli.py REQUEST.json")
    request = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))

    import torch
    import torchaudio as ta
    from chatterbox.tts import ChatterboxTTS

    requested = str(request.get("device", "cuda"))
    if requested == "cuda" and not torch.cuda.is_available():
        requested = "cpu"
    model = ChatterboxTTS.from_pretrained(device=requested)
    wav = model.generate(
        str(request["text"]),
        audio_prompt_path=str(request["voiceReference"]),
    )
    output = Path(request["output"])
    output.parent.mkdir(parents=True, exist_ok=True)
    ta.save(str(output), wav, model.sr)


if __name__ == "__main__":
    main()

