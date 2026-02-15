import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const DATA_TEST = path.join(PROJECT_ROOT, "data-test");

/**
 * Generate a minimal valid WAV file (1 second of silence, 16-bit mono 44100 Hz).
 */
function makeSilentWav(): Buffer {
  const sampleRate = 44100;
  const numSamples = sampleRate; // 1 second
  const bytesPerSample = 2; // 16-bit
  const dataSize = numSamples * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);

  // fmt sub-chunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // sub-chunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * bytesPerSample, 28); // byte rate
  buffer.writeUInt16LE(bytesPerSample, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample

  // data sub-chunk (all zeros = silence)
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
}

export default function globalSetup() {
  // Clean slate
  if (fs.existsSync(DATA_TEST)) {
    fs.rmSync(DATA_TEST, { recursive: true });
  }

  // Create directories
  const dirs = [
    path.join(DATA_TEST, "songs"),
    path.join(DATA_TEST, "files", "songs"),
    path.join(DATA_TEST, "files", "moves"),
  ];
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write a 1-second silent WAV
  const wavFilename = "test-song-abc12345.wav";
  const wavPath = path.join(DATA_TEST, "songs", wavFilename);
  fs.writeFileSync(wavPath, makeSilentWav());

  // Create the SQLite database with the songs table and one seed row
  const dbPath = path.join(DATA_TEST, "choreo.db");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS songs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      duration REAL NOT NULL,
      bpm REAL,
      beats TEXT,
      filepath TEXT NOT NULL,
      youtube_url TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  const relPath = `songs/${wavFilename}`;
  const beats = [0.5, 1.0];
  db.prepare(
    `INSERT INTO songs (name, duration, bpm, beats, filepath, youtube_url)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run("Test Song", 1.0, 120, JSON.stringify(beats), relPath, null);
  db.close();

  // Write a matching .song DSL file
  const songDsl = [
    "name Test Song",
    "artist unknown",
    "duration 1",
    "bpm 120",
    `filepath ${relPath}`,
    `beats ${beats.join(" ")}`,
    "",
  ].join("\n");
  fs.writeFileSync(
    path.join(DATA_TEST, "files", "songs", "test-song-abc12345.song"),
    songDsl,
    "utf-8"
  );
}
