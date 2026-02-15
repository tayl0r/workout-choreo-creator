# Workout Choreo Creator

A DAW-inspired tool for creating workout choreography synced to music. Search and download songs from YouTube, automatically detect beats, and visualize waveforms with beat markers.

## Prerequisites

Install these system dependencies before running:

```bash
brew install yt-dlp ffmpeg
```

- **yt-dlp** — YouTube search and audio download
- **ffmpeg** (includes ffprobe) — audio format conversion and duration detection

## Getting Started

```bash
pnpm install
```

Set up the Python venv for beat detection:

```bash
python3 -m venv scripts/.venv
scripts/.venv/bin/pip install librosa numpy
```

Then start the dev servers:

```bash
pnpm dev
```

This starts both the server (http://localhost:3001) and client (http://localhost:5173).
