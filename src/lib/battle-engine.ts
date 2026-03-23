import type { Monster, Move, MonsterType, PassiveAbility } from './types';
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
  const raw = Math.max(1, atkStat - Math.floor(defender.monster.defense * 0.6));
  let power = move.power;
  // Account for reckless passive on rush moves
  if (attacker.passive === 'reckless' && move.effect === 'rush') {
    power *= 1.25;
  }
  return Math.max(1, Math.round(raw * power * defender.defenseModifier));
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

  const find = (effect: string) =>
    available.find((m) => m.move.effect === effect);

  // --- PRIORITY 1: Finish them off ---
  const killShots = available.filter(
    (m) => estimateDamage(fighter, opponent, m.move) >= opponent.hp,
  );
  if (killShots.length > 0) {
    killShots.sort(
      (a, b) => (b.move.accuracy ?? 1) - (a.move.accuracy ?? 1),
    );
    return { move: killShots[0].move, moveIndex: killShots[0].index };
  }

  // --- PRIORITY 1.5: React to opponent charging ---
  if (opponent.charging) {
    if (opponent.chargeMove?.chargeVariant === 'vulnerable') {
      // Free turn — use highest power move to punish
      available.sort((a, b) => b.move.power - a.move.power);
      return { move: available[0].move, moveIndex: available[0].index };
    } else {
      // Defensive charge incoming — guard up or drain to prepare
      const guard = find('guard');
      if (guard) return { move: guard.move, moveIndex: guard.index };
      const drain = find('drain');
      if (drain) return { move: drain.move, moveIndex: drain.index };
    }
  }

  // --- PRIORITY 2: Opponent is heavily guarded → don't waste big moves ---
  if (opponent.defenseModifier <= 0.5) {
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

  // --- PRIORITY 6.5: Use charge move if conditions are favorable ---
  const charge = find('charge');
  if (charge && hpRatio > 0.5 && !opponent.charging) {
    if (opponent.defenseModifier <= 0.5) {
      return { move: charge.move, moveIndex: charge.index };
    }
    if (hpRatio > 0.7) {
      return { move: charge.move, moveIndex: charge.index };
    }
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
    const raw = Math.max(
      1,
      atkStat - Math.floor(defender.monster.defense * 0.6),
    );
    const variance = 0.8 + Math.random() * 0.4;

    let power = move.power;
    let passiveTriggered: string | null = null;

    // Passive: reckless — rush moves gain +25% power
    if (attacker.passive === 'reckless' && move.effect === 'rush') {
      power *= 1.25;
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

  const executeTurn = (attackerIdx: 0 | 1) => {
    const defenderIdx = attackerIdx === 0 ? 1 : 0;
    const attacker = fighters[attackerIdx];
    const defender = fighters[defenderIdx];

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
          critical: false,
          passiveTriggered: null,
          charging: false,
          chargeVariant: null,
          chargeRelease: false,
          typeMultiplier: 1.0,
        });
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
          critical: false,
          passiveTriggered: defender.passive === 'quick_feet' ? 'quick_feet' : null,
          charging: false,
          chargeVariant: null,
          chargeRelease: true,
          typeMultiplier: 1.0,
        });
        return;
      }

      const { damage, critical, passiveTriggered, typeMultiplier } = calcDamage(attacker, defender, move);
      let healAmount = 0;
      defender.hp = Math.max(0, defender.hp - damage);

      // Consume guard on defender if active
      if (defender.guardHitsLeft > 0) {
        defender.guardHitsLeft -= 1;
        if (defender.guardHitsLeft === 0) {
          defender.defenseModifier = 1.0;
        }
      } else {
        defender.defenseModifier = 1.0;
      }

      // Passive: vampiric
      if (attacker.passive === 'vampiric') {
        const vampHeal = Math.max(1, Math.round(damage * 0.1));
        attacker.hp = Math.min(attacker.monster.hp, attacker.hp + vampHeal);
        healAmount += vampHeal;
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
        stunned: false,
        wasStunned: false,
        missed: false,
        critical,
        passiveTriggered,
        charging: false,
        chargeVariant: null,
        chargeRelease: true,
        typeMultiplier,
      });
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
        missed: false,
        critical: false,
        passiveTriggered: null,
        charging: true,
        chargeVariant: move.chargeVariant || 'vulnerable',
        chargeRelease: false,
        typeMultiplier: 1.0,
      });
      return;
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
        critical: false,
        passiveTriggered: defender.passive === 'quick_feet' ? 'quick_feet' : null,
        charging: false,
        chargeVariant: null,
        chargeRelease: false,
        typeMultiplier: 1.0,
      });
      return;
    }

    const { damage, critical, passiveTriggered, typeMultiplier } = calcDamage(attacker, defender, move);
    let healAmount = 0;

    defender.hp = Math.max(0, defender.hp - damage);

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
      attacker.defenseModifier = 1.25; // Take 25% more on next hit
    } else if (move.effect === 'drain') {
      healAmount = Math.round(damage * 0.6);
      attacker.hp = Math.min(attacker.monster.hp, attacker.hp + healAmount);
    } else if (move.effect === 'stun') {
      // 40% chance to stun opponent (unless they have steady passive)
      if (Math.random() < 0.4 && defender.passive !== 'steady') {
        defender.stunned = true;
      }
    }

    // Passive: vampiric — heal 10% of damage dealt on every attack
    if (attacker.passive === 'vampiric' && move.effect !== 'drain') {
      const vampHeal = Math.max(1, Math.round(damage * 0.1));
      attacker.hp = Math.min(attacker.monster.hp, attacker.hp + vampHeal);
      healAmount += vampHeal;
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
      critical,
      passiveTriggered,
      charging: false,
      chargeVariant: null,
      chargeRelease: false,
      typeMultiplier,
    });
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
