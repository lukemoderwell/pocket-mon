import type { Monster } from "./types";

export interface BattleRound {
  attacker: string;
  defender: string;
  damage: number;
  attackerHp: number;
  defenderHp: number;
}

export interface BattleResult {
  winner: Monster;
  loser: Monster;
  rounds: BattleRound[];
}

export function runBattle(monster1: Monster, monster2: Monster): BattleResult {
  // Clone HP so we don't mutate originals
  let hp1 = monster1.hp;
  let hp2 = monster2.hp;
  const rounds: BattleRound[] = [];

  // Speed determines turn order
  let [first, second] = monster1.speed >= monster2.speed
    ? [monster1, monster2]
    : [monster2, monster1];
  let [firstHp, secondHp] = first === monster1 ? [hp1, hp2] : [hp2, hp1];

  const calcDamage = (attacker: Monster, defender: Monster): number => {
    // Base damage formula: attack power vs defense
    const raw = Math.max(1, attacker.attack - Math.floor(defender.defense * 0.6));
    // Add some variance: ±20%
    const variance = 0.8 + Math.random() * 0.4;
    return Math.max(1, Math.round(raw * variance));
  };

  // Battle loop (max 20 rounds to prevent infinite)
  for (let i = 0; i < 20; i++) {
    // First monster attacks
    const dmg1 = calcDamage(first, second);
    secondHp = Math.max(0, secondHp - dmg1);
    rounds.push({
      attacker: first.name,
      defender: second.name,
      damage: dmg1,
      attackerHp: firstHp,
      defenderHp: secondHp,
    });

    if (secondHp <= 0) break;

    // Second monster attacks
    const dmg2 = calcDamage(second, first);
    firstHp = Math.max(0, firstHp - dmg2);
    rounds.push({
      attacker: second.name,
      defender: first.name,
      damage: dmg2,
      attackerHp: secondHp,
      defenderHp: firstHp,
    });

    if (firstHp <= 0) break;
  }

  // Determine winner
  const firstWins = firstHp > secondHp;
  return {
    winner: firstWins ? first : second,
    loser: firstWins ? second : first,
    rounds,
  };
}
