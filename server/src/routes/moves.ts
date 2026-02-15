import { Router, Request, Response } from "express";
import path from "node:path";
import fs from "node:fs";
import { nanoid } from "nanoid";
import { PROJECT_ROOT } from "../db/index.js";
import {
  parseMovesFile,
  serializeMovesFile,
  parseMoveBlock,
  serializeMoveBlock,
  normalizeDescription,
  type Move,
} from "../services/dsl.js";
import { SEED_MOVES } from "../services/seedMoves.js";

const router = Router();

const MOVES_DIR = path.join(PROJECT_ROOT, "data", "files", "moves");
const MOVES_FILE = path.join(MOVES_DIR, "all.moves");

/**
 * Ensure the moves directory and seed file exist.
 */
function ensureMovesFile(): void {
  if (!fs.existsSync(MOVES_DIR)) {
    fs.mkdirSync(MOVES_DIR, { recursive: true });
  }
  if (!fs.existsSync(MOVES_FILE)) {
    const content = serializeMovesFile(SEED_MOVES);
    fs.writeFileSync(MOVES_FILE, content, "utf-8");
  }
}

/**
 * Read and parse all moves from the file.
 */
function readMoves(): Move[] {
  ensureMovesFile();
  const content = fs.readFileSync(MOVES_FILE, "utf-8");
  return parseMovesFile(content);
}

/**
 * Write an array of moves back to the file.
 */
function writeMoves(moves: Move[]): void {
  const content = serializeMovesFile(moves);
  fs.writeFileSync(MOVES_FILE, content, "utf-8");
}

/**
 * GET / — List all moves as { id, name, raw } objects.
 * Optional ?tag= query param filters by tag (case-insensitive).
 */
router.get("/", (req: Request, res: Response) => {
  try {
    let moves = readMoves();

    const tag = req.query.tag;
    if (tag && typeof tag === "string") {
      const tagLower = tag.toLowerCase();
      moves = moves.filter((m) =>
        m.tags.some((t) => t.toLowerCase() === tagLower)
      );
    }

    const result = moves.map((m) => ({
      id: m.id,
      name: m.name,
      raw: serializeMoveBlock(m),
    }));

    res.json(result);
  } catch (err) {
    console.error("Error listing moves:", err);
    res.status(500).json({ error: "Failed to list moves" });
  }
});

/**
 * POST / — Add a new move.
 * Body: { raw: string }
 */
router.post("/", (req: Request, res: Response) => {
  try {
    const { raw } = req.body;

    if (!raw || typeof raw !== "string") {
      res.status(400).json({ error: "raw is required and must be a string" });
      return;
    }

    const move = parseMoveBlock(raw);
    // Assign a fresh ID (parseMoveBlock may have generated one, but we
    // explicitly set it here for clarity)
    move.id = nanoid(10);

    if (!move.name.trim()) {
      console.error(`Rejected POST /moves: empty name. Raw: ${JSON.stringify(raw)}`);
      res.status(400).json({ error: "Move must have a name" });
      return;
    }

    const moves = readMoves();

    // Check for duplicate name (case-insensitive)
    const nameLower = move.name.toLowerCase();
    const duplicate = moves.find((m) => m.name.toLowerCase() === nameLower);
    if (duplicate) {
      res.status(409).json({ error: `Move "${move.name}" already exists` });
      return;
    }

    moves.push(move);
    writeMoves(moves);

    res.status(201).json({ id: move.id, name: move.name, raw: serializeMoveBlock(move) });
  } catch (err) {
    console.error("Error creating move:", err);
    res.status(500).json({ error: "Failed to create move" });
  }
});

/**
 * PUT /:id — Update an existing move by ID.
 * Body: { raw: string }
 */
router.put("/:id", (req: Request<{ id: string }>, res: Response) => {
  try {
    const { raw } = req.body;

    if (!raw || typeof raw !== "string") {
      res.status(400).json({ error: "raw is required and must be a string" });
      return;
    }

    const updatedMove = parseMoveBlock(raw);

    if (!updatedMove.name.trim()) {
      console.error(`Rejected PUT /moves/${req.params.id}: empty name. Raw: ${JSON.stringify(raw)}`);
      res.status(400).json({ error: "Move must have a name" });
      return;
    }

    const moves = readMoves();

    const index = moves.findIndex((m) => m.id === req.params.id);

    if (index === -1) {
      res.status(404).json({ error: `Move with id "${req.params.id}" not found` });
      return;
    }

    // Preserve the original ID
    updatedMove.id = moves[index].id;
    moves[index] = updatedMove;
    writeMoves(moves);

    res.json({ id: updatedMove.id, name: updatedMove.name, raw: serializeMoveBlock(updatedMove) });
  } catch (err) {
    console.error("Error updating move:", err);
    res.status(500).json({ error: "Failed to update move" });
  }
});

/**
 * DELETE /:id — Remove a move by ID.
 */
router.delete("/:id", (req: Request<{ id: string }>, res: Response) => {
  try {
    const moves = readMoves();

    const index = moves.findIndex((m) => m.id === req.params.id);

    if (index === -1) {
      res.status(404).json({ error: `Move with id "${req.params.id}" not found` });
      return;
    }

    const removed = moves[index];
    moves.splice(index, 1);
    writeMoves(moves);

    res.json({ success: true, id: removed.id, name: removed.name });
  } catch (err) {
    console.error("Error deleting move:", err);
    res.status(500).json({ error: "Failed to delete move" });
  }
});

const OLLAMA_MODELS = (process.env.OLLAMA_MODELS || process.env.OLLAMA_MODEL || "gemma3")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);
let ollamaModelIndex = 0;

/**
 * POST /suggest-description — Use Ollama to suggest a move description.
 * Body: { name: string, hint?: string }
 */
router.post("/suggest-description", async (req: Request, res: Response) => {
  try {
    const { name, hint } = req.body;

    if (!name || typeof name !== "string") {
      res.status(400).json({ error: "name is required" });
      return;
    }

    const model = OLLAMA_MODELS[ollamaModelIndex % OLLAMA_MODELS.length];
    ollamaModelIndex++;
    const ollamaUrl = "http://localhost:11434/api/generate";

    const hintLine = hint && typeof hint === "string" ? `, ${hint}` : "";
    const prompt = `You are a combat fitness expert. Given a move name, respond with a single short lowercase description (under 15 words) of the technique. No quotes, no punctuation at the end.\n\nMove name: ${name}${hintLine}`;

    let response: globalThis.Response;
    try {
      response = await fetch(ollamaUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt, stream: false }),
      });
    } catch (fetchErr) {
      res.status(503).json({ error: "Ollama is not running. Start it with: ollama serve" });
      return;
    }

    if (!response.ok) {
      const text = await response.text();
      console.error("Ollama error:", response.status, text);
      res.status(502).json({ error: "Ollama returned an error" });
      return;
    }

    const data = await response.json();
    const description = normalizeDescription((data.response || "").trim());

    res.json({ description, model });
  } catch (err) {
    console.error("Error suggesting description:", err);
    res.status(500).json({ error: "Failed to generate suggestion" });
  }
});

export default router;
