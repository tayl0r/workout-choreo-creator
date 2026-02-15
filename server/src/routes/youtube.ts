import { Router, Request, Response } from "express";
import { execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { v4 as uuidv4 } from "uuid";
import { getDb, PROJECT_ROOT } from "../db/index.js";
import { serializeSongFile, SongFile } from "../services/dsl.js";

const router = Router();

const DATA_DIR = path.join(PROJECT_ROOT, "data");
const SONGS_DIR = path.join(DATA_DIR, "songs");
const SONG_FILES_DIR = path.join(DATA_DIR, "files", "songs");
const SCRIPTS_DIR = path.join(PROJECT_ROOT, "scripts");
const VENV_PYTHON = path.join(SCRIPTS_DIR, ".venv", "bin", "python3");

/**
 * Sanitize a string to create a safe filename.
 * Lowercase, replace spaces with hyphens, remove special chars, append uuid suffix.
 */
function sanitizeFilename(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const suffix = uuidv4().split("-")[0]; // short uuid prefix
  return `${base}-${suffix}`;
}

interface YtSearchResult {
  id: string;
  title: string;
  channel: string;
  duration: number;
  thumbnail: string;
  url: string;
  view_count: number;
  like_count: number;
  channel_follower_count: number;
}

/**
 * POST /search — Search YouTube via yt-dlp.
 * Body: { query: string }
 */
router.post("/search", (req: Request, res: Response) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== "string") {
      res.status(400).json({ error: "query is required and must be a string" });
      return;
    }

    const sanitizedQuery = query.replace(/"/g, '\\"');

    let stdout: string;
    try {
      stdout = execSync(`yt-dlp --dump-json "ytsearch10:${sanitizedQuery}"`, {
        timeout: 30_000,
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (execErr: unknown) {
      // yt-dlp may write partial output to stdout even on error
      const execError = execErr as { stdout?: string; stderr?: string; message?: string };
      if (execError.stdout && execError.stdout.trim().length > 0) {
        stdout = execError.stdout;
      } else {
        const detail = (execError.stderr || execError.message || "").toString().trim();
        console.error("yt-dlp search error:", detail);
        res.status(500).json({ error: `YouTube search failed: ${detail}` });
        return;
      }
    }

    const lines = stdout.trim().split("\n").filter((line) => line.trim().length > 0);
    const results: YtSearchResult[] = [];

    for (const line of lines) {
      try {
        const data = JSON.parse(line);

        // Pick the best thumbnail
        let thumbnail = "";
        if (data.thumbnails && Array.isArray(data.thumbnails) && data.thumbnails.length > 0) {
          // Thumbnails are usually sorted by quality; pick the last (highest quality)
          thumbnail = data.thumbnails[data.thumbnails.length - 1].url || "";
        } else if (data.thumbnail) {
          thumbnail = data.thumbnail;
        }

        results.push({
          id: data.id || "",
          title: data.title || "",
          channel: data.channel || data.uploader || "",
          duration: data.duration || 0,
          thumbnail,
          url: data.webpage_url || data.url || "",
          view_count: data.view_count || 0,
          like_count: data.like_count || 0,
          channel_follower_count: data.channel_follower_count || 0,
        });
      } catch {
        // Skip malformed JSON lines
        continue;
      }
    }

    res.json(results);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("Search error:", err);
    res.status(500).json({ error: `YouTube search failed: ${detail}` });
  }
});

/**
 * POST /download — Download a YouTube video as audio, detect beats, save to DB.
 * Body: { url: string, title: string }
 */
router.post("/download", (req: Request, res: Response) => {
  try {
    const { url, title } = req.body;

    if (!url || typeof url !== "string") {
      res.status(400).json({ error: "url is required and must be a string" });
      return;
    }

    if (!title || typeof title !== "string") {
      res.status(400).json({ error: "title is required and must be a string" });
      return;
    }

    // Ensure output directories exist
    if (!fs.existsSync(SONGS_DIR)) {
      fs.mkdirSync(SONGS_DIR, { recursive: true });
    }
    if (!fs.existsSync(SONG_FILES_DIR)) {
      fs.mkdirSync(SONG_FILES_DIR, { recursive: true });
    }

    // Generate safe filename
    const safeName = sanitizeFilename(title);
    const outputPath = path.join(SONGS_DIR, `${safeName}.%(ext)s`);
    const expectedWavPath = path.join(SONGS_DIR, `${safeName}.wav`);

    // Download audio with yt-dlp
    console.log(`Downloading: ${title} from ${url}`);
    try {
      execSync(
        `yt-dlp -x --audio-format wav -o "${outputPath}" "${url}"`,
        {
          timeout: 120_000,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "inherit"],
        }
      );
    } catch (dlErr: unknown) {
      const dlError = dlErr as { stderr?: string; message?: string };
      console.error("yt-dlp download error:", dlError.stderr || dlError.message);
      res.status(500).json({ error: "Failed to download audio" });
      return;
    }

    // Verify the file was created
    if (!fs.existsSync(expectedWavPath)) {
      res.status(500).json({ error: "Downloaded file not found after conversion" });
      return;
    }

    // Get audio duration via ffprobe
    let duration = 0;
    try {
      const durationStr = execSync(
        `ffprobe -v error -show_entries format=duration -of csv=p=0 "${expectedWavPath}"`,
        {
          timeout: 10_000,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        }
      ).trim();
      duration = parseFloat(durationStr) || 0;
    } catch (probeErr: unknown) {
      const probeError = probeErr as { message?: string };
      console.error("ffprobe error:", probeError.message);
      // Duration will remain 0
    }

    // Run beat detection
    let bpm: number | null = null;
    let beats: number[] = [];
    const beatDetectScript = path.join(SCRIPTS_DIR, "beat_detect.py");

    if (fs.existsSync(beatDetectScript)) {
      try {
        const beatOutput = execSync(
          `"${VENV_PYTHON}" "${beatDetectScript}" "${expectedWavPath}"`,
          {
            timeout: 120_000,
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"],
          }
        ).trim();

        const beatData = JSON.parse(beatOutput);
        bpm = beatData.bpm || null;
        beats = Array.isArray(beatData.beats) ? beatData.beats : [];
      } catch (beatErr: unknown) {
        const beatError = beatErr as { message?: string };
        console.error("Beat detection error:", beatError.message);
        // Continue without beat data
      }
    } else {
      console.warn("Beat detection script not found at:", beatDetectScript);
    }

    // Create .song DSL file
    const relativeFilepath = `songs/${safeName}.wav`;
    const songFileData: SongFile = {
      name: title,
      artist: "unknown",
      duration: Math.round(duration * 1000) / 1000,
      bpm: bpm ?? 0,
      filepath: relativeFilepath,
      beats,
    };

    const dslContent = serializeSongFile(songFileData);
    const dslFilePath = path.join(SONG_FILES_DIR, `${safeName}.song`);
    fs.writeFileSync(dslFilePath, dslContent, "utf-8");

    // Insert into database
    const db = getDb();
    const beatsJson = beats.length > 0 ? JSON.stringify(beats) : null;

    const stmt = db.prepare(`
      INSERT INTO songs (name, duration, bpm, beats, filepath, youtube_url)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertResult = stmt.run(
      title,
      duration,
      bpm,
      beatsJson,
      relativeFilepath,
      url
    );

    const newSong = db.prepare("SELECT * FROM songs WHERE id = ?").get(insertResult.lastInsertRowid);

    // Parse beats for the response
    const response = {
      ...(newSong as Record<string, unknown>),
      beats: beats,
    };

    console.log(`Downloaded and saved: ${title} (id: ${insertResult.lastInsertRowid})`);
    res.status(201).json(response);
  } catch (err) {
    console.error("Download error:", err);
    res.status(500).json({ error: "Failed to download and process audio" });
  }
});

export default router;
