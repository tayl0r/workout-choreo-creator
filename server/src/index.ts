import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Prepend timestamps to all console output
const timestamp = () => new Date().toLocaleTimeString("en-US", { hour12: false });
const origLog = console.log;
const origError = console.error;
const origWarn = console.warn;
console.log = (...args: unknown[]) => origLog(`[${timestamp()}]`, ...args);
console.error = (...args: unknown[]) => origError(`[${timestamp()}]`, ...args);
console.warn = (...args: unknown[]) => origWarn(`[${timestamp()}]`, ...args);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import express from "express";
import cors from "cors";
import fs from "node:fs";
import { initDb, DATA_DIR } from "./db/index.js";
import songsRouter from "./routes/songs.js";
import youtubeRouter from "./routes/youtube.js";
import movesRouter from "./routes/moves.js";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

const app = express();

// ----- Middleware -----
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());

// ----- Ensure data directories exist -----
const dataDirs = [
  path.join(DATA_DIR, "songs"),
  path.join(DATA_DIR, "files", "songs"),
  path.join(DATA_DIR, "files", "moves"),
];

for (const dir of dataDirs) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
}

// ----- Initialize database -----
try {
  initDb();
  console.log("Database initialized successfully");
} catch (err) {
  console.error("Failed to initialize database:", err);
  process.exit(1);
}

// ----- Routes -----
app.use("/api/songs", songsRouter);
app.use("/api/youtube", youtubeRouter);
app.use("/api/moves", movesRouter);

// ----- Health check -----
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ----- Start server -----
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
});

export default app;
