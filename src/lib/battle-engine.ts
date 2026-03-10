import type { Monster, Move } from './types';
import { getDefaultMoves } from './normalize-moves';

export interface BattleRound {
  attacker: string;
  defender: string;
  damage: number;
  attackerHp: number;
  defenderHp: number;
  moveName: string;
  moveEffect: string;
  moveCategory: string;
  healAmount: number;
  stunned: boolean;
  wasStunned: boolean;
  missed: boolean; // true if attack missed (accuracy + dodge)
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
  defenseModifier: number; // 1.0 = normal, 0.3 = guarded, 1.25 = exposed
  guardHitsLeft: number; // how many incoming hits the guard buff absorbs (0 = no guard)
  stunned: boolean; // skip next turn
}

/** Struggle: fallback when both moves are on cooldown */
const STRUGGLE: Move = {
  name: 'Struggle',
  effect: 'strike',
  category: 'physical',
  power: 0.5,
  cooldown: 0,
  accuracy: 1.0,
};

/**
 * Estimate damage a move would deal (average, ignoring variance).
 */
function estimateDamage(
  attacker: FighterState,
  defender: FighterState,
  move: Move,
): number {
  const category = move.category || 'physical';
  const atkStat =
    category === 'special'
      ? (attacker.monster.sp_attack ?? attacker.monster.attack)
      : attacker.monster.attack;
  const raw = Math.max(1, atkStat - Math.floor(defender.monster.defense * 0.6));
  return Math.max(1, Math.round(raw * move.power * defender.defenseModifier));
}

/**
 * Select which move to use based on HP ratio, cooldowns, and game state.
 *
 * Priority:
 * 1. If we can likely finish off the opponent → pick the best killing blow
 * 2. Opponent is guarded → prefer stun/drain (don't waste big hits into a wall)
 * 3. Healthy + opponent exposed → rush for big damage
 * 4. Healthy → stun for crowd control
 * 5. Hurt but opponent is also hurt → drain to sustain while dealing damage
 * 6. Taking heavy damage and NOT close to killing → guard to weather the storm
 * 7. Default → highest power available
 */
function selectMove(
  fighter: FighterState,
  opponent: FighterState,
): { move: Move; moveIndex: number } {
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

  // Only one option → use it
  if (available.length === 1) {
    return { move: available[0].move, moveIndex: available[0].index };
  }

  const hpRatio = fighter.hp / fighter.monster.hp;
  const opponentHpRatio = opponent.hp / opponent.monster.hp;

  const find = (effect: string) =>
    available.find((m) => m.move.effect === effect);

  // --- PRIORITY 1: Finish them off ---
  // Can any available move likely kill the opponent? If so, pick the best one.
  const killShots = available.filter(
    (m) => estimateDamage(fighter, opponent, m.move) >= opponent.hp,
  );
  if (killShots.length > 0) {
    // Among kill shots, prefer highest accuracy (most reliable kill)
    killShots.sort(
      (a, b) => (b.move.accuracy ?? 1) - (a.move.accuracy ?? 1),
    );
    return { move: killShots[0].move, moveIndex: killShots[0].index };
  }

  // --- PRIORITY 2: Opponent is heavily guarded → don't waste big moves ---
  if (opponent.defenseModifier <= 0.5) {
    // Opponent is guarded — prefer stun (bypass the wall) or drain (sustain)
    const stun = find('stun');
    if (stun) return { move: stun.move, moveIndex: stun.index };
    const drain = find('drain');
    if (drain) return { move: drain.move, moveIndex: drain.index };
  }

  // --- PRIORITY 3: Healthy + opponent exposed → rush for big damage ---
  if (hpRatio > 0.6 && opponent.defenseModifier >= 1.0) {
    const rush = find('rush');
    if (rush) return { move: rush.move, moveIndex: rush.index };
  }

  // --- PRIORITY 4: Healthy → stun for crowd control ---
  if (hpRatio > 0.6) {
    const stun = find('stun');
    if (stun) return { move: stun.move, moveIndex: stun.index };
  }

  // --- PRIORITY 5: Hurt but opponent is also hurting → drain to sustain ---
  if (hpRatio < 0.6 && opponentHpRatio < 0.6) {
    const drain = find('drain');
    if (drain) return { move: drain.move, moveIndex: drain.index };
  }

  // --- PRIORITY 6: Taking a beating and can't kill soon → guard up ---
  if (hpRatio < 0.35 && opponentHpRatio > 0.3) {
    const guard = find('guard');
    if (guard) return { move: guard.move, moveIndex: guard.index };
  }

  // --- PRIORITY 7: Default → pick highest power available ---
  available.sort((a, b) => b.move.power - a.move.power);
  return { move: available[0].move, moveIndex: available[0].index };
}

export function runBattle(monster1: Monster, monster2: Monster): BattleResult {
  const getMoves = (m: Monster): Move[] =>
    Array.isArray(m.moves) && m.moves.length > 0
      ? m.moves
      : getDefaultMoves(m.stage);

  // Speed determines turn order
  const [first, second] =
    monster1.speed >= monster2.speed
      ? [monster1, monster2]
      : [monster2, monster1];

  const fighters: [FighterState, FighterState] = [
    {
      monster: first,
      hp: first.hp,
      moves: getMoves(first),
      cooldowns: [0, 0],
      defenseModifier: 1.0,
      guardHitsLeft: 0,
      stunned: false,
    },
    {
      monster: second,
      hp: second.hp,
      moves: getMoves(second),
      cooldowns: [0, 0],
      defenseModifier: 1.0,
      guardHitsLeft: 0,
      stunned: false,
    },
  ];

  const rounds: BattleRound[] = [];

  const getAttackStat = (fighter: FighterState, move: Move): number => {
    const category = move.category || 'physical';
    return category === 'special'
      ? (fighter.monster.sp_attack ?? fighter.monster.attack)
      : fighter.monster.attack;
  };

  const calcDamage = (
    attacker: FighterState,
    defender: FighterState,
    move: Move,
  ): number => {
    const atkStat = getAttackStat(attacker, move);
    const raw = Math.max(
      1,
      atkStat - Math.floor(defender.monster.defense * 0.6),
    );
    const variance = 0.8 + Math.random() * 0.4;
    return Math.max(
      1,
      Math.round(raw * variance * move.power * defender.defenseModifier),
    );
  };

  /**
   * Check if an attack hits, factoring in move accuracy and
   * speed-based dodge chance. Faster defenders are harder to hit.
   * Dodge chance = (defender.speed - attacker.speed) / 300, clamped to [0, 0.25].
   * Final hit chance = move.accuracy * (1 - dodgeChance).
   */
  const doesHit = (
    attacker: FighterState,
    defender: FighterState,
    move: Move,
  ): boolean => {
    const moveAccuracy = move.accuracy ?? 1.0;
    const speedDiff = defender.monster.speed - attacker.monster.speed;
    const dodgeChance = Math.min(0.25, Math.max(0, speedDiff / 300));
    const hitChance = moveAccuracy * (1 - dodgeChance);
    return Math.random() < hitChance;
  };

  const executeTurn = (attackerIdx: 0 | 1) => {
    const defenderIdx = attackerIdx === 0 ? 1 : 0;
    const attacker = fighters[attackerIdx];
    const defender = fighters[defenderIdx];

    // Check if stunned
    if (attacker.stunned) {
      attacker.stunned = false;
      rounds.push({
        attacker: attacker.monster.name,
        defender: defender.monster.name,
        damage: 0,
        attackerHp: attacker.hp,
        defenderHp: defender.hp,
        moveName: 'Stunned',
        moveEffect: 'stun',
        moveCategory: 'physical',
        healAmount: 0,
        stunned: false,
        wasStunned: true,
        missed: false,
      });
      return;
    }

    const { move, moveIndex } = selectMove(attacker, defender);

    // Set cooldown for the used move (even on miss)
    if (moveIndex >= 0) {
      attacker.cooldowns[moveIndex] = move.cooldown;
    }

    // Check accuracy + speed-based dodge
    if (!doesHit(attacker, defender, move)) {
      // Miss: rush still leaves attacker exposed
      if (move.effect === 'rush') {
        attacker.defenseModifier = 1.25;
      }
      rounds.push({
        attacker: attacker.monster.name,
        defender: defender.monster.name,
        damage: 0,
        attackerHp: attacker.hp,
        defenderHp: defender.hp,
        moveName: move.name,
        moveEffect: move.effect,
        moveCategory: move.category || 'physical',
        healAmount: 0,
        stunned: false,
        wasStunned: false,
        missed: true,
      });
      return;
    }

    const damage = calcDamage(attacker, defender, move);
    let healAmount = 0;

    defender.hp = Math.max(0, defender.hp - damage);

    // After being hit, consume guard if active; otherwise reset modifier
    if (defender.guardHitsLeft > 0) {
      defender.guardHitsLeft -= 1;
      if (defender.guardHitsLeft === 0) {
        defender.defenseModifier = 1.0; // guard expired
      }
      // else: guard persists for remaining hits
    } else {
      defender.defenseModifier = 1.0;
    }

    // Apply post-attack effects
    if (move.effect === 'guard') {
      attacker.defenseModifier = 0.3; // Take 70% less damage for 2 incoming hits
      attacker.guardHitsLeft = 2;
    } else if (move.effect === 'rush') {
      attacker.defenseModifier = 1.25; // Take 25% more on next hit
    } else if (move.effect === 'drain') {
      healAmount = Math.round(damage * 0.6);
      attacker.hp = Math.min(attacker.monster.hp, attacker.hp + healAmount);
    } else if (move.effect === 'stun') {
      // 40% chance to stun opponent
      if (Math.random() < 0.4) {
        defender.stunned = true;
      }
    }

    rounds.push({
      attacker: attacker.monster.name,
      defender: defender.monster.name,
      damage,
      attackerHp: attacker.hp,
      defenderHp: defender.hp,
      moveName: move.name,
      moveEffect: move.effect,
      moveCategory: move.category || 'physical',
      healAmount,
      stunned: defender.stunned,
      wasStunned: false,
      missed: false,
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
