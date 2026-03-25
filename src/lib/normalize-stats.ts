const STAT_KEYS = ["hp", "attack", "defense", "sp_attack", "speed"] as const;

type Stats = { hp: number; attack: number; defense: number; sp_attack: number; speed: number };

/**
 * Clamp each stat to [30, maxStat], then proportionally scale to hit the budget.
 * Stage 1: budget=280, maxStat=100
 * Stage 2: budget=350, maxStat=120
 * Stage 3: budget=420, maxStat=140
 */
export function normalizeStats(
  raw: Stats,
  budget = 280,
  maxStat = 100
): Stats {
  const minStat = 30;
  const clamped = {} as Record<(typeof STAT_KEYS)[number], number>;

  for (const k of STAT_KEYS) {
    const v = Number(raw[k]);
    // If GPT returned a bad value, use budget/5 as a safe fallback
    clamped[k] = Number.isFinite(v)
      ? Math.max(minStat, Math.min(maxStat, Math.round(v)))
      : Math.round(budget / 5);
  }

  // Polarize attack stats — if both attack and sp_attack are within 15 of each other,
  // boost the higher one and shrink the lower one to create a clear identity
  const atkDiff = Math.abs(clamped.attack - clamped.sp_attack);
  if (atkDiff < 15) {
    const shift = Math.round((15 - atkDiff) / 2) + 3;
    if (clamped.attack >= clamped.sp_attack) {
      clamped.attack = Math.min(maxStat, clamped.attack + shift);
      clamped.sp_attack = Math.max(minStat, clamped.sp_attack - shift);
    } else {
      clamped.sp_attack = Math.min(maxStat, clamped.sp_attack + shift);
      clamped.attack = Math.max(minStat, clamped.attack - shift);
    }
  }

  const sum = STAT_KEYS.reduce((s, k) => s + clamped[k], 0);
  if (sum === budget) return clamped;

  // Scale proportionally
  const scale = budget / sum;
  for (const k of STAT_KEYS) {
    clamped[k] = Math.max(
      minStat,
      Math.min(maxStat, Math.round(clamped[k] * scale))
    );
  }

  // Fix rounding residual on hp
  const newSum = STAT_KEYS.reduce((s, k) => s + clamped[k], 0);
  clamped.hp += budget - newSum;

  return clamped;
}
