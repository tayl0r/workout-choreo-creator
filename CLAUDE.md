# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install                    # Install all workspace dependencies
pnpm dev                        # Start both server (:3001) and client (:5173) concurrently
pnpm run dev:server             # Start only the server (tsx watch, auto-reload)
pnpm run dev:client             # Start only the client (Vite dev server)
pnpm build                      # Build both server and client
pnpm --filter server exec tsc --noEmit   # Type-check server
pnpm --filter client exec tsc --noEmit   # Type-check client
```

No linter is configured yet.

### E2E Tests

Playwright (Chromium) with tests in `e2e/`. Config in `playwright.config.ts` auto-starts both dev servers.

```bash
pnpm exec playwright test               # Run all e2e tests (headless)
pnpm exec playwright test --headed       # Run with visible browser
pnpm exec playwright test e2e/moves.spec.ts  # Run specific test file
```

## Prerequisites

The server shells out to these CLI tools at runtime:
- **yt-dlp** — YouTube search and audio download
- **ffprobe** (from ffmpeg) — audio format conversion and duration detection
- **Python venv** at `scripts/.venv` with `librosa` and `numpy` — beat detection (`scripts/beat_detect.py`). The server invokes `scripts/.venv/bin/python3` directly. See README.md for venv setup.
- **Ollama** (optional) — local LLM for move description suggestions. `ollama serve` must be running on port 11434. Model set via `OLLAMA_MODELS` env var (default `gemma3`).

## Architecture

pnpm workspace monorepo with two packages (`client/`, `server/`) plus a Python script in `scripts/`.

### Server (`server/`)

Express + TypeScript + better-sqlite3. Runs on port 3001. CORS allows only `http://localhost:5173`.

**Module resolution**: Uses `NodeNext` — all local imports must use `.js` extensions (e.g., `import app from "./routes/songs.js"`). The client uses `bundler` resolution and omits extensions.

- **`src/db/index.ts`** — SQLite setup with WAL mode and foreign keys enabled. Exports `PROJECT_ROOT` (resolved from `__dirname` up three levels to repo root), `initDb()`, and `getDb()`. All path resolution across the server uses `PROJECT_ROOT` as the base. Database operations are synchronous (better-sqlite3). Schema: `songs` table with columns `id` (TEXT PK), `name`, `duration` (REAL), `bpm` (REAL), `beats` (TEXT, JSON array of timestamps), `filepath`, `youtube_url`, `created_at`.
- **`src/routes/songs.ts`** — `GET /` (list), `GET /:id` (detail, parses beats JSON to array), `PUT /:id` (update name), `DELETE /:id` (removes DB record + WAV + .song file), `GET /:id/audio` (stream WAV)
- **`src/routes/songs.ts` (parts)** — `GET /:id/parts`, `POST /:id/parts`, `PUT /:id/parts/:partId`, `DELETE /:id/parts/:partId`. Parts stored in `.song` DSL files alongside song metadata.
- **`src/routes/youtube.ts`** — `POST /search` (yt-dlp `--dump-json ytsearch10:`), `POST /download` (download pipeline: yt-dlp WAV extraction → ffprobe duration → beat_detect.py → write .song DSL file → insert into SQLite). Uses `execSync` with timeouts (30s search, 120s download/beat detection). Downloaded files are named as sanitized-title-{uuid}.wav.
- **`src/routes/moves.ts`** — CRUD for moves (`GET /`, `POST /`, `PUT /:id`, `DELETE /:id`). Moves are stored in a single flat file `data/files/moves/all.moves`, seeded from `src/services/seedMoves.ts` on first run. `POST /suggest-description` calls Ollama (local LLM) to generate a move description; model configurable via `OLLAMA_MODELS` env var (comma-separated for round-robin, default `gemma3`).
- **`src/services/dsl.ts`** — Parser/serializer for `.song` and `.move` DSL formats. `normalizeDescription()` lowercases and strips trailing punctuation from descriptions. `parseTags()` strips `[]` brackets then splits on commas/whitespace. Stub type interfaces for future formats (`.seq`, `.part`, `.choreo`).

Runtime data lives in `data/` at the repo root (gitignored): `data/choreo.db`, `data/songs/*.wav`, `data/files/songs/*.song`, `data/files/moves/all.moves`.

### Client (`client/`)

React 19 + Vite + Tailwind CSS v4 + Zustand. Vite proxies `/api` to `localhost:3001`.

- **State** — Single Zustand store in `stores/appStore.ts` manages active component, sidebar state (persisted to localStorage key `choreo-creator-app`), selected song ID, and playback state. Only `sidebarOpen` is persisted; all other state resets on reload.
- **API layer** — `services/api.ts` wraps all fetch calls to `/api/*`. All endpoints must use the `handleResponse<T>()` helper for consistent error handling — never manually parse responses.
- **Moves** — `components/moves/MoveCard.tsx` renders each move as an editable textarea. Tags display in `[bracket]` format (client-side only — server stores comma-separated). Auto-wraps bare tags in brackets on space. Auto-saves on blur or after 3s debounce. `parseTags()` is exported for shared use. `components/moves/MovesView.tsx` manages the grid of MoveCards with tag filtering chips.
- **Errors** — `stores/errorStore.ts` provides `pushError()` (callable anywhere). `components/layout/ErrorConsole.tsx` renders errors in a collapsible panel at the bottom.
- **Timeline** — `components/timeline/TimelineVisualizer.tsx` wraps WaveSurfer.js v7. Beat markers are rendered as absolute-positioned DOM elements in an overlay div. Exposes `window.__choreoPlayPause` for the global spacebar handler in `App.tsx`.
- **Song Designer** — `components/song-designer/SongDesignerView.tsx` for parts-based song structuring. `PartPill.tsx` renders draggable/resizable part pills on the timeline. `PartsTrack.tsx` is the scrollable track container. `PartNameDropdown.tsx` provides preset part name selection.
- **Timeline Store** — `stores/timelineStore.ts` (Zustand) shares playback position, duration, and beats between TimelineVisualizer and Song Designer.
- **Shared utilities** — `utils/formatTime.ts` (m:ss format) and `utils/snapToBeat.ts` (binary-search snap to nearest beat). Reuse these instead of writing inline equivalents.
- **Layout** — Collapsible sidebar + main panel. Songs view uses `react-resizable-panels` for a split between SongLibrary (left) and YouTubeSearch (right).

### DSL File Formats

Line-based text files. `.song` uses `key value` per line for metadata, plus `[parts]` section with `name startBeat endBeat @id` lines. `.moves` uses blocks:

```
# move name
description (lowercased, no trailing punctuation)
tag1, tag2, tag3
@nanoid
```

Descriptions are normalized on parse (`normalizeDescription`). Tags are stored comma-separated on disk; the client wraps them in `[brackets]` for display only. `.seq`, `.part`, `.choreo` have type stubs in `server/src/services/dsl.ts` and `client/src/types/index.ts`.

## GitHub

PRs are squash-merged. The repo has merge commits and rebase merges disabled.

**Workflow**: Create a `feature/<name>` branch before starting new features. When complete, push, open a PR, and squash-merge it.

### Styling

Dark DAW-inspired theme using CSS custom properties defined in `client/src/index.css` (e.g., `--bg-primary`, `--accent`). Components reference these via inline `style` props or Tailwind arbitrary values. Desktop-only, min-width 1200px.
