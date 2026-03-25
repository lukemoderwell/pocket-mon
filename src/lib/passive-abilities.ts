import type { PassiveAbility } from './types';

/**
 * Assigns a passive ability based on a monster's stat distribution.
 * The highest stat (relative to others) determines which passives are
 * most likely, but there's always a chance of getting any passive.
 */
export function assignPassive(stats: {
  hp: number;
  attack: number;
  defense: number;
  sp_attack: number;
  speed: number;
}): PassiveAbility {
  // Weight each passive based on stat profile
  const weights: { passive: PassiveAbility; weight: number }[] = [
    { passive: 'thick_skin', weight: stats.defense + stats.hp * 0.5 },
    { passive: 'quick_feet', weight: stats.speed * 1.5 },
    { passive: 'vampiric', weight: stats.sp_attack + stats.attack * 0.3 },
    { passive: 'fierce', weight: stats.attack * 1.5 },
    { passive: 'steady', weight: stats.defense + stats.speed * 0.5 },
    { passive: 'reckless', weight: stats.attack + stats.speed * 0.5 },
  ];

  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const w of weights) {
    roll -= w.weight;
    if (roll <= 0) return w.passive;
  }

  return weights[0].passive;
}

/** Human-readable passive descriptions for UI display */
export const PASSIVE_DESCRIPTIONS: Record<PassiveAbility, string> = {
  thick_skin: 'Takes 15% less damage from all attacks',
  quick_feet: '+15% dodge chance against all attacks',
  vampiric: 'Heals 10% of damage dealt on every attack',
  fierce: '+20% damage when HP drops below 33%',
  steady: 'Immune to stun effects',
  reckless: 'Rush moves deal 15% more damage',
};

/** Short passive names for display */
export const PASSIVE_NAMES: Record<PassiveAbility, string> = {
  thick_skin: 'Thick Skin',
  quick_feet: 'Quick Feet',
  vampiric: 'Vampiric',
  fierce: 'Fierce',
  steady: 'Steady',
  reckless: 'Reckless',
};
