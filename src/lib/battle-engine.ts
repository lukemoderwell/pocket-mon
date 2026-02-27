import type { Monster, Move } from "./types";
import { getDefaultMoves } from "./normalize-moves";

export interface BattleRound {
  attacker: string;
  defender: string;
  damage: number;
  attackerHp: number;
  defenderHp: number;
  moveName: string;
  moveEffect: string;
}

export interface BattleResult {
  winner: Monster;
  loser: Monster;
  rounds: BattleRound[];
}

/** Per-fighter state tracked during battle */
interface FighterState {
  monster: Monster;
  hp: number;
  moves: Move[];
  cooldowns: [number, number]; // cooldown remaining for move 0 and 1
  defenseModifier: number;     // 1.0 = normal, 0.6 = guarded, 1.25 = exposed
}

/** Struggle: fallback when both moves are on cooldown */
const STRUGGLE: Move = { name: "Struggle", effect: "strike", power: 0.5, cooldown: 0 };

/**
 * Select which move to use based on HP ratio, cooldowns, and game state.
 *
 * Heuristic:
 * - Healthy (>70% HP): prefer rush for big damage if available
 * - Desperate (<30% HP): prefer guard to survive if available
 * - Otherwise: pick best available (highest power off cooldown)
 * - If both moves on cooldown: Struggle
 *
 * TODO: This is a great place for the user to customize!
 * The function receives the fighter's full state and opponent state,
 * so you can make it as sophisticated as you like.
 */
function selectMove(fighter: FighterState, opponent: FighterState): { move: Move; moveIndex: number } {
  const available: { move: Move; index: number }[] = [];
  for (let i = 0; i < fighter.moves.length; i++) {
    if (fighter.cooldowns[i] === 0) {
      available.push({ move: fighter.moves[i], index: i });
    }
  }

  // Both on cooldown → Struggle
  if (available.length === 0) {
    return { move: STRUGGLE, moveIndex: -1 };
  }

  const hpRatio = fighter.hp / fighter.monster.hp;

  // Healthy: prefer rush for big damage
  if (hpRatio > 0.7) {
    const rush = available.find((m) => m.move.effect === "rush");
    if (rush) return { move: rush.move, moveIndex: rush.index };
  }

  // Desperate: prefer guard to survive
  if (hpRatio < 0.3) {
    const guard = available.find((m) => m.move.effect === "guard");
    if (guard) return { move: guard.move, moveIndex: guard.index };
  }

  // Default: pick highest power available
  available.sort((a, b) => b.move.power - a.move.power);
  return { move: available[0].move, moveIndex: available[0].index };
}

export function runBattle(monster1: Monster, monster2: Monster): BattleResult {
  const getMoves = (m: Monster): Move[] =>
    Array.isArray(m.moves) && m.moves.length > 0 ? m.moves : getDefaultMoves(m.stage);

  // Speed determines turn order
  const [first, second] = monster1.speed >= monster2.speed
    ? [monster1, monster2]
    : [monster2, monster1];

  const fighters: [FighterState, FighterState] = [
    {
      monster: first,
      hp: first.hp,
      moves: getMoves(first),
      cooldowns: [0, 0],
      defenseModifier: 1.0,
    },
    {
      monster: second,
      hp: second.hp,
      moves: getMoves(second),
      cooldowns: [0, 0],
      defenseModifier: 1.0,
    },
  ];

  const rounds: BattleRound[] = [];

  const calcDamage = (attacker: FighterState, defender: FighterState, move: Move): number => {
    const raw = Math.max(1, attacker.monster.attack - Math.floor(defender.monster.defense * 0.6));
    const variance = 0.8 + Math.random() * 0.4;
    return Math.max(1, Math.round(raw * variance * move.power * defender.defenseModifier));
  };

  const executeTurn = (attackerIdx: 0 | 1) => {
    const defenderIdx = attackerIdx === 0 ? 1 : 0;
    const attacker = fighters[attackerIdx];
    const defender = fighters[defenderIdx];

    const { move, moveIndex } = selectMove(attacker, defender);
    const damage = calcDamage(attacker, defender, move);

    defender.hp = Math.max(0, defender.hp - damage);

    // After being hit, defender's modifier resets to normal
    defender.defenseModifier = 1.0;

    // Apply post-attack effects
    if (move.effect === "guard") {
      attacker.defenseModifier = 0.6; // Take 40% less on next hit
    } else if (move.effect === "rush") {
      attacker.defenseModifier = 1.25; // Take 25% more on next hit
    }

    // Set cooldown for the used move
    if (moveIndex >= 0) {
      attacker.cooldowns[moveIndex] = move.cooldown;
    }

    rounds.push({
      attacker: attacker.monster.name,
      defender: defender.monster.name,
      damage,
      attackerHp: attacker.hp,
      defenderHp: defender.hp,
      moveName: move.name,
      moveEffect: move.effect,
    });
  };

  const tickCooldowns = (fighter: FighterState) => {
    fighter.cooldowns[0] = Math.max(0, fighter.cooldowns[0] - 1);
    fighter.cooldowns[1] = Math.max(0, fighter.cooldowns[1] - 1);
  };

  // Battle loop (max 20 rounds to prevent infinite)
  for (let i = 0; i < 20; i++) {
    executeTurn(0);
    if (fighters[1].hp <= 0) break;

    executeTurn(1);
    if (fighters[0].hp <= 0) break;

    // Tick cooldowns at end of each full round
    tickCooldowns(fighters[0]);
    tickCooldowns(fighters[1]);
  }

  const firstWins = fighters[0].hp > fighters[1].hp;
  return {
    winner: firstWins ? first : second,
    loser: firstWins ? second : first,
    rounds,
  };
}
