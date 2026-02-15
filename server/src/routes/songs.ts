import { Router, Request, Response } from "express";
import path from "node:path";
import fs from "node:fs";
import { nanoid } from "nanoid";
import { getDb, PROJECT_ROOT } from "../db/index.js";
import { parseSongFile, serializeSongFile } from "../services/dsl.js";
import type { SongPart, Stance } from "../services/dsl.js";

const router = Router();

const DATA_DIR = path.join(PROJECT_ROOT, "data");
const SONG_FILES_DIR = path.join(DATA_DIR, "files", "songs");

const VALID_STANCES: Stance[] = ["Right", "Left", "Centered"];

/**
 * Find the .song DSL file path for a given song filepath value.
 * Scans all .song files in the songs directory.
 */
function findSongFilePath(songFilepath: string): string | null {
  if (!fs.existsSync(SONG_FILES_DIR)) return null;
  const dslFiles = fs.readdirSync(SONG_FILES_DIR);
  for (const file of dslFiles) {
    if (!file.endsWith(".song")) continue;
    const filePath = path.join(SONG_FILES_DIR, file);
    const content = fs.readFileSync(filePath, "utf-8");
    if (content.includes(songFilepath)) {
      return filePath;
    }
  }
  return null;
}

/**
 * GET / — List all songs (summary fields) ordered by created_at desc.
 */
router.get("/", (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const songs = db
      .prepare(
        `SELECT id, name, duration, bpm, created_at
         FROM songs
         ORDER BY created_at DESC`
      )
      .all();

    res.json(songs);
  } catch (err) {
    console.error("Error listing songs:", err);
    res.status(500).json({ error: "Failed to list songs" });
  }
});

/**
 * GET /:id — Full song details, with beats parsed from JSON string to array.
 */
router.get("/:id", (req: Request, res: Response) => {
  try {
    const db = getDb();
    const song = db.prepare("SELECT * FROM songs WHERE id = ?").get(req.params.id) as
      | Record<string, unknown>
      | undefined;

    if (!song) {
      res.status(404).json({ error: "Song not found" });
      return;
    }

    // Parse beats from JSON string to array
    let beats: number[] = [];
    if (song.beats && typeof song.beats === "string") {
      try {
        beats = JSON.parse(song.beats as string);
      } catch {
        beats = [];
      }
    }

    res.json({ ...song, beats });
  } catch (err) {
    console.error("Error fetching song:", err);
    res.status(500).json({ error: "Failed to fetch song" });
  }
});

/**
 * PUT /:id — Update song metadata (name).
 * Body: { name: string }
 */
router.put("/:id", (req: Request, res: Response) => {
  try {
    const { name } = req.body;

    if (!name || typeof name !== "string") {
      res.status(400).json({ error: "name is required and must be a string" });
      return;
    }

    const db = getDb();
    const result = db
      .prepare("UPDATE songs SET name = ? WHERE id = ?")
      .run(name.trim(), req.params.id);

    if (result.changes === 0) {
      res.status(404).json({ error: "Song not found" });
      return;
    }

    const updated = db.prepare("SELECT * FROM songs WHERE id = ?").get(req.params.id) as
      | Record<string, unknown>
      | undefined;

    if (updated && updated.beats && typeof updated.beats === "string") {
      try {
        (updated as Record<string, unknown>).beats = JSON.parse(updated.beats as string);
      } catch {
        (updated as Record<string, unknown>).beats = [];
      }
    }

    res.json(updated);
  } catch (err) {
    console.error("Error updating song:", err);
    res.status(500).json({ error: "Failed to update song" });
  }
});

/**
 * DELETE /:id — Delete song record and its audio file from disk.
 */
router.delete("/:id", (req: Request, res: Response) => {
  try {
    const db = getDb();
    const song = db.prepare("SELECT * FROM songs WHERE id = ?").get(req.params.id) as
      | Record<string, unknown>
      | undefined;

    if (!song) {
      res.status(404).json({ error: "Song not found" });
      return;
    }

    // Delete the audio file from disk
    if (song.filepath && typeof song.filepath === "string") {
      const audioPath = path.join(DATA_DIR, song.filepath);
      if (fs.existsSync(audioPath)) {
        fs.unlinkSync(audioPath);
      }
    }

    // Delete the .song DSL file if it exists
    if (song.filepath && typeof song.filepath === "string") {
      const dslPath = findSongFilePath(song.filepath);
      if (dslPath) fs.unlinkSync(dslPath);
    }

    db.prepare("DELETE FROM songs WHERE id = ?").run(req.params.id);

    res.json({ success: true, id: Number(req.params.id) });
  } catch (err) {
    console.error("Error deleting song:", err);
    res.status(500).json({ error: "Failed to delete song" });
  }
});

/**
 * GET /:id/audio — Serve the audio file with appropriate Content-Type.
 */
router.get("/:id/audio", (req: Request, res: Response) => {
  try {
    const db = getDb();
    const song = db.prepare("SELECT filepath FROM songs WHERE id = ?").get(req.params.id) as
      | { filepath: string }
      | undefined;

    if (!song) {
      res.status(404).json({ error: "Song not found" });
      return;
    }

    const audioPath = path.join(DATA_DIR, song.filepath);

    if (!fs.existsSync(audioPath)) {
      res.status(404).json({ error: "Audio file not found on disk" });
      return;
    }

    // Determine Content-Type from file extension
    const ext = path.extname(audioPath).toLowerCase();
    const contentTypes: Record<string, string> = {
      ".wav": "audio/wav",
      ".mp3": "audio/mpeg",
      ".ogg": "audio/ogg",
      ".m4a": "audio/mp4",
      ".flac": "audio/flac",
      ".aac": "audio/aac",
      ".webm": "audio/webm",
    };

    const contentType = contentTypes[ext] || "application/octet-stream";
    res.setHeader("Content-Type", contentType);

    const stat = fs.statSync(audioPath);
    res.setHeader("Content-Length", stat.size);

    const stream = fs.createReadStream(audioPath);
    stream.pipe(res);
  } catch (err) {
    console.error("Error serving audio:", err);
    res.status(500).json({ error: "Failed to serve audio" });
  }
});

// ----- Parts CRUD (sub-resource of songs) -----

/** Helper: look up song filepath and resolve .song DSL file, returning parsed song + path. */
function loadSongFile(songId: string | string[]): { songFile: ReturnType<typeof parseSongFile>; dslPath: string; filepath: string } | null {
  if (Array.isArray(songId)) return null;
  const db = getDb();
  const song = db.prepare("SELECT filepath FROM songs WHERE id = ?").get(songId) as
    | { filepath: string }
    | undefined;
  if (!song) return null;

  const dslPath = findSongFilePath(song.filepath);
  if (!dslPath) return null;

  const content = fs.readFileSync(dslPath, "utf-8");
  return { songFile: parseSongFile(content), dslPath, filepath: song.filepath };
}

function partsOverlap(a: { startTime: number; endTime: number }, b: { startTime: number; endTime: number }): boolean {
  return a.startTime < b.endTime && a.endTime > b.startTime;
}

/**
 * GET /:id/parts — List all parts for a song.
 */
router.get("/:id/parts", (req: Request, res: Response) => {
  try {
    const loaded = loadSongFile(req.params.id);
    if (!loaded) {
      res.status(404).json({ error: "Song or song file not found" });
      return;
    }
    res.json(loaded.songFile.parts);
  } catch (err) {
    console.error("Error listing parts:", err);
    res.status(500).json({ error: "Failed to list parts" });
  }
});

/**
 * POST /:id/parts — Create a new part.
 * Body: { name, startTime, endTime, stance }
 */
router.post("/:id/parts", (req: Request, res: Response) => {
  try {
    const { name, startTime, endTime, stance } = req.body;

    if (!name || typeof name !== "string") {
      res.status(400).json({ error: "name is required" });
      return;
    }
    if (typeof startTime !== "number" || typeof endTime !== "number" || endTime <= startTime) {
      res.status(400).json({ error: "startTime and endTime must be numbers with endTime > startTime" });
      return;
    }
    if (!VALID_STANCES.includes(stance)) {
      res.status(400).json({ error: `stance must be one of: ${VALID_STANCES.join(", ")}` });
      return;
    }

    const loaded = loadSongFile(req.params.id);
    if (!loaded) {
      res.status(404).json({ error: "Song or song file not found" });
      return;
    }

    const newRange = { startTime, endTime };
    for (const existing of loaded.songFile.parts) {
      if (partsOverlap(newRange, existing)) {
        res.status(409).json({ error: `Overlaps with part "${existing.name}"` });
        return;
      }
    }

    const part: SongPart = { id: nanoid(10), name: name.trim(), startTime, endTime, stance };
    loaded.songFile.parts.push(part);
    loaded.songFile.parts.sort((a, b) => a.startTime - b.startTime);
    fs.writeFileSync(loaded.dslPath, serializeSongFile(loaded.songFile), "utf-8");

    res.status(201).json(part);
  } catch (err) {
    console.error("Error creating part:", err);
    res.status(500).json({ error: "Failed to create part" });
  }
});

/**
 * PUT /:id/parts/:partId — Update a part (partial).
 * Body: { name?, startTime?, endTime?, stance? }
 */
router.put("/:id/parts/:partId", (req: Request, res: Response) => {
  try {
    const loaded = loadSongFile(req.params.id);
    if (!loaded) {
      res.status(404).json({ error: "Song or song file not found" });
      return;
    }

    const partIndex = loaded.songFile.parts.findIndex((p) => p.id === req.params.partId);
    if (partIndex === -1) {
      res.status(404).json({ error: "Part not found" });
      return;
    }

    const part = loaded.songFile.parts[partIndex];
    const { name, startTime, endTime, stance } = req.body;

    if (name !== undefined) part.name = String(name).trim();
    if (stance !== undefined) {
      if (!VALID_STANCES.includes(stance)) {
        res.status(400).json({ error: `stance must be one of: ${VALID_STANCES.join(", ")}` });
        return;
      }
      part.stance = stance;
    }
    if (startTime !== undefined) part.startTime = startTime;
    if (endTime !== undefined) part.endTime = endTime;

    if (part.endTime <= part.startTime) {
      res.status(400).json({ error: "endTime must be greater than startTime" });
      return;
    }

    // Check overlap against other parts
    for (let i = 0; i < loaded.songFile.parts.length; i++) {
      if (i === partIndex) continue;
      if (partsOverlap(part, loaded.songFile.parts[i])) {
        res.status(409).json({ error: `Overlaps with part "${loaded.songFile.parts[i].name}"` });
        return;
      }
    }

    loaded.songFile.parts.sort((a, b) => a.startTime - b.startTime);
    fs.writeFileSync(loaded.dslPath, serializeSongFile(loaded.songFile), "utf-8");

    res.json(part);
  } catch (err) {
    console.error("Error updating part:", err);
    res.status(500).json({ error: "Failed to update part" });
  }
});

/**
 * DELETE /:id/parts/:partId — Delete a part.
 */
router.delete("/:id/parts/:partId", (req: Request, res: Response) => {
  try {
    const loaded = loadSongFile(req.params.id);
    if (!loaded) {
      res.status(404).json({ error: "Song or song file not found" });
      return;
    }

    const partIndex = loaded.songFile.parts.findIndex((p) => p.id === req.params.partId);
    if (partIndex === -1) {
      res.status(404).json({ error: "Part not found" });
      return;
    }

    loaded.songFile.parts.splice(partIndex, 1);
    fs.writeFileSync(loaded.dslPath, serializeSongFile(loaded.songFile), "utf-8");

    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting part:", err);
    res.status(500).json({ error: "Failed to delete part" });
  }
});

export default router;
