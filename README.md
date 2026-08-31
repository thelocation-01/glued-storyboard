# Glued Storyboard Studio

Glued Storyboard turns a narration script and a set of still images into a downloadable 1080p H.264/AAC video. It runs locally, generates one continuous Kokoro Bella narration track, and applies restrained pans and slow zooms instead of shaky image motion.

## Highlights

- Script-to-scene storyboard creation
- Ordered import of ChatGPT-generated PNG, JPG, and WebP images
- Kokoro `af_bella` narration with warm cinematic pacing
- Tightened sentence gaps for more continuous delivery
- Stable slow zoom, zoom-out, and sideways pan presets
- Editable scripts and scene timing
- Lumen and Glued storyboard ZIP import
- Local Remotion rendering to a YouTube-ready 1920x1080 MP4
- No OpenAI API key

## Requirements

- Windows 10 or 11
- Node.js 22 or newer
- Python 3.12
- Approximately 2 GB of free disk space for dependencies, the local voice model, and rendering

## Install

Clone the repository, open PowerShell in its folder, and run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Setup-Glued-Storyboard.ps1
```

The setup script installs the Node and Python dependencies, downloads the official Kokoro ONNX model and voice bank, and verifies their SHA-256 hashes.

After setup, double-click `Start-Glued-Storyboard.cmd`. The launcher opens the first available local address from `http://localhost:3210` through `http://localhost:3219`.

## Create a video

1. Choose **New video from script**.
2. Enter a title and paste the complete narration script.
3. Choose **Create storyboard from script**.
4. Generate the requested images in ChatGPT and save them as `001.png`, `002.png`, `003.png`, and so on.
5. Choose **Import ChatGPT images**. Glued places them into scenes in filename order.
6. Keep **Bella — warm and cinematic** selected and choose **Create continuous narration**.
7. Preview the stable photo motion, then choose **Render 1080p**.

Projects, imported images, narration files, and rendered videos remain local and are ignored by Git.

## Bella voice configuration

The production voice is locked in `voice.config.json`:

- Provider: `kokoro-onnx-local`
- Voice: `af_bella`
- Language: `en-us`
- Default speed: `0.85`
- Sample rate: `24000`

The app compresses long silent gaps after synthesis while retaining short natural pauses.

## Model files and licences

Large voice-model files are intentionally not committed to this repository. The setup script downloads them from the official [kokoro-onnx model release](https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0). The kokoro-onnx runtime is MIT-licensed and the Kokoro model is Apache-2.0, as documented by the [kokoro-onnx project](https://github.com/thewh1teagle/kokoro-onnx).

Only publish scripts and images that you have permission to use.
