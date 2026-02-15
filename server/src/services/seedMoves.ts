import { nanoid } from "nanoid";
import type { Move } from "./dsl.js";

/**
 * Seed data: ~20 common combat/kickboxing moves used to pre-populate the move
 * library on first run. Each gets a unique nanoid when the seed file is first
 * written.
 */
export const SEED_MOVES: Move[] = [
  // ── Punches ──────────────────────────────────────────────
  {
    id: nanoid(10),
    name: "jab",
    description: "Quick, straight punch with the lead hand",
    tags: ["punch", "basic"],
  },
  {
    id: nanoid(10),
    name: "cross",
    description: "Powerful straight punch with the rear hand",
    tags: ["punch", "power", "basic"],
  },
  {
    id: nanoid(10),
    name: "hook",
    description: "Circular punch targeting the side of the head or body",
    tags: ["punch", "power", "basic"],
  },
  {
    id: nanoid(10),
    name: "uppercut",
    description: "Rising punch driven upward toward the chin",
    tags: ["punch", "power", "basic"],
  },
  {
    id: nanoid(10),
    name: "body hook",
    description: "Hook aimed at the ribs or midsection",
    tags: ["punch", "power"],
  },
  {
    id: nanoid(10),
    name: "overhand",
    description: "Looping punch thrown over the opponent's guard",
    tags: ["punch", "power", "advanced"],
  },

  // ── Kicks ────────────────────────────────────────────────
  {
    id: nanoid(10),
    name: "front kick",
    description: "Thrusting kick driven straight forward with the ball of the foot",
    tags: ["kick", "basic"],
  },
  {
    id: nanoid(10),
    name: "roundhouse kick",
    description: "Rotational kick striking with the shin or instep",
    tags: ["kick", "power", "basic"],
  },
  {
    id: nanoid(10),
    name: "side kick",
    description: "Linear kick driven sideways with the heel",
    tags: ["kick", "power"],
  },
  {
    id: nanoid(10),
    name: "back kick",
    description: "Spinning rear kick driven straight back with the heel",
    tags: ["kick", "power", "advanced"],
  },

  // ── Strikes ──────────────────────────────────────────────
  {
    id: nanoid(10),
    name: "knee strike",
    description: "Close-range upward strike with the knee",
    tags: ["knee", "power", "basic"],
  },
  {
    id: nanoid(10),
    name: "elbow strike",
    description: "Short-range strike using the point of the elbow",
    tags: ["elbow", "power", "advanced"],
  },

  // ── Defense ──────────────────────────────────────────────
  {
    id: nanoid(10),
    name: "bob and weave",
    description: "Duck under a punch and shift weight side to side",
    tags: ["defense", "basic"],
  },
  {
    id: nanoid(10),
    name: "slip",
    description: "Small lateral head movement to avoid a straight punch",
    tags: ["defense", "basic"],
  },
  {
    id: nanoid(10),
    name: "block",
    description: "Absorb an incoming strike with the arms or shins",
    tags: ["defense", "basic"],
  },
  {
    id: nanoid(10),
    name: "parry",
    description: "Redirect an incoming punch with a small hand deflection",
    tags: ["defense", "basic"],
  },

  // ── Footwork / Defense ───────────────────────────────────
  {
    id: nanoid(10),
    name: "shuffle forward",
    description: "Quick step forward maintaining fighting stance",
    tags: ["footwork", "basic"],
  },
  {
    id: nanoid(10),
    name: "shuffle back",
    description: "Quick step backward maintaining fighting stance",
    tags: ["footwork", "basic"],
  },
  {
    id: nanoid(10),
    name: "switch stance",
    description: "Swap lead and rear foot to change stance orientation",
    tags: ["footwork", "advanced"],
  },
  {
    id: nanoid(10),
    name: "sprawl",
    description: "Drop hips and extend legs back to defend a takedown",
    tags: ["defense", "footwork", "advanced"],
  },
];
