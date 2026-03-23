import type { MonsterType } from './types';

/**
 * Type effectiveness chart.
 * Key = attacking type, Value = map of defending type → multiplier.
 * Only non-neutral (1.0) matchups are listed.
 */
const EFFECTIVENESS: Partial<Record<MonsterType, Partial<Record<MonsterType, number>>>> = {
  fire: { grass: 1.5, ice: 1.5, bug: 1.5, water: 0.5, rock: 0.5, fire: 0.5 },
  water: { fire: 1.5, rock: 1.5, water: 0.5, grass: 0.5, electric: 0.5 },
  grass: { water: 1.5, rock: 1.5, fire: 0.5, flying: 0.5, poison: 0.5, bug: 0.5, grass: 0.5 },
  electric: { water: 1.5, flying: 1.5, grass: 0.5, electric: 0.5, rock: 0.5 },
  ice: { grass: 1.5, flying: 1.5, rock: 0.5, fire: 0.5, water: 0.5, ice: 0.5 },
  rock: { fire: 1.5, ice: 1.5, flying: 1.5, bug: 1.5 },
  flying: { grass: 1.5, bug: 1.5, rock: 0.5, electric: 0.5 },
  poison: { grass: 1.5, bug: 1.5, poison: 0.5, rock: 0.5, ghost: 0.5 },
  psychic: { poison: 1.5, ghost: 0.5, psychic: 0.5, bug: 0.5 },
  ghost: { psychic: 1.5, ghost: 1.5, normal: 0 },
  bug: { grass: 1.5, psychic: 1.5, poison: 1.5, fire: 0.5, flying: 0.5, rock: 0.5 },
  normal: { ghost: 0, rock: 0.5 },
};

/**
 * Get the combined type effectiveness multiplier.
 * Attacker's types are used offensively; each attacking type's best multiplier
 * against ALL defender types is picked, then the best across attacker types is used.
 * This means having a super-effective type always helps.
 */
export function getTypeMultiplier(
  attackerTypes: MonsterType[],
  defenderTypes: MonsterType[],
): number {
  if (attackerTypes.length === 0 || defenderTypes.length === 0) return 1.0;

  let bestMultiplier = 1.0;

  for (const atkType of attackerTypes) {
    let multiplier = 1.0;
    const chart = EFFECTIVENESS[atkType];
    if (chart) {
      for (const defType of defenderTypes) {
        const eff = chart[defType];
        if (eff !== undefined) {
          multiplier *= eff;
        }
      }
    }
    // Take the best attacking type's result
    if (bestMultiplier === 1.0 || Math.abs(multiplier - 1.0) > Math.abs(bestMultiplier - 1.0)) {
      bestMultiplier = multiplier;
    }
  }

  return bestMultiplier;
}

/** Color map for rendering type badges in the UI */
export const TYPE_COLORS: Record<MonsterType, string> = {
  fire: '#F08030',
  water: '#6890F0',
  grass: '#78C850',
  electric: '#F8D030',
  ice: '#98D8D8',
  rock: '#B8A038',
  flying: '#A890F0',
  poison: '#A040A0',
  psychic: '#F85888',
  ghost: '#705898',
  bug: '#A8B820',
  normal: '#A8A878',
};

/** Display-friendly type names */
export const TYPE_NAMES: Record<MonsterType, string> = {
  fire: 'Fire',
  water: 'Water',
  grass: 'Grass',
  electric: 'Electric',
  ice: 'Ice',
  rock: 'Rock',
  flying: 'Flying',
  poison: 'Poison',
  psychic: 'Psychic',
  ghost: 'Ghost',
  bug: 'Bug',
  normal: 'Normal',
};

/**
 * Normalize raw type data from GPT responses.
 * Ensures we get 1-2 valid types, defaulting to ["normal"].
 */
export function normalizeTypes(raw: unknown): MonsterType[] {
  const valid: MonsterType[] = [
    'fire', 'water', 'grass', 'electric', 'ice', 'rock',
    'flying', 'poison', 'psychic', 'ghost', 'bug', 'normal',
  ];

  if (!Array.isArray(raw)) {
    if (typeof raw === 'string' && valid.includes(raw as MonsterType)) {
      return [raw as MonsterType];
    }
    return ['normal'];
  }

  const types = raw
    .filter((t): t is MonsterType => typeof t === 'string' && valid.includes(t as MonsterType))
    .slice(0, 2);

  // Remove duplicates
  const unique = [...new Set(types)];

  return unique.length > 0 ? unique : ['normal'];
}
