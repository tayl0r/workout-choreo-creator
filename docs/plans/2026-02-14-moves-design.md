# Moves Feature Design

## Overview

A move library for combat/kickboxing choreography. Moves are the atomic building blocks — later composed into sequences, parts, and full choreographies.

## Data Format

All moves live in a single file: `data/files/moves/all.moves`

Each move is a 3-line block. Blocks are separated by blank lines.

```
# jab
Quick straight punch with lead hand
punch, basic

# cross
Powerful straight punch with rear hand
punch, basic, power

# roundhouse kick
Circular kick with the shin
kick, power
```

**Line 1:** `# <name>` — unique identifier (case-insensitive for matching)
**Line 2:** Description (free text, single line)
**Line 3:** Tags (comma-separated, trimmed)

This `# name` convention applies to all future DSL object types.

## Server

### DSL parser/serializer in `dsl.ts`

- `parseMovesFile(text: string)` — parse the full file into an array of `{ name, description, tags[] }`
- `serializeMovesFile(moves: Move[])` — serialize back to the file format
- `parseMoveBlock(text: string)` — parse a single 3-line block
- `serializeMoveBlock(move: Move)` — serialize a single move to a text block

### API routes at `/api/moves`

- `GET /` — returns array of `{ name, raw }` where `raw` is the text block for that move. Optional `?tag=` query param to filter.
- `POST /` — body: `{ raw }`. Server parses the block, appends to file, returns the parsed move with `raw`.
- `PUT /:name` — body: `{ raw }`. Server replaces that move's block in the file.
- `DELETE /:name` — removes the move's block from the file.

Server validates DSL on write: must have `# <name>` on first line, must have at least a description line. Returns 400 with error message if malformed.

### Seed data

On first `GET /` when `all.moves` doesn't exist, create it pre-populated with ~20 common combat moves: jab, cross, hook, uppercut, front kick, roundhouse kick, side kick, back kick, knee strike, elbow strike, bob and weave, slip, block, parry, shuffle forward, shuffle back, switch stance, sprawl, body hook, overhand.

## Client

### Moves view (`components/moves/`)

Replaces the current stub component when "Moves" is selected in sidebar.

**Layout:**
- Tag filter chips across the top (derived from all moves' tags)
- Grid of move cards below
- Final "+" card to create a new move

**Move card:**
- `<textarea>` showing the raw DSL text (3 lines: `# name`, description, tags)
- Auto-height: textarea grows/shrinks to fit content, no scrollbar
- Enter key works normally (adds a line, textarea expands)

**Auto-save:**
- Triggers on blur OR 3 seconds after last keystroke (whichever comes first)
- Compares current text to last-saved text; skips save if unchanged
- Empty text triggers `DELETE` instead of `PUT` — card disappears from grid
- New moves (from "+" card) use `POST`; subsequent saves use `PUT /:name`
- Brief visual indicator on save success
- Validation errors shown inline on the card

**New move flow:**
- Click "+" card
- New card appears with empty/template text, focused for editing
- Auto-save creates it via `POST` on blur/debounce
- If user clears it before saving, card just disappears (no API call)

### Styling

Same dark DAW theme. Cards use `--bg-tertiary` background, `--border` borders, monospace font in the textarea to match the DSL feel.
