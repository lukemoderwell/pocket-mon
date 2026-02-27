const STAT_KEYS = ["hp", "attack", "defense", "speed"] as const;

type Stats = { hp: number; attack: number; defense: number; speed: number };

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
    clamped[k] = Math.max(minStat, Math.min(maxStat, Math.round(raw[k])));
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
