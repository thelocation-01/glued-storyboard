"""Generate Glued Storyboard narration with the bundled Kokoro Bella voice."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import soundfile as sf
from kokoro_onnx import Kokoro


APP_ROOT = Path(__file__).resolve().parents[1]


def resolve_from_app(value: str) -> Path:
    candidate = Path(value)
    return candidate if candidate.is_absolute() else (APP_ROOT / candidate).resolve()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, help="UTF-8 narration text file")
    parser.add_argument("--output", required=True, help="Destination WAV file")
    parser.add_argument("--speed", type=float, help="Optional speech-speed override")
    args = parser.parse_args()

    config = json.loads((APP_ROOT / "voice.config.json").read_text(encoding="utf-8"))
    input_path = Path(args.input).resolve()
    output_path = Path(args.output).resolve()
    text = input_path.read_text(encoding="utf-8").strip()
    if not text:
        raise ValueError(f"Narration is empty: {input_path}")

    speed = args.speed if args.speed is not None else float(config["speed"])
    model = Kokoro(resolve_from_app(config["modelPath"]), resolve_from_app(config["voicesPath"]))
    samples, sample_rate = model.create(
        text,
        voice=config["voiceId"],
        speed=speed,
        lang=config["language"],
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(output_path, samples, sample_rate, subtype="PCM_16")

    print(json.dumps({
        "output": str(output_path),
        "voice": config["voiceId"],
        "displayName": config["displayName"],
        "speed": speed,
        "sampleRate": sample_rate,
        "durationSeconds": round(len(samples) / sample_rate, 3),
    }))


if __name__ == "__main__":
    main()
