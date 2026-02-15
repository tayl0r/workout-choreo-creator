import { Router, Request, Response } from "express";
import path from "node:path";
import fs from "node:fs";
import { getDb, PROJECT_ROOT } from "../db/index.js";

const router = Router();

const DATA_DIR = path.join(PROJECT_ROOT, "data");

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
    const songFilesDir = path.join(DATA_DIR, "files", "songs");
    if (fs.existsSync(songFilesDir)) {
      const dslFiles = fs.readdirSync(songFilesDir);
      for (const file of dslFiles) {
        if (file.endsWith(".song")) {
          const filePath = path.join(songFilesDir, file);
          const content = fs.readFileSync(filePath, "utf-8");
          if (
            song.filepath &&
            typeof song.filepath === "string" &&
            content.includes(song.filepath)
          ) {
            fs.unlinkSync(filePath);
            break;
          }
        }
      }
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

export default router;
