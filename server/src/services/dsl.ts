import { nanoid } from "nanoid";

// ----- Song DSL -----

export type Stance = "Right" | "Left" | "Centered";

export interface SongPart {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  stance: Stance;
}

export interface SongFile {
  name: string;
  artist: string;
  duration: number;
  bpm: number;
  filepath: string;
  beats: number[];
  parts: SongPart[];
}

/**
 * Parse a .song DSL file into a typed SongFile object.
 *
 * Format:
 *   name <title>
 *   artist <artist>
 *   duration <seconds>
 *   bpm <bpm>
 *   filepath <relative path>
 *   beats <space-separated timestamps>
 */
const PART_LINE_RE = /^(\d+\.?\d*)\s+(\d+\.?\d*)\s+(Right|Left|Centered)\s+(.+?)\s+@(\S+)$/;

export function parseSongFile(content: string): SongFile {
  const lines = content.split("\n");
  const result: Partial<SongFile> = {};
  const parts: SongPart[] = [];
  let inBody = false;
  let inParts = false;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (trimmed === "#BODY") {
      inBody = true;
      continue;
    }

    if (inBody) {
      if (trimmed === "parts:") {
        inParts = true;
        continue;
      }
      if (inParts && trimmed.length > 0) {
        const match = trimmed.match(PART_LINE_RE);
        if (match) {
          parts.push({
            startTime: parseFloat(match[1]),
            endTime: parseFloat(match[2]),
            stance: match[3] as Stance,
            name: match[4],
            id: match[5],
          });
        }
      }
      continue;
    }

    if (trimmed.length === 0) continue;

    const spaceIndex = trimmed.indexOf(" ");
    if (spaceIndex === -1) continue;

    const key = trimmed.substring(0, spaceIndex).toLowerCase();
    const value = trimmed.substring(spaceIndex + 1).trim();

    switch (key) {
      case "name":
        result.name = value;
        break;
      case "artist":
        result.artist = value;
        break;
      case "duration":
        result.duration = parseFloat(value);
        break;
      case "bpm":
        result.bpm = parseFloat(value);
        break;
      case "filepath":
        result.filepath = value;
        break;
      case "beats":
        result.beats = value
          .split(/\s+/)
          .filter((v) => v.length > 0)
          .map((v) => parseFloat(v));
        break;
    }
  }

  return {
    name: result.name ?? "",
    artist: result.artist ?? "unknown",
    duration: result.duration ?? 0,
    bpm: result.bpm ?? 0,
    filepath: result.filepath ?? "",
    beats: result.beats ?? [],
    parts,
  };
}

/**
 * Serialize a SongFile object back to .song DSL format.
 */
export function serializeSongFile(song: SongFile): string {
  const lines: string[] = [
    `name ${song.name}`,
    `artist ${song.artist}`,
    `duration ${song.duration}`,
    `bpm ${song.bpm}`,
    `filepath ${song.filepath}`,
    `beats ${song.beats.join(" ")}`,
  ];

  if (song.parts.length > 0) {
    lines.push("");
    lines.push("#BODY");
    lines.push("parts:");
    for (const part of song.parts) {
      lines.push(`${part.startTime} ${part.endTime} ${part.stance} ${part.name} @${part.id}`);
    }
  }

  return lines.join("\n") + "\n";
}

// ----- Move DSL -----

export interface Move {
  id: string;
  name: string;
  description: string;
  tags: string[];
}

/** Parse tags by stripping brackets then splitting on commas/whitespace. */
function parseTags(line: string): string[] {
  return line
    .replace(/[\[\]]/g, "")
    .split(/[,\s]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/** Lowercase and strip trailing punctuation from a description. */
export function normalizeDescription(desc: string): string {
  const trimmed = desc.trim();
  if (!trimmed) return trimmed;
  return trimmed.replace(/[.!?;:,]+$/, "").toLowerCase();
}

/**
 * Parse a single move block from raw client text (no @id line).
 *
 * Format:
 *   # <name>
 *   <description>        (optional)
 *   [tag1] [tag2] or bare tags (optional)
 */
export function parseMoveBlock(text: string): Move {
  const lines = text.split("\n").map((line) => line.trim());

  const nameLine = lines[0] ?? "";
  const name = nameLine.startsWith("#") ? nameLine.substring(1).trim() : nameLine;
  const description = lines[1] ?? "";
  const tagsLine = lines[2] ?? "";
  const tags = parseTags(tagsLine);

  return { id: nanoid(10), name, description: normalizeDescription(description), tags };
}

/**
 * Serialize a single Move to its user-visible DSL block (3 lines, no ID).
 * Used for the `raw` field sent to the client.
 */
export function serializeMoveBlock(move: Move): string {
  return `# ${move.name}\n${move.description}\n${move.tags.join(", ")}`;
}

/**
 * Parse a full .moves file line-by-line. Each move starts with `# <name>`,
 * followed by optional description and tags lines, and ends with `@<id>`.
 * Throws if a new `#` is encountered before an `@id` line.
 */
export function parseMovesFile(content: string): Move[] {
  const lines = content.split("\n");
  const moves: Move[] = [];
  let current: { name: string; linesAfterName: string[] } | null = null;
  let lineNum = 0;

  for (const rawLine of lines) {
    lineNum++;
    const line = rawLine.trim();

    // Skip blank lines outside a move block
    if (line.length === 0 && current === null) continue;

    if (line.startsWith("#")) {
      // Starting a new move — previous must have been closed by @id
      if (current !== null) {
        throw new Error(`Line ${lineNum}: found new move "# ..." before @id for "${current.name}"`);
      }
      current = {
        name: line.substring(1).trim(),
        linesAfterName: [],
      };
    } else if (line.startsWith("@")) {
      if (current === null) {
        throw new Error(`Line ${lineNum}: found @id without a preceding # name`);
      }
      const id = line.substring(1);
      // Parse the collected lines: first is description, second is tags
      const desc = current.linesAfterName[0] ?? "";
      const tagsLine = current.linesAfterName[1] ?? "";
      const tags = parseTags(tagsLine);
      moves.push({ id, name: current.name, description: normalizeDescription(desc), tags });
      current = null;
    } else if (current === null) {
      throw new Error(`Line ${lineNum}: unexpected content outside a move block: "${line}"`);
    } else {
      current.linesAfterName.push(line);
    }
  }

  if (current !== null) {
    throw new Error(`File ended without @id for move "${current.name}"`);
  }

  return moves;
}

/**
 * Serialize an array of Move objects to the full .moves file format.
 * Each block includes the @id line for persistence.
 */
export function serializeMovesFile(moves: Move[]): string {
  return moves
    .map((move) => `${serializeMoveBlock(move)}\n@${move.id}`)
    .join("\n\n") + "\n";
}

// ----- Future DSL types (stubs) -----

export interface SequenceFile {
  name: string;
  bpm: number;
  moves: { name: string; beatCount: number }[];
  timing: number[];
}

export interface ChoreoFile {
  name: string;
  song: string;
  parts: { name: string; offset: number }[];
}
