# Moves Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a move library with a file-backed DSL, REST API, and grid-of-textareas UI with auto-save.

**Architecture:** Single `data/files/moves/all.moves` file stores all moves as `# name` / description / tags blocks. Server reads/writes this file via DSL parser. Client displays each move as an editable textarea card in a grid, auto-saving on blur or 3s debounce.

**Tech Stack:** Express routes (server), DSL parser in `dsl.ts` (server), React component with auto-sizing textareas (client)

---

### Task 1: Move DSL Parser/Serializer

**Files:**
- Modify: `server/src/services/dsl.ts`

**Step 1: Replace the MoveFile stub with the new Move interface and parser/serializer**

Replace the `MoveFile` stub interface (lines 90-95) with:

```typescript
// ----- Move DSL -----

export interface Move {
  name: string;
  description: string;
  tags: string[];
}

/**
 * Parse a single move block (3 lines: # name, description, tags).
 */
export function parseMoveBlock(text: string): Move {
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

  const nameLine = lines[0] || "";
  const name = nameLine.startsWith("#") ? nameLine.slice(1).trim() : nameLine;
  const description = lines[1] || "";
  const tags =
    lines[2]
      ?.split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0) ?? [];

  return { name, description, tags };
}

/**
 * Serialize a single Move to a DSL text block.
 */
export function serializeMoveBlock(move: Move): string {
  return `# ${move.name}\n${move.description}\n${move.tags.join(", ")}`;
}

/**
 * Parse an all.moves file into an array of Moves.
 * Blocks are separated by blank lines.
 */
export function parseMovesFile(content: string): Move[] {
  const blocks = content
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  return blocks.map(parseMoveBlock);
}

/**
 * Serialize an array of Moves back to all.moves file format.
 */
export function serializeMovesFile(moves: Move[]): string {
  return moves.map(serializeMoveBlock).join("\n\n") + "\n";
}
```

**Step 2: Verify server type-checks**

Run: `pnpm --filter server exec tsc --noEmit`
Expected: PASS (no errors)

**Step 3: Commit**

```
feat: add Move DSL parser and serializer
```

---

### Task 2: Seed Data

**Files:**
- Create: `server/src/services/seedMoves.ts`

**Step 1: Create the seed moves file**

```typescript
import type { Move } from "./dsl.js";

export const SEED_MOVES: Move[] = [
  { name: "jab", description: "Quick straight punch with lead hand", tags: ["punch", "basic"] },
  { name: "cross", description: "Powerful straight punch with rear hand", tags: ["punch", "basic", "power"] },
  { name: "hook", description: "Short circular punch to the side of the head", tags: ["punch", "basic", "power"] },
  { name: "uppercut", description: "Rising punch targeting the chin", tags: ["punch", "power"] },
  { name: "body hook", description: "Hook aimed at the ribs or liver", tags: ["punch", "power"] },
  { name: "overhand", description: "Looping punch thrown over the top", tags: ["punch", "power"] },
  { name: "front kick", description: "Straight kick with the ball of the foot", tags: ["kick", "basic"] },
  { name: "roundhouse kick", description: "Circular kick with the shin", tags: ["kick", "power"] },
  { name: "side kick", description: "Lateral thrust kick with the heel", tags: ["kick", "power"] },
  { name: "back kick", description: "Spinning rear thrust kick", tags: ["kick", "power", "advanced"] },
  { name: "knee strike", description: "Close-range upward strike with the knee", tags: ["knee", "power"] },
  { name: "elbow strike", description: "Close-range strike with the elbow", tags: ["elbow", "power"] },
  { name: "bob and weave", description: "Duck under a punch with a U-shaped motion", tags: ["defense", "basic"] },
  { name: "slip", description: "Small lateral head movement to avoid a punch", tags: ["defense", "basic"] },
  { name: "block", description: "Absorb a strike with arms or shins", tags: ["defense", "basic"] },
  { name: "parry", description: "Redirect an incoming strike with a small hand motion", tags: ["defense"] },
  { name: "shuffle forward", description: "Quick step forward maintaining stance", tags: ["footwork", "basic"] },
  { name: "shuffle back", description: "Quick step backward maintaining stance", tags: ["footwork", "basic"] },
  { name: "switch stance", description: "Swap lead and rear foot", tags: ["footwork"] },
  { name: "sprawl", description: "Drop hips back and down to defend a takedown", tags: ["defense", "advanced"] },
];
```

**Step 2: Verify server type-checks**

Run: `pnpm --filter server exec tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```
feat: add seed data for default combat moves
```

---

### Task 3: Moves API Routes

**Files:**
- Create: `server/src/routes/moves.ts`
- Modify: `server/src/index.ts`

**Step 1: Create the moves router**

```typescript
import { Router, Request, Response } from "express";
import path from "node:path";
import fs from "node:fs";
import { PROJECT_ROOT } from "../db/index.js";
import {
  parseMovesFile,
  serializeMovesFile,
  parseMoveBlock,
  serializeMoveBlock,
  type Move,
} from "../services/dsl.js";
import { SEED_MOVES } from "../services/seedMoves.js";

const router = Router();

const MOVES_DIR = path.join(PROJECT_ROOT, "data", "files", "moves");
const MOVES_FILE = path.join(MOVES_DIR, "all.moves");

function ensureMovesFile(): void {
  if (!fs.existsSync(MOVES_DIR)) {
    fs.mkdirSync(MOVES_DIR, { recursive: true });
  }
  if (!fs.existsSync(MOVES_FILE)) {
    fs.writeFileSync(MOVES_FILE, serializeMovesFile(SEED_MOVES), "utf-8");
  }
}

function readMoves(): Move[] {
  ensureMovesFile();
  const content = fs.readFileSync(MOVES_FILE, "utf-8");
  return parseMovesFile(content);
}

function writeMoves(moves: Move[]): void {
  ensureMovesFile();
  fs.writeFileSync(MOVES_FILE, serializeMovesFile(moves), "utf-8");
}

/**
 * GET / — List all moves. Optional ?tag= filter.
 * Returns array of { name, raw }.
 */
router.get("/", (req: Request, res: Response) => {
  try {
    let moves = readMoves();
    const tag = req.query.tag;
    if (typeof tag === "string" && tag.trim()) {
      const filterTag = tag.trim().toLowerCase();
      moves = moves.filter((m) =>
        m.tags.some((t) => t.toLowerCase() === filterTag)
      );
    }
    res.json(moves.map((m) => ({ name: m.name, raw: serializeMoveBlock(m) })));
  } catch (err) {
    console.error("Error listing moves:", err);
    res.status(500).json({ error: "Failed to list moves" });
  }
});

/**
 * POST / — Create a new move.
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
    if (!move.name) {
      res.status(400).json({ error: "First line must be # <name>" });
      return;
    }

    const moves = readMoves();
    const existing = moves.find(
      (m) => m.name.toLowerCase() === move.name.toLowerCase()
    );
    if (existing) {
      res.status(409).json({ error: `Move "${move.name}" already exists` });
      return;
    }

    moves.push(move);
    writeMoves(moves);
    res.status(201).json({ name: move.name, raw: serializeMoveBlock(move) });
  } catch (err) {
    console.error("Error creating move:", err);
    res.status(500).json({ error: "Failed to create move" });
  }
});

/**
 * PUT /:name — Update a move.
 * Body: { raw: string }
 */
router.put("/:name", (req: Request, res: Response) => {
  try {
    const { raw } = req.body;
    if (!raw || typeof raw !== "string") {
      res.status(400).json({ error: "raw is required and must be a string" });
      return;
    }

    const updated = parseMoveBlock(raw);
    if (!updated.name) {
      res.status(400).json({ error: "First line must be # <name>" });
      return;
    }

    const moves = readMoves();
    const idx = moves.findIndex(
      (m) => m.name.toLowerCase() === req.params.name.toLowerCase()
    );
    if (idx === -1) {
      res.status(404).json({ error: "Move not found" });
      return;
    }

    moves[idx] = updated;
    writeMoves(moves);
    res.json({ name: updated.name, raw: serializeMoveBlock(updated) });
  } catch (err) {
    console.error("Error updating move:", err);
    res.status(500).json({ error: "Failed to update move" });
  }
});

/**
 * DELETE /:name — Delete a move.
 */
router.delete("/:name", (req: Request, res: Response) => {
  try {
    const moves = readMoves();
    const idx = moves.findIndex(
      (m) => m.name.toLowerCase() === req.params.name.toLowerCase()
    );
    if (idx === -1) {
      res.status(404).json({ error: "Move not found" });
      return;
    }

    moves.splice(idx, 1);
    writeMoves(moves);
    res.json({ success: true, name: req.params.name });
  } catch (err) {
    console.error("Error deleting move:", err);
    res.status(500).json({ error: "Failed to delete move" });
  }
});

export default router;
```

**Step 2: Register the moves router in `server/src/index.ts`**

Add import after the youtube import:

```typescript
import movesRouter from "./routes/moves.js";
```

Add route after the youtube route:

```typescript
app.use("/api/moves", movesRouter);
```

Add `data/files/moves` to the `dataDirs` array:

```typescript
path.join(dataDir, "files", "moves"),
```

**Step 3: Verify server type-checks**

Run: `pnpm --filter server exec tsc --noEmit`
Expected: PASS

**Step 4: Commit**

```
feat: add moves API routes with file-backed storage
```

---

### Task 4: Client API Layer

**Files:**
- Modify: `client/src/services/api.ts`
- Modify: `client/src/types/index.ts`

**Step 1: Add MoveEntry type to `client/src/types/index.ts`**

```typescript
export interface MoveEntry {
  name: string;
  raw: string;
}
```

**Step 2: Add moves API functions to `client/src/services/api.ts`**

```typescript
import type { Song, YouTubeResult, MoveEntry } from '../types';

// ... existing functions ...

export async function fetchMoves(tag?: string): Promise<MoveEntry[]> {
  const params = tag ? `?tag=${encodeURIComponent(tag)}` : '';
  const response = await fetch(`${API_BASE}/moves${params}`);
  return handleResponse<MoveEntry[]>(response);
}

export async function createMove(raw: string): Promise<MoveEntry> {
  const response = await fetch(`${API_BASE}/moves`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  });
  return handleResponse<MoveEntry>(response);
}

export async function updateMove(name: string, raw: string): Promise<MoveEntry> {
  const response = await fetch(`${API_BASE}/moves/${encodeURIComponent(name)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  });
  return handleResponse<MoveEntry>(response);
}

export async function deleteMove(name: string): Promise<void> {
  const response = await fetch(`${API_BASE}/moves/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(errorBody || response.statusText);
  }
}
```

**Step 3: Verify client type-checks**

Run: `pnpm --filter client exec tsc --noEmit`
Expected: PASS

**Step 4: Commit**

```
feat: add moves client API layer
```

---

### Task 5: MoveCard Component

**Files:**
- Create: `client/src/components/moves/MoveCard.tsx`

**Step 1: Create the MoveCard component**

A single move card with an auto-sizing textarea and auto-save logic.

```tsx
import { useState, useRef, useEffect, useCallback } from 'react';

interface MoveCardProps {
  initialRaw: string;
  /** Original name from server, null if this is a new unsaved card */
  serverName: string | null;
  onSaved: (oldName: string | null, newEntry: { name: string; raw: string }) => void;
  onDeleted: (name: string | null) => void;
  onError: (msg: string) => void;
  autoFocus?: boolean;
}

function MoveCard({ initialRaw, serverName, onSaved, onDeleted, onError, autoFocus }: MoveCardProps) {
  const [raw, setRaw] = useState(initialRaw);
  const [savedRaw, setSavedRaw] = useState(initialRaw);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameRef = useRef<string | null>(serverName);

  // Keep nameRef in sync
  nameRef.current = serverName;

  // Auto-resize textarea
  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, []);

  useEffect(() => {
    resize();
  }, [raw, resize]);

  // Auto-focus for new cards
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  const save = useCallback(async (text: string) => {
    const trimmed = text.trim();

    // Empty = delete
    if (!trimmed) {
      if (nameRef.current) {
        try {
          const { deleteMove } = await import('../../services/api');
          await deleteMove(nameRef.current);
          onDeleted(nameRef.current);
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Delete failed';
          setErrorMsg(msg);
          setStatus('error');
          onError(msg);
        }
      } else {
        // New card with no content — just remove it
        onDeleted(null);
      }
      return;
    }

    // Skip if unchanged
    if (trimmed === savedRaw.trim()) return;

    setStatus('saving');
    setErrorMsg(null);

    try {
      if (nameRef.current) {
        const { updateMove } = await import('../../services/api');
        const result = await updateMove(nameRef.current, trimmed);
        setSavedRaw(result.raw);
        onSaved(nameRef.current, result);
      } else {
        const { createMove } = await import('../../services/api');
        const result = await createMove(trimmed);
        setSavedRaw(result.raw);
        onSaved(null, result);
      }
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 1500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setErrorMsg(msg);
      setStatus('error');
      onError(msg);
    }
  }, [savedRaw, onSaved, onDeleted, onError]);

  const handleChange = (value: string) => {
    setRaw(value);
    // Reset debounce
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => save(value), 3000);
  };

  const handleBlur = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    save(raw);
  };

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div
      className="relative rounded"
      style={{
        background: 'var(--bg-tertiary)',
        border: `1px solid ${status === 'error' ? 'var(--danger)' : 'var(--border)'}`,
      }}
    >
      <textarea
        ref={textareaRef}
        value={raw}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        rows={3}
        className="w-full px-3 py-2 text-sm resize-none outline-none rounded"
        style={{
          background: 'transparent',
          color: 'var(--text-primary)',
          fontFamily: 'monospace',
          overflow: 'hidden',
        }}
        spellCheck={false}
      />
      {/* Status indicator */}
      {status === 'saved' && (
        <div
          className="absolute top-1 right-2 text-xs"
          style={{ color: 'var(--accent)' }}
        >
          saved
        </div>
      )}
      {status === 'saving' && (
        <div
          className="absolute top-1 right-2 text-xs"
          style={{ color: 'var(--text-secondary)' }}
        >
          saving...
        </div>
      )}
      {errorMsg && (
        <div
          className="px-3 pb-2 text-xs"
          style={{ color: 'var(--danger)' }}
        >
          {errorMsg}
        </div>
      )}
    </div>
  );
}

export default MoveCard;
```

**Step 2: Verify client type-checks**

Run: `pnpm --filter client exec tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```
feat: add MoveCard component with auto-save and auto-resize
```

---

### Task 6: MovesView Component

**Files:**
- Create: `client/src/components/moves/MovesView.tsx`

**Step 1: Create the MovesView component**

```tsx
import { useState, useEffect, useCallback } from 'react';
import { fetchMoves } from '../../services/api';
import type { MoveEntry } from '../../types';
import MoveCard from './MoveCard';

interface CardState {
  key: string;
  name: string | null;
  raw: string;
}

function MovesView() {
  const [cards, setCards] = useState<CardState[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMoves = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const moves = await fetchMoves();
      setCards(
        moves.map((m) => ({ key: m.name, name: m.name, raw: m.raw }))
      );
      // Derive tags from all moves
      const tagSet = new Set<string>();
      for (const m of moves) {
        // Parse tags from raw: third line, comma-separated
        const lines = m.raw.split('\n');
        if (lines[2]) {
          lines[2].split(',').forEach((t) => {
            const trimmed = t.trim();
            if (trimmed) tagSet.add(trimmed);
          });
        }
      }
      setAllTags(Array.from(tagSet).sort());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load moves');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMoves();
  }, [loadMoves]);

  const handleSaved = useCallback(
    (oldName: string | null, newEntry: { name: string; raw: string }) => {
      setCards((prev) =>
        prev.map((c) =>
          c.name === oldName || (oldName === null && c.name === null && c.raw === '')
            ? { key: newEntry.name, name: newEntry.name, raw: newEntry.raw }
            : c
        )
      );
      // Refresh tags
      loadMoves();
    },
    [loadMoves]
  );

  const handleDeleted = useCallback((name: string | null) => {
    setCards((prev) => prev.filter((c) => c.name !== name));
  }, []);

  const handleError = useCallback((msg: string) => {
    console.error('Move save error:', msg);
  }, []);

  const handleAddNew = () => {
    setCards((prev) => [...prev, { key: `new-${Date.now()}`, name: null, raw: '' }]);
  };

  // Filter cards by active tag
  const filteredCards = activeTag
    ? cards.filter((c) => {
        const lines = c.raw.split('\n');
        const tagsLine = lines[2] || '';
        const tags = tagsLine.split(',').map((t) => t.trim().toLowerCase());
        return tags.includes(activeTag.toLowerCase());
      })
    : cards;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div
          className="animate-spin rounded-full h-6 w-6"
          style={{ border: '2px solid var(--border)', borderTopColor: 'var(--accent)' }}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-secondary)' }}>
      {/* Header + tag filters */}
      <div className="px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
          Moves
        </h2>
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setActiveTag(null)}
              className="px-2 py-0.5 text-xs rounded cursor-pointer border-none outline-none transition-colors duration-150"
              style={{
                background: activeTag === null ? 'var(--accent)' : 'var(--bg-tertiary)',
                color: activeTag === null ? 'var(--bg-primary)' : 'var(--text-secondary)',
              }}
            >
              all
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(tag === activeTag ? null : tag)}
                className="px-2 py-0.5 text-xs rounded cursor-pointer border-none outline-none transition-colors duration-150"
                style={{
                  background: activeTag === tag ? 'var(--accent)' : 'var(--bg-tertiary)',
                  color: activeTag === tag ? 'var(--bg-primary)' : 'var(--text-secondary)',
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid of move cards */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {filteredCards.map((card) => (
            <MoveCard
              key={card.key}
              initialRaw={card.raw}
              serverName={card.name}
              onSaved={handleSaved}
              onDeleted={handleDeleted}
              onError={handleError}
              autoFocus={card.name === null}
            />
          ))}
          {/* Add new card */}
          <button
            onClick={handleAddNew}
            className="flex items-center justify-center rounded cursor-pointer border-none outline-none transition-colors duration-150"
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px dashed var(--border)',
              color: 'var(--text-secondary)',
              minHeight: 80,
              fontSize: 24,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.color = 'var(--accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

export default MovesView;
```

**Step 2: Verify client type-checks**

Run: `pnpm --filter client exec tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```
feat: add MovesView component with tag filtering and grid layout
```

---

### Task 7: Wire MovesView into MainPanel

**Files:**
- Modify: `client/src/components/layout/MainPanel.tsx`

**Step 1: Import MovesView and add to the routing**

Add import at top:

```typescript
import MovesView from '../moves/MovesView';
```

Remove `'moves'` from the `stubDescriptions` object.

In the JSX, change the content area to handle the moves case:

```tsx
{/* Content area */}
<div className="flex-1 min-h-0 overflow-hidden">
  {activeComponent === 'songs' ? (
    <SongsView />
  ) : activeComponent === 'moves' ? (
    <MovesView />
  ) : (
    <StubComponent
      title={stubDescriptions[activeComponent].title}
      description={stubDescriptions[activeComponent].description}
    />
  )}
</div>
```

**Step 2: Verify client type-checks**

Run: `pnpm --filter client exec tsc --noEmit`
Expected: PASS

**Step 3: Manual test**

Run: `pnpm dev`

1. Click "Moves" in sidebar — should see grid of ~20 pre-populated move cards
2. Click tag filter chips — should filter cards
3. Edit a card — should auto-save after 3s or on blur
4. Click "+" — new empty card appears, focused
5. Clear all text in a card — card should disappear (deleted)

**Step 4: Commit**

```
feat: wire MovesView into MainPanel, replacing stub
```
