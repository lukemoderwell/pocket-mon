import { supabase } from '@/lib/supabase';
import type { LeaderboardEntry, Monster } from '@/lib/types';

/** Convert a LeaderboardEntry to a Monster for the battle engine */
export function toMonster(entry: LeaderboardEntry): Monster {
  return {
    id: entry.id,
    name: entry.monster_name,
    hp: entry.hp,
    attack: entry.attack,
    defense: entry.defense,
    sp_attack: entry.sp_attack,
    speed: entry.speed,
    image_url: entry.image_url,
    backstory: entry.backstory,
    appearance: '',
    moves: entry.moves,
    stage: entry.stage,
    evolution_history: entry.evolution_history ?? [],
    evo_threshold_2: null,
    evo_threshold_3: null,
    created_at: entry.created_at,
  };
}

interface FetchOptions {
  /** Only include monsters that have at least one battle record */
  onlyWithBattles?: boolean;
  /** Cap the returned array to this many entries */
  limit?: number;
}

/**
 * Fetch all monsters with their win/loss stats from the battles table.
 * Results are sorted by wins desc, then losses asc.
 */
export async function fetchMonstersWithStats(
  opts?: FetchOptions,
): Promise<LeaderboardEntry[]> {
  // Fetch ALL battles using pagination to bypass PostgREST default row limit
  // (default is 1000 rows — without pagination, win/loss tallies silently
  // become stale once the battles table exceeds that threshold).
  const allBattles: { winner_id: string; loser_id: string }[] = [];
  const PAGE_SIZE = 1000;
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const { data } = await supabase
      .from('battles')
      .select('winner_id, loser_id')
      .range(offset, offset + PAGE_SIZE - 1);
    if (data && data.length > 0) {
      allBattles.push(...data);
      offset += PAGE_SIZE;
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }

  const stats = new Map<string, { wins: number; losses: number }>();
  for (const b of allBattles) {
    const w = stats.get(b.winner_id) ?? { wins: 0, losses: 0 };
    w.wins++;
    stats.set(b.winner_id, w);

    const l = stats.get(b.loser_id) ?? { wins: 0, losses: 0 };
    l.losses++;
    stats.set(b.loser_id, l);
  }

  // Fetch monsters — either all or only those with battle records
  const monsterQuery = supabase.from('monsters').select('*');
  if (opts?.onlyWithBattles) {
    const ids = [...stats.keys()];
    if (ids.length === 0) return [];
    monsterQuery.in('id', ids);
  }

  const { data: monsters } = await monsterQuery;
  if (!monsters) return [];

  // Map to LeaderboardEntry
  const entries: LeaderboardEntry[] = monsters.map((m) => {
    const s = stats.get(m.id) ?? { wins: 0, losses: 0 };
    return {
      id: m.id,
      monster_name: m.name,
      wins: s.wins,
      losses: s.losses,
      hp: m.hp ?? 0,
      attack: m.attack,
      defense: m.defense ?? 0,
      sp_attack: m.sp_attack ?? 0,
      speed: m.speed ?? 0,
      image_url: m.image_url,
      backstory: m.backstory ?? '',
      stage: m.stage ?? 1,
      passive: m.passive ?? undefined,
      moves: Array.isArray(m.moves) ? m.moves : [],
      evolution_history: Array.isArray(m.evolution_history)
        ? m.evolution_history
        : [],
      created_at: m.created_at ?? '',
    };
  });

  // Sort by wins desc, then losses asc
  entries.sort((a, b) => b.wins - a.wins || a.losses - b.losses);

  if (opts?.limit) {
    return entries.slice(0, opts.limit);
  }

  return entries;
}
