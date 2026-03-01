import type { Move, MoveEffect, MoveCategory } from "./types";

/** Power and cooldown rules per effect type */
const EFFECT_RULES: Record<MoveEffect, { minPower: number; maxPower: number; cooldown: number }> = {
  strike: { minPower: 0.8, maxPower: 1.2, cooldown: 0 },
  guard:  { minPower: 0.4, maxPower: 0.7, cooldown: 1 },
  rush:   { minPower: 1.5, maxPower: 2.0, cooldown: 2 },
  drain:  { minPower: 0.8, maxPower: 1.1, cooldown: 1 },
  stun:   { minPower: 0.5, maxPower: 0.8, cooldown: 2 },
};

/** Higher stages get a small power ceiling boost */
const STAGE_BONUS: Record<number, number> = {
  1: 0,
  2: 0.1,
  3: 0.2,
};

const VALID_EFFECTS: MoveEffect[] = ["strike", "guard", "rush", "drain", "stun"];
const VALID_CATEGORIES: MoveCategory[] = ["physical", "special"];

/**
 * Validate and normalize an AI-generated move.
 * Clamps power into the allowed range for the effect type (with stage bonus),
 * and enforces the correct cooldown.
 */
export function normalizeMove(raw: Partial<Move>, stage: number): Move {
  const effect: MoveEffect = VALID_EFFECTS.includes(raw.effect as MoveEffect)
    ? (raw.effect as MoveEffect)
    : "strike";

  const category: MoveCategory = VALID_CATEGORIES.includes(raw.category as MoveCategory)
    ? (raw.category as MoveCategory)
    : "physical";

  const rules = EFFECT_RULES[effect];
  const bonus = STAGE_BONUS[stage] ?? 0;
  const maxPower = rules.maxPower + bonus;

  const power = typeof raw.power === "number"
    ? Math.round(Math.min(maxPower, Math.max(rules.minPower, raw.power)) * 100) / 100
    : Math.round(((rules.minPower + maxPower) / 2) * 100) / 100;

  const name = typeof raw.name === "string" && raw.name.trim().length > 0
    ? raw.name.trim().slice(0, 30)
    : `${effect.charAt(0).toUpperCase() + effect.slice(1)} Move`;

  return { name, effect, category, power, cooldown: rules.cooldown };
}

/**
 * Normalize an array of AI-generated moves.
 * Ensures exactly 2 moves. Falls back to defaults if input is invalid.
 */
export function normalizeMoves(rawMoves: unknown, stage: number): Move[] {
  if (!Array.isArray(rawMoves) || rawMoves.length === 0) {
    return getDefaultMoves(stage);
  }

  const moves = rawMoves.slice(0, 2).map((m) => normalizeMove(m, stage));

  // Pad to 2 if only 1 was provided
  if (moves.length < 2) {
    moves.push(normalizeMove({ name: "Wild Charge", effect: "rush", category: "physical" }, stage));
  }

  return moves;
}

/**
 * Fallback moves for monsters created before the moves system existed.
 */
export function getDefaultMoves(stage = 1): Move[] {
  const bonus = STAGE_BONUS[stage] ?? 0;
  return [
    { name: "Basic Strike", effect: "strike", category: "physical", power: Math.round((1.0 + bonus) * 100) / 100, cooldown: 0 },
    { name: "Wild Charge", effect: "rush", category: "physical", power: Math.round((1.7 + bonus) * 100) / 100, cooldown: 2 },
  ];
}
