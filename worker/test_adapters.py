from __future__ import annotations

from pathlib import Path
import unittest
from unittest.mock import patch

from adapters import EngineFailure, verify_master


def probe(channels: int = 2) -> dict:
    return {
        "streams": [
            {
                "codec_type": "video",
                "width": 2160,
                "height": 3840,
                "r_frame_rate": "24/1",
            },
            {
                "codec_type": "audio",
                "sample_rate": "48000",
                "channels": channels,
            },
        ],
        "format": {"duration": "72.250"},
    }


class MasterContractTests(unittest.TestCase):
    @patch("adapters.media_probe", return_value=probe())
    def test_vertical_4k_stereo_master_passes(self, _media_probe) -> None:
        verified = verify_master(Path("microdrama.mp4"), target_duration=72.25)
        self.assertEqual(verified["streams"][1]["channels"], 2)

    @patch("adapters.media_probe", return_value=probe(channels=1))
    def test_mono_master_is_rejected(self, _media_probe) -> None:
        with self.assertRaisesRegex(EngineFailure, "stereo 48 kHz"):
            verify_master(Path("microdrama.mp4"), target_duration=72.25)


if __name__ == "__main__":
    unittest.main()
