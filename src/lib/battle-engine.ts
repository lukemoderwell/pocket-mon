import type { Monster, Move, MonsterType, PassiveAbility, StatusEffect } from './types';
import { getDefaultMoves } from './normalize-moves';
import { getTypeMultiplier } from './type-effectiveness';

/**
 * Check if two monsters are allowed to battle each other.
 * Stage 0 (hatchlings) can only fight other stage 0 hatchlings.
 */
export function canBattleAgainst(a: Monster, b: Monster): { ok: boolean; reason?: string } {
  if (a.stage === 0 && b.stage !== 0) {
    return { ok: false, reason: `${a.name} is a hatchling and can only battle other hatchlings` };
  }
  if (b.stage === 0 && a.stage !== 0) {
    return { ok: false, reason: `${b.name} is a hatchling and can only battle other hatchlings` };
  }
  return { ok: true };
}

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
  missed: boolean;
  critical: boolean; // true if this hit was a critical hit
  passiveTriggered: string | null; // passive ability name that activated, if any
  charging: boolean;         // true if this round is a charge-up turn
  chargeVariant: string | null; // "vulnerable" | "defensive" | null
  chargeRelease: boolean;    // true if this round is the release turn
  typeMultiplier: number;    // type effectiveness multiplier (1.5 = super effective, 0.5 = not very, 0 = immune)
  statusInflicted: StatusEffect | null; // status condition inflicted this round
  statusDamage: number;      // damage from status condition (poison/burn tick)
  statusSkipped: boolean;    // true if turn was skipped due to sleep/freeze
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
  cooldowns: number[]; // cooldown remaining per move slot (2 or 3 entries)
  defenseModifier: number; // 1.0 = normal, 0.3 = guarded, 1.25 = exposed
  guardHitsLeft: number; // how many incoming hits the guard buff absorbs (0 = no guard)
  stunned: boolean; // skip next turn
  charging: boolean;
  chargeMove: Move | null;
  passive: PassiveAbility | null;
  types: MonsterType[];
  statusCondition: StatusEffect | null; // active status condition
  sleepTurns: number; // remaining sleep turns (1-3)
}

/** Struggle: fallback when all moves are on cooldown */
const STRUGGLE: Move = {
  name: 'Struggle',
  effect: 'strike',
  category: 'physical',
  power: 0.5,
  cooldown: 0,
  accuracy: 1.0,
};

const CRIT_CHANCE = 0.12; // 12% base crit chance
const CRIT_MULTIPLIER = 1.5;

/**
 * Estimate damage a move would deal (average, ignoring variance/crits).
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
  const defScale = category === 'special' ? 0.5 : 0.7;
  const raw = Math.max(1, atkStat - Math.floor(defender.monster.defense * defScale));
  let power = move.power;
  // Account for reckless passive on rush moves
  if (attacker.passive === 'reckless' && move.effect === 'rush') {
    power *= 1.15;
  }
  return Math.max(1, Math.round(raw * power * defender.defenseModifier));
}

/**
 * Score each available move based on the current battle state, then pick
 * using a weighted-random selection so the AI favours strong plays but
 * isn't completely predictable.
 *
 * Scoring considers estimated damage, type effectiveness, HP of both
 * fighters, move effects (stun, drain, guard, rush, charge), and
 * situational bonuses/penalties so the AI doesn't tunnel on one move.
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

  // All on cooldown → Struggle
  if (available.length === 0) {
    return { move: STRUGGLE, moveIndex: -1 };
  }

  // Only one option → use it
  if (available.length === 1) {
    return { move: available[0].move, moveIndex: available[0].index };
  }

  const hpRatio = fighter.hp / fighter.monster.hp;
  const opponentHpRatio = opponent.hp / opponent.monster.hp;

  // --- Hard override: guaranteed kill shot → pick the most accurate one ---
  const killShots = available.filter(
    (m) => estimateDamage(fighter, opponent, m.move) >= opponent.hp,
  );
  if (killShots.length > 0) {
    killShots.sort(
      (a, b) => (b.move.accuracy ?? 1) - (a.move.accuracy ?? 1),
    );
    return { move: killShots[0].move, moveIndex: killShots[0].index };
  }

  // --- Score every available move ---
  const scored = available.map((entry) => {
    const { move } = entry;
    const dmg = estimateDamage(fighter, opponent, move);
    const typeMultiplier = getTypeMultiplier(fighter.types, opponent.types);

    // Base score: estimated damage as a proportion of opponent's remaining HP
    // This naturally favours high-damage moves for the creature's stats.
    let score = (dmg / Math.max(1, opponent.hp)) * 100;

    // Accuracy weighting — unreliable moves are riskier
    score *= (move.accuracy ?? 1);

    // Type effectiveness bonus
    if (typeMultiplier >= 1.5) score *= 1.3;
    else if (typeMultiplier <= 0.5) score *= 0.5;
    else if (typeMultiplier === 0) score *= 0;

    // --- Effect-specific situational adjustments ---
    const effect = move.effect;

    // STUN: valuable as crowd control but not if the damage is terrible
    if (effect === 'stun') {
      // Bonus when opponent is healthy (more value in skipping their turn)
      if (opponentHpRatio > 0.5) score += 8;
      // Penalty when opponent is already low (just kill them)
      if (opponentHpRatio < 0.3) score *= 0.4;
      // Opponent has steady passive (immune to stun) → stun is just weak damage
      if (opponent.passive === 'steady') score *= 0.5;
    }

    // DRAIN: better when both fighters are worn down
    if (effect === 'drain') {
      if (hpRatio < 0.6) score += 12;
      if (hpRatio < 0.4) score += 10;
    }

    // GUARD: valuable at low HP, wasteful at high HP
    if (effect === 'guard') {
      if (hpRatio < 0.35 && opponentHpRatio > 0.3) score += 20;
      else if (hpRatio > 0.6) score *= 0.2; // rarely guard when healthy
    }

    // RUSH: risky (exposure on miss), reward at high HP
    if (effect === 'rush') {
      if (hpRatio > 0.6 && opponent.defenseModifier >= 1.0) score *= 1.2;
      if (hpRatio < 0.3) score *= 0.4; // too risky when low
      // If opponent is exposed, rush is great
      if (opponent.defenseModifier > 1.0) score *= 1.3;
    }

    // CHARGE: two-turn investment, needs HP to absorb a hit
    if (effect === 'charge') {
      if (hpRatio > 0.6 && !opponent.charging) score *= 1.15;
      else if (hpRatio < 0.4) score *= 0.3; // too risky
      // Good to waste an opponent's guard
      if (opponent.defenseModifier <= 0.5) score *= 1.2;
    }

    // STRIKE: reliable baseline, slight bonus as a "no-nonsense" option
    if (effect === 'strike') {
      score += 3; // small reliability bonus
    }

    // --- React to opponent charging ---
    if (opponent.charging) {
      if (opponent.chargeMove?.chargeVariant === 'vulnerable') {
        // Free turn — pure damage is king
        if (effect === 'strike' || effect === 'rush') score *= 1.4;
      } else {
        // Defensive charge incoming — prefer guard/drain to prepare
        if (effect === 'guard') score += 15;
        if (effect === 'drain') score += 10;
      }
    }

    // --- Opponent is heavily guarded → don't waste big hits ---
    if (opponent.defenseModifier <= 0.5) {
      if (effect === 'strike' || effect === 'rush') score *= 0.6;
      if (effect === 'stun' || effect === 'drain') score *= 1.2;
    }

    // Floor at a small positive value so every move has a chance
    return { ...entry, score: Math.max(1, score) };
  });

  // --- Weighted random selection ---
  // Square the scores to make high-scoring moves much more likely
  // while still allowing occasional variety
  const totalWeight = scored.reduce((sum, s) => sum + s.score * s.score, 0);
  let roll = Math.random() * totalWeight;
  for (const entry of scored) {
    roll -= entry.score * entry.score;
    if (roll <= 0) {
      return { move: entry.move, moveIndex: entry.index };
    }
  }

  // Fallback (shouldn't reach here)
  const best = scored.reduce((a, b) => (a.score > b.score ? a : b));
  return { move: best.move, moveIndex: best.index };
}

export function runBattle(monster1: Monster, monster2: Monster): BattleResult {
  const getMoves = (m: Monster): Move[] =>
    Array.isArray(m.moves) && m.moves.length > 0
      ? m.moves
      : getDefaultMoves(m.stage);

  const getPassive = (m: Monster): PassiveAbility | null =>
    m.passive ?? null;

  // Speed determines default turn order
  const [first, second] =
    monster1.speed >= monster2.speed
      ? [monster1, monster2]
      : [monster2, monster1];

  const makeFighter = (m: Monster): FighterState => {
    const moves = getMoves(m);
    return {
      monster: m,
      hp: m.hp,
      moves,
      cooldowns: moves.map(() => 0),
      defenseModifier: 1.0,
      guardHitsLeft: 0,
      stunned: false,
      charging: false,
      chargeMove: null,
      passive: getPassive(m),
      types: (Array.isArray(m.types) && m.types.length > 0 ? m.types : ['normal']) as MonsterType[],
      statusCondition: null,
      sleepTurns: 0,
    };
  };

  const fighters: [FighterState, FighterState] = [
    makeFighter(first),
    makeFighter(second),
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
  ): { damage: number; critical: boolean; passiveTriggered: string | null; typeMultiplier: number } => {
    const atkStat = getAttackStat(attacker, move);
    // Special moves partially bypass defense (only 50% defense applies)
    const category = move.category || 'physical';
    const defScale = category === 'special' ? 0.5 : 0.7;
    const raw = Math.max(
      1,
      atkStat - Math.floor(defender.monster.defense * defScale),
    );
    const variance = 0.8 + Math.random() * 0.4;

    let power = move.power;
    let passiveTriggered: string | null = null;

    // Burn reduces physical attack power by 25%
    if (attacker.statusCondition === 'burn' && category === 'physical') {
      power *= 0.75;
    }

    // Passive: reckless — rush moves gain +15% power
    if (attacker.passive === 'reckless' && move.effect === 'rush') {
      power *= 1.15;
      passiveTriggered = 'reckless';
    }

    // Passive: fierce — +20% damage when HP < 33%
    const hpRatio = attacker.hp / attacker.monster.hp;
    if (attacker.passive === 'fierce' && hpRatio < 0.33) {
      power *= 1.2;
      passiveTriggered = 'fierce';
    }

    let defMod = defender.defenseModifier;

    // Passive: thick_skin — defender takes 15% less damage
    if (defender.passive === 'thick_skin') {
      defMod *= 0.85;
      if (!passiveTriggered) passiveTriggered = 'thick_skin';
    }

    // Type effectiveness
    const typeMultiplier = getTypeMultiplier(attacker.types, defender.types);

    // Critical hit check (12% chance, 1.5x damage)
    const critical = Math.random() < CRIT_CHANCE;
    const critMult = critical ? CRIT_MULTIPLIER : 1.0;

    const damage = Math.max(
      typeMultiplier === 0 ? 0 : 1,
      Math.round(raw * variance * power * defMod * critMult * typeMultiplier),
    );

    return { damage, critical, passiveTriggered, typeMultiplier };
  };

  /**
   * Check if an attack hits. Factors in move accuracy, speed-based dodge,
   * and the quick_feet passive.
   */
  const doesHit = (
    attacker: FighterState,
    defender: FighterState,
    move: Move,
  ): boolean => {
    const moveAccuracy = move.accuracy ?? 1.0;
    const speedDiff = defender.monster.speed - attacker.monster.speed;
    let dodgeChance = Math.min(0.25, Math.max(0, speedDiff / 300));

    // Passive: quick_feet — +15% dodge chance
    if (defender.passive === 'quick_feet') {
      dodgeChance = Math.min(0.4, dodgeChance + 0.15);
    }

    const hitChance = moveAccuracy * (1 - dodgeChance);
    return Math.random() < hitChance;
  };

  /** Helper: build a round object with status defaults */
  const makeRound = (partial: Omit<BattleRound, 'statusInflicted' | 'statusDamage' | 'statusSkipped'> & {
    statusInflicted?: StatusEffect | null;
    statusDamage?: number;
    statusSkipped?: boolean;
  }): BattleRound => ({
    statusInflicted: null,
    statusDamage: 0,
    statusSkipped: false,
    ...partial,
  });

  /** Apply start-of-turn status effects (poison/burn tick, sleep/freeze skip).
   *  Returns status damage dealt and whether the turn is skipped. */
  const applyStatusTick = (fighter: FighterState): { statusDamage: number; skipped: boolean } => {
    if (!fighter.statusCondition) return { statusDamage: 0, skipped: false };

    switch (fighter.statusCondition) {
      case 'poison': {
        // 8% max HP per turn
        const dmg = Math.max(1, Math.round(fighter.monster.hp * 0.08));
        fighter.hp = Math.max(0, fighter.hp - dmg);
        return { statusDamage: dmg, skipped: false };
      }
      case 'burn': {
        // 5% max HP per turn (attack penalty applied in calcDamage)
        const dmg = Math.max(1, Math.round(fighter.monster.hp * 0.05));
        fighter.hp = Math.max(0, fighter.hp - dmg);
        return { statusDamage: dmg, skipped: false };
      }
      case 'sleep': {
        if (fighter.sleepTurns > 0) {
          fighter.sleepTurns--;
          if (fighter.sleepTurns === 0) fighter.statusCondition = null;
          return { statusDamage: 0, skipped: true };
        }
        fighter.statusCondition = null;
        return { statusDamage: 0, skipped: false };
      }
      case 'freeze': {
        // 25% chance to thaw each turn
        if (Math.random() < 0.25) {
          fighter.statusCondition = null;
          return { statusDamage: 0, skipped: false };
        }
        return { statusDamage: 0, skipped: true };
      }
    }
  };

  /** Try to inflict a status condition from a move */
  const tryInflictStatus = (move: Move, defender: FighterState): StatusEffect | null => {
    if (!move.statusEffect) return null;
    // Can't stack — already has a condition
    if (defender.statusCondition) return null;
    // Steady passive blocks sleep and stun-like effects
    if (defender.passive === 'steady' && move.statusEffect.type === 'sleep') return null;

    if (Math.random() < move.statusEffect.chance) {
      defender.statusCondition = move.statusEffect.type;
      if (move.statusEffect.type === 'sleep') {
        defender.sleepTurns = 1 + Math.floor(Math.random() * 3); // 1-3 turns
      }
      return move.statusEffect.type;
    }
    return null;
  };

  const executeTurn = (attackerIdx: 0 | 1) => {
    const defenderIdx = attackerIdx === 0 ? 1 : 0;
    const attacker = fighters[attackerIdx];
    const defender = fighters[defenderIdx];

    // Apply status tick at start of turn
    const { statusDamage, skipped: statusSkipped } = applyStatusTick(attacker);

    if (attacker.hp <= 0) return; // died to poison/burn

    // Sleep/freeze skip turn (but taking damage wakes from sleep)
    if (statusSkipped) {
      rounds.push(makeRound({
        attacker: attacker.monster.name,
        defender: defender.monster.name,
        damage: 0,
        attackerHp: attacker.hp,
        defenderHp: defender.hp,
        moveName: attacker.statusCondition === 'sleep' ? 'Asleep' :
                  attacker.statusCondition === 'freeze' ? 'Frozen' : 'Incapacitated',
        moveEffect: 'stun',
        moveCategory: 'physical',
        healAmount: 0,
        stunned: false,
        wasStunned: false,
        missed: false,
        critical: false,
        passiveTriggered: null,
        charging: false,
        chargeVariant: null,
        chargeRelease: false,
        typeMultiplier: 1.0,
        statusSkipped: true,
        statusDamage,
      }));
      return;
    }

    // Check if stunned (passive: steady makes you immune, charging is unstoppable)
    if (attacker.stunned) {
      if (attacker.passive === 'steady') {
        attacker.stunned = false;
        // Steady monster shrugs off stun and acts normally
      } else if (attacker.charging) {
        // Charge is unstoppable — consume stun but keep going
        attacker.stunned = false;
      } else {
        attacker.stunned = false;
        rounds.push(makeRound({
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
          critical: false,
          passiveTriggered: null,
          charging: false,
          chargeVariant: null,
          chargeRelease: false,
          typeMultiplier: 1.0,
          statusDamage,
        }));
        return;
      }
    }

    // If charging, auto-fire the charged move this turn
    if (attacker.charging && attacker.chargeMove) {
      const move = attacker.chargeMove;
      attacker.charging = false;
      attacker.chargeMove = null;

      // Clear defensive guard buff if it was a defensive charge
      if (attacker.guardHitsLeft > 0 && attacker.defenseModifier === 0.3) {
        attacker.defenseModifier = 1.0;
        attacker.guardHitsLeft = 0;
      }

      // Hit/miss check
      if (!doesHit(attacker, defender, move)) {
        rounds.push(makeRound({
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
          critical: false,
          passiveTriggered: defender.passive === 'quick_feet' ? 'quick_feet' : null,
          charging: false,
          chargeVariant: null,
          chargeRelease: true,
          typeMultiplier: 1.0,
          statusDamage,
        }));
        return;
      }

      const { damage, critical, passiveTriggered, typeMultiplier } = calcDamage(attacker, defender, move);
      let healAmount = 0;
      defender.hp = Math.max(0, defender.hp - damage);

      // Taking damage wakes from sleep
      if (defender.statusCondition === 'sleep' && damage > 0) {
        defender.statusCondition = null;
        defender.sleepTurns = 0;
      }

      // Consume guard on defender if active
      if (defender.guardHitsLeft > 0) {
        defender.guardHitsLeft -= 1;
        if (defender.guardHitsLeft === 0) {
          defender.defenseModifier = 1.0;
        }
      } else {
        defender.defenseModifier = 1.0;
      }

      // Try to inflict status from move
      const statusInflicted = tryInflictStatus(move, defender);

      // Passive: vampiric
      if (attacker.passive === 'vampiric') {
        const vampHeal = Math.max(1, Math.round(damage * 0.1));
        attacker.hp = Math.min(attacker.monster.hp, attacker.hp + vampHeal);
        healAmount += vampHeal;
      }

      rounds.push(makeRound({
        attacker: attacker.monster.name,
        defender: defender.monster.name,
        damage,
        attackerHp: attacker.hp,
        defenderHp: defender.hp,
        moveName: move.name,
        moveEffect: move.effect,
        moveCategory: move.category || 'physical',
        healAmount,
        stunned: false,
        wasStunned: false,
        missed: false,
        critical,
        passiveTriggered,
        charging: false,
        chargeVariant: null,
        chargeRelease: true,
        typeMultiplier,
        statusInflicted,
        statusDamage,
      }));
      return;
    }

    const { move, moveIndex } = selectMove(attacker, defender);

    // Set cooldown for the used move (even on miss)
    if (moveIndex >= 0) {
      attacker.cooldowns[moveIndex] = move.cooldown;
    }

    // Charge moves: initiate charge, skip damage this turn
    if (move.effect === 'charge') {
      attacker.charging = true;
      attacker.chargeMove = move;
      if (move.chargeVariant === 'defensive') {
        attacker.defenseModifier = 0.3;
        attacker.guardHitsLeft = 2;
      }
      rounds.push(makeRound({
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
        missed: false,
        critical: false,
        passiveTriggered: null,
        charging: true,
        chargeVariant: move.chargeVariant || 'vulnerable',
        chargeRelease: false,
        typeMultiplier: 1.0,
        statusDamage,
      }));
      return;
    }

    // Check accuracy + speed-based dodge
    if (!doesHit(attacker, defender, move)) {
      // Miss: rush still leaves attacker exposed
      if (move.effect === 'rush') {
        attacker.defenseModifier = 1.5;
      }
      rounds.push(makeRound({
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
        critical: false,
        passiveTriggered: defender.passive === 'quick_feet' ? 'quick_feet' : null,
        charging: false,
        chargeVariant: null,
        chargeRelease: false,
        typeMultiplier: 1.0,
        statusDamage,
      }));
      return;
    }

    const { damage, critical, passiveTriggered, typeMultiplier } = calcDamage(attacker, defender, move);
    let healAmount = 0;

    defender.hp = Math.max(0, defender.hp - damage);

    // Taking damage wakes from sleep
    if (defender.statusCondition === 'sleep' && damage > 0) {
      defender.statusCondition = null;
      defender.sleepTurns = 0;
    }

    // After being hit, consume guard if active; otherwise reset modifier
    if (defender.guardHitsLeft > 0) {
      defender.guardHitsLeft -= 1;
      if (defender.guardHitsLeft === 0) {
        defender.defenseModifier = 1.0;
      }
    } else {
      defender.defenseModifier = 1.0;
    }

    // Apply post-attack effects
    if (move.effect === 'guard') {
      attacker.defenseModifier = 0.3; // Take 70% less damage for 2 incoming hits
      attacker.guardHitsLeft = 2;
    } else if (move.effect === 'rush') {
      attacker.defenseModifier = 1.5; // Take 50% more on next hit
    } else if (move.effect === 'drain') {
      healAmount = Math.round(damage * 0.7);
      attacker.hp = Math.min(attacker.monster.hp, attacker.hp + healAmount);
    } else if (move.effect === 'stun') {
      // 50% chance to stun opponent (unless they have steady passive)
      if (Math.random() < 0.5 && defender.passive !== 'steady') {
        defender.stunned = true;
      }
    }

    // Try to inflict status condition from move
    const statusInflicted = tryInflictStatus(move, defender);

    // Passive: vampiric — heal 10% of damage dealt on every attack
    if (attacker.passive === 'vampiric' && move.effect !== 'drain') {
      const vampHeal = Math.max(1, Math.round(damage * 0.1));
      attacker.hp = Math.min(attacker.monster.hp, attacker.hp + vampHeal);
      healAmount += vampHeal;
    }

    rounds.push(makeRound({
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
      critical,
      passiveTriggered,
      charging: false,
      chargeVariant: null,
      chargeRelease: false,
      typeMultiplier,
      statusInflicted,
      statusDamage,
    }));
  };

  const tickCooldowns = (fighter: FighterState) => {
    for (let i = 0; i < fighter.cooldowns.length; i++) {
      fighter.cooldowns[i] = Math.max(0, fighter.cooldowns[i] - 1);
    }
  };

  // Battle loop (max 20 rounds to prevent infinite)
  for (let i = 0; i < 20; i++) {
    // Determine turn order for this round — priority moves override speed
    // Charging fighters don't pick a new move (they auto-fire)
    const move0 = fighters[0].charging ? { move: STRUGGLE, moveIndex: -1 } : selectMove(fighters[0], fighters[1]);
    const move1 = fighters[1].charging ? { move: STRUGGLE, moveIndex: -1 } : selectMove(fighters[1], fighters[0]);
    const p0 = move0.move.priority && !fighters[0].stunned && !fighters[0].charging;
    const p1 = move1.move.priority && !fighters[1].stunned && !fighters[1].charging;

    // If only one side has priority, they go first. Otherwise default order.
    let firstIdx: 0 | 1 = 0;
    let secondIdx: 0 | 1 = 1;
    if (p1 && !p0) {
      firstIdx = 1;
      secondIdx = 0;
    }
    // If both have priority or neither, keep default speed-based order

    executeTurn(firstIdx);
    if (fighters[secondIdx].hp <= 0) break;

    executeTurn(secondIdx);
    if (fighters[firstIdx].hp <= 0) break;

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
